import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { FaturaOrmEntity } from './entities/fatura.orm-entity';
import { IdempotencyKeyOrmEntity } from './entities/idempotency-key.orm-entity';
import { LembreteOrmEntity } from './entities/lembrete.orm-entity';
import { OutboxOrmEntity } from './entities/outbox.orm-entity';

config();

/**
 * DataSource standalone para o CLI do typeorm-ts-node-commonjs.
 * Utilizado pelos scripts: migration:generate / migration:run / migration:revert.
 * A aplicação em runtime usa TypeOrmModule.forRootAsync em app.module.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  username: process.env['DB_USERNAME'] ?? 'cobranca_user',
  password: process.env['DB_PASSWORD'] ?? 'cobranca_pass',
  database: process.env['DB_DATABASE'] ?? 'cobranca_db',
  entities: [FaturaOrmEntity, LembreteOrmEntity, OutboxOrmEntity, IdempotencyKeyOrmEntity],
  // eslint-disable-next-line unicorn/prefer-module -- TypeORM CLI runs via typeorm-ts-node-commonjs (CJS)
  migrations: [__dirname + '/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env['NODE_ENV'] === 'development',
});
