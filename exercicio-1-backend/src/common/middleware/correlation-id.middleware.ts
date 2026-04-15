import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-request-id';

/**
 * Gera/echoa X-Request-Id. O mesmo header é consumido por nestjs-pino
 * (`genReqId`) para propagar `requestId` em todos os logs do request.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_HEADER);
    const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
    req.headers[CORRELATION_HEADER] = id;
    res.setHeader(CORRELATION_HEADER, id);
    next();
  }
}
