import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Fatura } from '../../../../domain/entities/fatura';
import type {
  FaturaRepository,
  ListarFaturasOptions,
  Paginated,
} from '../../../../domain/ports/fatura.repository';
import { FaturaOrmEntity } from '../entities/fatura.orm-entity';
import { LembreteOrmEntity } from '../entities/lembrete.orm-entity';
import { FaturaMapper } from '../mappers/fatura.mapper';
import { LembreteMapper } from '../mappers/lembrete.mapper';

@Injectable()
export class FaturaTypeOrmRepository implements FaturaRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private manager(tx?: EntityManager): EntityManager {
    return tx ?? this.ds.manager;
  }

  async salvar(fatura: Fatura, tx?: EntityManager): Promise<void> {
    const m = this.manager(tx);
    const orm = FaturaMapper.toOrm(fatura);
    await m.upsert(FaturaOrmEntity, orm, ['id']);
  }

  async buscarPorId(id: string): Promise<Fatura | null> {
    const orm = await this.ds.getRepository(FaturaOrmEntity).findOne({
      where: { id },
      relations: ['lembretes'],
    });
    return orm ? FaturaMapper.toDomain(orm) : null;
  }

  async buscarPorIdDoUsuario(id: string, userId: string): Promise<Fatura | null> {
    const orm = await this.ds.getRepository(FaturaOrmEntity).findOne({
      where: { id, userId },
      relations: ['lembretes'],
    });
    return orm ? FaturaMapper.toDomain(orm) : null;
  }

  async listarPorUsuario(opts: ListarFaturasOptions): Promise<Paginated<Fatura>> {
    const repo = this.ds.getRepository(FaturaOrmEntity);
    const qb = repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.lembretes', 'l')
      .where('f.userId = :userId', { userId: opts.userId })
      .orderBy('f.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.pageSize)
      .take(opts.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => FaturaMapper.toDomain(r)),
      total,
    };
  }
}

/**
 * Repositório transacional — usado dentro do UnitOfWork.
 * Wrapper leve que pega o EntityManager da transação.
 */
export class FaturaTransactionalRepository implements FaturaRepository {
  constructor(private readonly manager: EntityManager) {}

  async salvar(fatura: Fatura): Promise<void> {
    await this.manager.upsert(FaturaOrmEntity, FaturaMapper.toOrm(fatura), ['id']);
  }

  async buscarPorId(id: string): Promise<Fatura | null> {
    const orm = await this.manager.findOne(FaturaOrmEntity, {
      where: { id },
      relations: ['lembretes'],
    });
    return orm ? FaturaMapper.toDomain(orm) : null;
  }

  async buscarPorIdDoUsuario(id: string, userId: string): Promise<Fatura | null> {
    const orm = await this.manager.findOne(FaturaOrmEntity, {
      where: { id, userId },
      relations: ['lembretes'],
    });
    return orm ? FaturaMapper.toDomain(orm) : null;
  }

  async listarPorUsuario(opts: ListarFaturasOptions): Promise<Paginated<Fatura>> {
    const [rows, total] = await this.manager.findAndCount(FaturaOrmEntity, {
      where: { userId: opts.userId },
      relations: ['lembretes'],
      order: { createdAt: 'DESC' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    });
    return { items: rows.map((r) => FaturaMapper.toDomain(r)), total };
  }
}

export class LembreteTransactionalRepository {
  constructor(private readonly manager: EntityManager) {}

  async salvarVarios(lembretes: ReturnType<typeof LembreteMapper.toDomain>[]): Promise<void> {
    if (lembretes.length === 0) return;
    const orms = lembretes.map((l) => LembreteMapper.toOrm(l));
    await this.manager.insert(LembreteOrmEntity, orms);
  }

  async atualizar(lembrete: ReturnType<typeof LembreteMapper.toDomain>): Promise<void> {
    await this.manager.update(LembreteOrmEntity, { id: lembrete.id }, LembreteMapper.toOrm(lembrete));
  }

  buscarProntosParaEnvio(): Promise<never[]> {
    return Promise.reject(new Error('Operação indisponível em contexto transacional; use LembreteTypeOrmRepository'));
  }
}
