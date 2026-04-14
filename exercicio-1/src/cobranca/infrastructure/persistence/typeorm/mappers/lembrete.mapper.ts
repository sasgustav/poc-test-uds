import { Lembrete } from '../../../../domain/entities/lembrete';
import { LembreteOrmEntity } from '../entities/lembrete.orm-entity';

export const LembreteMapper = {
  toDomain(orm: LembreteOrmEntity): Lembrete {
    return Lembrete.reconstruir({
      id: orm.id,
      faturaId: orm.faturaId,
      dataEnvio: orm.dataEnvio,
      tipo: orm.tipo,
      status: orm.status,
      tentativas: orm.tentativas,
      erroMsg: orm.erroMsg,
      processadoEm: orm.processadoEm,
      proximaTentativa: orm.proximaTentativa,
      createdAt: orm.createdAt,
    });
  },

  toOrm(lembrete: Lembrete): LembreteOrmEntity {
    const orm = new LembreteOrmEntity();
    orm.id = lembrete.id;
    orm.faturaId = lembrete.faturaId;
    orm.dataEnvio = lembrete.dataEnvio;
    orm.tipo = lembrete.tipo;
    orm.status = lembrete.status;
    orm.tentativas = lembrete.tentativas;
    orm.erroMsg = lembrete.erroMsg;
    orm.processadoEm = lembrete.processadoEm;
    orm.proximaTentativa = lembrete.proximaTentativa;
    orm.createdAt = lembrete.createdAt;
    return orm;
  },
};
