import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// =========================================================================
// Interfaces e tipos auxiliares
// =========================================================================

/**
 * Representa o usuário extraído do token JWT.
 * Em produção, viria de um módulo de autenticação compartilhado.
 */
interface AuthenticatedUser {
  id: string;
  email: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// =========================================================================
// Decorator @CurrentUser()
//
// Extrai o usuário autenticado do request de forma tipada,
// eliminando o acesso direto ao @Req() e ao objeto Express.
// =========================================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// =========================================================================
// Guard de autenticação (simplificado para o exercício)
//
// Em produção, usaria @nestjs/passport com estratégia JWT.
// O ponto aqui é que o guard DEVE existir — sem ele, o endpoint é aberto.
// =========================================================================

import { Injectable, CanActivate, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user?.id) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    return true;
  }
}

// =========================================================================
// Entidade Fatura (referência para tipagem)
// =========================================================================

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('faturas')
export class Fatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  dataVencimento: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string;
}

// =========================================================================
// Controller corrigido
// =========================================================================

@Controller('faturas')
@UseGuards(JwtAuthGuard)
export class FaturaController {
  constructor(
    @InjectRepository(Fatura)
    private readonly faturaRepository: Repository<Fatura>,
  ) {}

  /**
   * Lista faturas do usuário autenticado com paginação.
   *
   * Correções aplicadas em relação ao código original:
   *
   * 1. @UseGuards(JwtAuthGuard) — exige autenticação (antes: endpoint aberto)
   * 2. @CurrentUser() — extrai userId de forma tipada (antes: @Req() sem tipo)
   * 3. WHERE no banco — filtra por userId no SQL (antes: find() sem filtro + filter em JS)
   * 4. Paginação — take/skip com limite máximo (antes: retornava tudo)
   * 5. Tipagem completa — retorno Promise<PaginatedResult<Fatura>> (antes: any)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listarFaturas(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedResult<Fatura>> {
    const safeLimit = Math.min(limit, 100);

    const [data, total] = await this.faturaRepository.findAndCount({
      where: { userId: user.id },
      order: { dataVencimento: 'DESC' },
      skip: (page - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page,
      limit: safeLimit,
    };
  }
}
