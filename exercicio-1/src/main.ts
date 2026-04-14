import 'reflect-metadata';
// eslint-disable-next-line import/order -- OTel must initialize before NestFactory
import { startTracing } from './observability/tracing';
// Tracing DEVE iniciar antes de importar NestFactory para instrumentar auto.
const tracingSdk = startTracing();

import { VersioningType, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const defaultVersion = config.get('API_DEFAULT_VERSION', { infer: true });

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );

  const openapi = new DocumentBuilder()
    .setTitle('Régua de Cobranças — API')
    .setDescription(
      'API de gestão de faturas com régua de lembretes (D-3, D+1, D+7). ' +
        'Arquitetura hexagonal + outbox + idempotência + observabilidade.',
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'ApiKey')
    .addTag('faturas')
    .addTag('health')
    .build();
  const doc = SwaggerModule.createDocument(app, openapi);
  SwaggerModule.setup('docs', app, doc, { swaggerOptions: { persistAuthorization: true } });

  await app.listen(port);
  app.get(Logger).log(`API up on :${port} — docs at /docs`);

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      const shutdown = tracingSdk ? tracingSdk.shutdown() : Promise.resolve();
      void shutdown.finally(() => {
        void app.close();
      });
    });
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- NestJS requires CJS-compatible bootstrap
void bootstrap();
