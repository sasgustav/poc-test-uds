import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Env } from './env.schema';

/**
 * Configuração TypeORM: production-safe.
 * - synchronize sempre false — schema é controlado por migrations versionadas.
 * - Pool size configurável por env (DB_POOL_MAX).
 * - autoLoadEntities ligado para que cada módulo declare suas próprias entities.
 */
export const getDatabaseConfig = (
  config: ConfigService<Env, true>,
): TypeOrmModuleOptions => {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  return {
    type: 'postgres',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USERNAME', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_DATABASE', { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: nodeEnv !== 'test',
    logging: nodeEnv === 'development' ? ['warn', 'error', 'migration'] : ['error'],
    extra: { max: config.get('DB_POOL_MAX', { infer: true }) },
  };
};
