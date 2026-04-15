import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Lembrete } from '../../../../domain/entities/lembrete';
import { LembreteStatus } from '../../../../domain/enums/lembrete-status.enum';
import type { LembreteRepository } from '../../../../domain/ports/lembrete.repository';
import { LembreteOrmEntity } from '../entities/lembrete.orm-entity';
import { LembreteMapper } from '../mappers/lembrete.mapper';

@Injectable()
export class LembreteTypeOrmRepository implements LembreteRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async salvarVarios(lembretes: Lembrete[]): Promise<void> {
    if (lembretes.length === 0) return;
    await this.ds
      .getRepository(LembreteOrmEntity)
      .insert(lembretes.map((l) => LembreteMapper.toOrm(l)));
  }

  async atualizar(lembrete: Lembrete): Promise<void> {
    const orm = LembreteMapper.toOrm(lembrete);
    await this.ds
      .getRepository(LembreteOrmEntity)
      .update({ id: orm.id }, orm);
  }

  /**
   * SELECT ... FOR UPDATE SKIP LOCKED — a join entre `pessimistic_write` e
   * o status/proximaTentativa garante que dois workers concorrentes nunca
   * processem o mesmo lembrete. Combina com pg_advisory_xact_lock no scheduler
   * para defense-in-depth contra duplicidade.
   */
  async buscarProntosParaEnvio(limit: number): Promise<Lembrete[]> {
    return this.ds.transaction(async (m) => {
      const rows = await m
        .getRepository(LembreteOrmEntity)
        .createQueryBuilder('lembrete')
        .leftJoinAndSelect('lembrete.fatura', 'fatura')
        .setLock('pessimistic_write', undefined, ['lembrete'])
        .setOnLocked('skip_locked')
        .where('lembrete.status = :status', { status: LembreteStatus.PENDENTE })
        .andWhere('(lembrete.proximaTentativa IS NULL OR lembrete.proximaTentativa <= NOW())')
        .orderBy('lembrete.proximaTentativa', 'ASC', 'NULLS FIRST')
        .limit(limit)
        .getMany();
      return rows.map((l) => LembreteMapper.toDomain(l));
    });
  }
}
