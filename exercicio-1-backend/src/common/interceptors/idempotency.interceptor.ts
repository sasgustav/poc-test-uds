import { createHash } from 'node:crypto';
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of, tap } from 'rxjs';
import type { IdempotencyRepository } from '../../cobranca/domain/ports/idempotency.repository';
import { IDEMPOTENCY_REPOSITORY } from '../../cobranca/domain/ports/tokens';

const HEADER = 'idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency-Key pattern (draft-ietf-httpapi-idempotency-key).
 *
 * - Mesma key + mesmo payload → retorna resposta cacheada.
 * - Mesma key + payload diferente → 409 Conflict.
 * - Sem key → bypass (opt-in).
 *
 * Aplicado apenas em operações que mutam estado (POST/PATCH).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IDEMPOTENCY_REPOSITORY) private readonly repo: IdempotencyRepository,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
      return next.handle();
    }
    const key = req.header(HEADER);
    if (!key) return next.handle();

    if (key.length > 128) {
      throw new ConflictException('Idempotency-Key deve ter no máximo 128 chars');
    }

    const requestHash = hashRequest(req);
    const existing = await this.repo.buscar(key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          `Idempotency-Key "${key}" já utilizada com payload diferente`,
        );
      }
      res.status(existing.statusCode);
      res.setHeader('Idempotent-Replay', 'true');
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((body: unknown) => {
        const now = new Date();
        this.repo.registrar({
          key,
          requestHash,
          statusCode: res.statusCode,
          responseBody: body,
          createdAt: now,
          expiresAt: new Date(now.getTime() + TTL_MS),
        }).catch(() => { /* idempotency is best-effort */ });
      }),
    );
  }
}

function hashRequest(req: Request): string {
  const h = createHash('sha256');
  h.update(req.method);
  h.update('\n');
  h.update(req.originalUrl ?? req.url);
  h.update('\n');
  h.update(JSON.stringify(req.body ?? {}));
  return h.digest('hex');
}
