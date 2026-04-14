import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  TransactionalContext,
  UnitOfWork,
} from '../../../domain/ports/unit-of-work.port';
import {
  FaturaTransactionalRepository,
  LembreteTransactionalRepository,
} from './repositories/fatura.repository.impl';
import { OutboxTransactionalRepository } from './repositories/outbox.repository.impl';

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async executar<T>(work: (ctx: TransactionalContext) => Promise<T>): Promise<T> {
    return this.ds.transaction('READ COMMITTED', async (manager) => {
      const ctx: TransactionalContext = {
        faturas: new FaturaTransactionalRepository(manager),
        lembretes: new LembreteTransactionalRepository(manager) as unknown as TransactionalContext['lembretes'],
        outbox: new OutboxTransactionalRepository(manager),
      };
      return work(ctx);
    });
  }
}
