import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  IdempotencyRecord,
  IdempotencyRepository,
} from '../../../../domain/ports/idempotency.repository';
import { IdempotencyKeyOrmEntity } from '../entities/idempotency-key.orm-entity';

@Injectable()
export class IdempotencyTypeOrmRepository implements IdempotencyRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async buscar(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.ds
      .getRepository(IdempotencyKeyOrmEntity)
      .findOne({ where: { key } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return {
      key: row.key,
      requestHash: row.requestHash,
      statusCode: row.statusCode,
      responseBody: row.responseBody,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  async registrar(record: IdempotencyRecord): Promise<void> {
    await this.ds.getRepository(IdempotencyKeyOrmEntity).upsert(
      {
        key: record.key,
        requestHash: record.requestHash,
        statusCode: record.statusCode,
        responseBody: record.responseBody as object,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
      ['key'],
    );
  }
}
