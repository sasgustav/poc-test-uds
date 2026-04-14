import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import type {
  OutboxEventRecord,
  OutboxRepository,
} from '../../../../domain/ports/outbox.repository';
import { OutboxOrmEntity } from '../entities/outbox.orm-entity';

@Injectable()
export class OutboxTypeOrmRepository implements OutboxRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async registrar(event: OutboxEventRecord): Promise<void> {
    await this.ds.getRepository(OutboxOrmEntity).insert({
      id: event.id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: event.occurredAt,
      processedAt: null,
      attempts: 0,
      lastError: null,
    });
  }

  async buscarNaoProcessados(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.ds.getRepository(OutboxOrmEntity).find({
      where: { processedAt: IsNull() },
      order: { occurredAt: 'ASC' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      aggregateId: r.aggregateId,
      eventType: r.eventType,
      payload: r.payload as Record<string, unknown>,
      occurredAt: r.occurredAt,
    }));
  }

  async marcarProcessado(id: string): Promise<void> {
    await this.ds
      .getRepository(OutboxOrmEntity)
      .update({ id }, { processedAt: new Date(), lastError: null });
  }

  async marcarFalha(id: string, erro: string): Promise<void> {
    await this.ds
      .createQueryBuilder()
      .update(OutboxOrmEntity)
      .set({ attempts: () => 'attempts + 1', lastError: erro })
      .where({ id })
      .execute();
  }

  async contarPendentes(): Promise<number> {
    return this.ds
      .getRepository(OutboxOrmEntity)
      .count({ where: { processedAt: IsNull() } });
  }
}

export class OutboxTransactionalRepository implements OutboxRepository {
  constructor(private readonly manager: EntityManager) {}

  async registrar(event: OutboxEventRecord): Promise<void> {
    await this.manager.insert(OutboxOrmEntity, {
      id: event.id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: event.occurredAt,
      processedAt: null,
      attempts: 0,
      lastError: null,
    });
  }

  async buscarNaoProcessados(limit: number): Promise<OutboxEventRecord[]> {
    // eslint-disable-next-line unicorn/no-array-method-this-argument -- TypeORM EntityManager.find, not Array#find
    const rows = await this.manager.find(OutboxOrmEntity, {
      where: { processedAt: IsNull() },
      order: { occurredAt: 'ASC' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      aggregateId: r.aggregateId,
      eventType: r.eventType,
      payload: r.payload as Record<string, unknown>,
      occurredAt: r.occurredAt,
    }));
  }

  async marcarProcessado(id: string): Promise<void> {
    await this.manager.update(OutboxOrmEntity, { id }, { processedAt: new Date() });
  }

  async marcarFalha(id: string, erro: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(OutboxOrmEntity)
      .set({ attempts: () => 'attempts + 1', lastError: erro })
      .where({ id })
      .execute();
  }

  async contarPendentes(): Promise<number> {
    return this.manager.count(OutboxOrmEntity, { where: { processedAt: IsNull() } });
  }
}
