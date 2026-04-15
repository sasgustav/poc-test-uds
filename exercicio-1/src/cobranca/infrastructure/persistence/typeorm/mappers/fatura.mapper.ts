import { Fatura } from '../../../../domain/entities/fatura';
import { Email } from '../../../../domain/value-objects/email';
import { Money } from '../../../../domain/value-objects/money';
import { FaturaOrmEntity } from '../entities/fatura.orm-entity';
import { LembreteMapper } from './lembrete.mapper';

export const FaturaMapper = {
  toDomain(orm: FaturaOrmEntity): Fatura {
    const fatura = Fatura.reconstruir({
      id: orm.id,
      userId: orm.userId,
      nomeDevedor: orm.nomeDevedor,
      emailDevedor: Email.of(orm.emailDevedor),
      descricao: orm.descricao,
      valor: Money.fromCents(Number(orm.valorCents), orm.currency),
      dataVencimento: orm.dataVencimento,
      timezone: orm.timezone,
      status: orm.status,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
      lembretes: [],
    });
    if (orm.lembretes && orm.lembretes.length > 0) {
      fatura.anexarLembretes(orm.lembretes.map((l) => LembreteMapper.toDomain(l)));
    }
    return fatura;
  },

  toOrm(fatura: Fatura): FaturaOrmEntity {
    const orm = new FaturaOrmEntity();
    orm.id = fatura.id;
    orm.userId = fatura.userId;
    orm.nomeDevedor = fatura.nomeDevedor;
    orm.emailDevedor = fatura.emailDevedor.value;
    orm.descricao = fatura.descricao;
    orm.valorCents = fatura.valor.cents.toString();
    orm.currency = fatura.valor.currency;
    orm.dataVencimento = fatura.dataVencimento;
    orm.timezone = fatura.timezone;
    orm.status = fatura.status;
    orm.createdAt = fatura.createdAt;
    orm.updatedAt = fatura.updatedAt;
    return orm;
  },
};
