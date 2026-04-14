import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Env } from '../../config/env.schema';

export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

/**
 * AuthN stub — em produção seria JWT/OAuth2.
 *
 * Aceita header `X-API-Key` e compara sha256(key) contra `API_KEY_SHA256`
 * via `timingSafeEqual` (elide timing attacks). Popula req.user a partir
 * de `X-User-Id` (para fins de demo — em prod viria do JWT claim `sub`).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const expected = this.config.get('API_KEY_SHA256', { infer: true });
    if (!expected) {
      // Modo dev sem API key configurada: permite, mas avisa.
      this.logger.warn('API_KEY_SHA256 ausente — guard em modo permissivo');
      req.user = { id: this.extractUserId(req) };
      return true;
    }

    const provided = req.header('x-api-key');
    if (!provided) throw new UnauthorizedException('API key ausente');

    const providedHash = createHash('sha256').update(provided).digest();
    const expectedBuf = Buffer.from(expected, 'hex');
    if (providedHash.length !== expectedBuf.length) {
      throw new UnauthorizedException('API key inválida');
    }
    if (!timingSafeEqual(providedHash, expectedBuf)) {
      throw new UnauthorizedException('API key inválida');
    }
    req.user = { id: this.extractUserId(req) };
    return true;
  }

  private extractUserId(req: Request): string {
    const xid = req.header('x-user-id');
    return xid ?? '00000000-0000-0000-0000-000000000000';
  }
}
