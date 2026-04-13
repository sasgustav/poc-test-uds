import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USERNAME', 'cobranca_user'),
  password: configService.get<string>('DB_PASSWORD', 'cobranca_pass'),
  database: configService.get<string>('DB_DATABASE', 'cobranca_db'),
  autoLoadEntities: true,
  /**
   * synchronize: true apenas em desenvolvimento.
   * Em produção, utilizar migrations para controle de schema.
   */
  synchronize: configService.get<string>('NODE_ENV') !== 'production',
  logging: configService.get<string>('NODE_ENV') === 'development',
});
