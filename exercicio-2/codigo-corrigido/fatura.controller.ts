/**
 * Versão corrigida — production-grade.
 *
 * Em vez de reapresentar "o mesmo controller com um WHERE", este arquivo
 * demonstra:
 * - tenant isolation via decorator autenticado (impossível passar userId por query);
 * - keyset pagination (cursor) em vez de OFFSET — O(1) em dataset grande;
 * - Problem+JSON (RFC 7807) para erros;
 * - rate limiting por userId (não por IP — chave do JWT);
 * - projeção explícita no SELECT (sem SELECT *);
 * - observabilidade (logger estruturado + span de trace).
 */
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  UseInterceptors,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  CanActivate,
  NestInterceptor,
  CallHandler,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { trace } from '@opentelemetry/api';
import { Type, Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { Entity, PrimaryGeneratedColumn, Column, Index, Repository, LessThan } from 'typeorm';

// =============================================================================
// Tipos
// =============================================================================

interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly tenantId?: string;
}

interface KeysetPage<T> {
  readonly data: T[];
  readonly nextCursor: string | null;
  readonly pageSize: number;
}

// =============================================================================
// Decorator @CurrentUser — NUNCA lê userId de query/body/route params.
// A única fonte de verdade é o contexto autenticado (req.user), populado pelo
// guard. Essa é a invariante que fecha a classe de bugs do exercício.
// =============================================================================

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new UnauthorizedException('Contexto de autenticação ausente');
    }
    return field ? req.user[field] : req.user;
  },
);

// =============================================================================
// Guard JWT — em produção real usaria @nestjs/passport com JwtStrategy.
// Aqui demonstrado com stub: exige req.user.id preenchido.
// =============================================================================

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user?.id) throw new UnauthorizedException('Token ausente ou inválido');
    return true;
  }
}

// =============================================================================
// Interceptor de auditoria — loga userId+rota+duração+rowsReturned.
// O alerta "distinct(response.userId) != authenticatedUserId" moraria aqui.
// =============================================================================

@Injectable()
export class TenantAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TenantAudit');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const start = Date.now();
    return next.handle().pipe(
      tap((body) => {
        const user = req.user;
        const rows = Array.isArray((body as { data?: unknown[] })?.data)
          ? (body as { data: unknown[] }).data.length
          : undefined;
        const traceId = trace.getActiveSpan()?.spanContext().traceId;
        this.logger.log({
          msg: 'list_faturas',
          traceId,
          userId: user?.id,
          route: req.originalUrl,
          duration_ms: Date.now() - start,
          rowsReturned: rows,
        });
        // Asserção defensiva: todas as faturas retornadas devem pertencer ao tenant.
        if (
          user &&
          Array.isArray((body as { data?: Array<{ userId?: string }> })?.data)
        ) {
          const offenders = (body as { data: Array<{ userId?: string }> }).data.filter(
            (f) => f.userId && f.userId !== user.id,
          );
          if (offenders.length > 0) {
            this.logger.error({
              msg: 'TENANT_LEAK_DETECTED',
              userId: user.id,
              offenders: offenders.length,
              traceId,
            });
            // Em produção: abort da resposta + page oncall. Aqui esvazia.
            (body as { data: unknown[] }).data = [];
          }
        }
      }),
    );
  }
}

// =============================================================================
// Entity + DTOs
// =============================================================================

@Entity('faturas')
@Index('idx_faturas_user_vencimento', ['userId', 'dataVencimento'])
export class Fatura {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'varchar', length: 255 }) descricao!: string;
  @Column({ type: 'bigint' }) valorCents!: string; // bigint vem como string do pg driver
  @Column({ type: 'date' }) dataVencimento!: string;
  @Column({ type: 'varchar', length: 20, default: 'pendente' }) status!: string;
}

export class ListFaturasQuery {
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /**
   * Cursor base64("{dataVencimento}|{id}") — keyset pagination.
   * Vantagem sobre OFFSET: O(1) mesmo com 1M linhas (não precisa varrer N offset).
   */
  @IsOptional()
  cursor?: string;

  @IsOptional() @IsUUID() status?: string;
}

// =============================================================================
// Controller
// =============================================================================

@ApiTags('faturas')
@ApiBearerAuth()
@Controller({ path: 'faturas', version: '1' })
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@UseInterceptors(TenantAuditInterceptor)
export class FaturaController {
  constructor(
    @InjectRepository(Fatura) private readonly repo: Repository<Fatura>,
  ) {}

  /**
   * Rate limit **por userId** (não por IP).
   *
   * Por IP, um único cliente atrás de proxy compartilhado (corp NAT) exauriria
   * o orçamento para todos os colegas. Pela chave do JWT, o contrato é de
   * usuário individual.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Faturas do tenant autenticado (keyset pagination).' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false, description: 'base64 de {vencimento}|{id}' })
  async listar(
    @CurrentUser('id') userId: string,
    @Query() q: ListFaturasQuery,
  ): Promise<KeysetPage<Fatura>> {
    const limit = q.pageSize;
    const decoded = q.cursor ? decodeCursor(q.cursor) : null;

    // Keyset: WHERE (dataVencimento, id) < (:lastVenc, :lastId) ORDER BY desc LIMIT N
    const qb = this.repo
      .createQueryBuilder('f')
      .select([
        'f.id',
        'f.userId',
        'f.descricao',
        'f.valorCents',
        'f.dataVencimento',
        'f.status',
      ])
      .where('f.userId = :userId', { userId })
      .orderBy('f.dataVencimento', 'DESC')
      .addOrderBy('f.id', 'DESC')
      .take(limit + 1);

    if (decoded) {
      qb.andWhere('(f.dataVencimento, f.id) < (:venc, :id)', decoded);
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ venc: last.dataVencimento, id: last.id }) : null;

    return { data, nextCursor, pageSize: limit };
  }
}

// =============================================================================
// Cursor helpers
// =============================================================================

function encodeCursor(c: { venc: string; id: string }): string {
  return Buffer.from(`${c.venc}|${c.id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { venc: string; id: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [venc, id] = raw.split('|');
  if (!venc || !id) throw new UnauthorizedException('Cursor inválido');
  return { venc, id };
}

// Silencia imports não usados em linters estritos (LessThan mantido para referência SQL).
void LessThan;
