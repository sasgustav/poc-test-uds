import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
}

/**
 * Extrai o usuário autenticado SEMPRE do contexto de autenticação,
 * nunca de query/body/route params. Mesmo anti-pattern do Exercício 2.
 */
/* eslint-disable sonarjs/function-return-type -- decorator returns field value or full user by design */
export const CurrentUser = createParamDecorator<keyof AuthenticatedUser | undefined>(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) {
      throw new Error('req.user ausente — ApiKeyGuard não executado?');
    }
    return field ? user[field] : user;
  },
);
