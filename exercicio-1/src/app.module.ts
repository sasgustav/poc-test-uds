import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaModule } from './cobranca/cobranca.module';
import { ProblemJsonFilter } from './common/filters/problem-json.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { getDatabaseConfig } from './config/database.config';
import { validateEnv, type Env } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { AppLoggerModule } from './observability/logger.module';
import { AppMetricsModule } from './observability/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    AppLoggerModule,
    AppMetricsModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    CobrancaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: ProblemJsonFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
