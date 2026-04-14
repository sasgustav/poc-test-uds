import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.schema';

export const CORRELATION_HEADER = 'x-request-id';

/**
 * Structured logging com pino.
 * - JSON em prod/test, pretty em dev
 * - Correlation ID via header X-Request-Id (gerado se ausente)
 * - Redação de PII: emailDevedor, nomeDevedor, password, authorization
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isDev = config.get('NODE_ENV', { infer: true }) === 'development';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            genReqId: (req, res) => {
              const incoming = req.headers[CORRELATION_HEADER];
              const id =
                typeof incoming === 'string' && incoming.length > 0
                  ? incoming
                  : randomUUID();
              res.setHeader(CORRELATION_HEADER, id);
              return id;
            },
            customProps: () => ({ service: 'regua-cobrancas' }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                '*.password',
                '*.emailDevedor',
                '*.nomeDevedor',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                }
              : undefined,
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
