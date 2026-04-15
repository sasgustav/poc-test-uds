import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Fatura } from '../../domain/entities/fatura';
import { Lembrete } from '../../domain/entities/lembrete';
import {
  FATURA_CRIADA_EVENT,
  FaturaCriadaEventPayload,
} from '../../domain/events/fatura-criada.event';
import type { Clock } from '../../domain/ports/clock.port';
import { CLOCK, UNIT_OF_WORK } from '../../domain/ports/tokens';
import type { UnitOfWork } from '../../domain/ports/unit-of-work.port';
import { Email } from '../../domain/value-objects/email';
import { Money } from '../../domain/value-objects/money';
import { ReguaCalculator } from '../services/regua-calculator';

export interface CriarFaturaInput {
  userId: string;
  nomeDevedor: string;
  emailDevedor: string;
  descricao: string;
  /** Decimal em reais (será convertido para centavos). */
  valor: number;
  dataVencimento: string;
  timezone?: string;
}

@Injectable()
export class CriarFaturaUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly regua: ReguaCalculator,
  ) {}

  async executar(input: CriarFaturaInput, defaultTimezone: string): Promise<Fatura> {
    const now = this.clock.now();
    const timezone = input.timezone ?? defaultTimezone;

    const fatura = Fatura.criar({
      id: randomUUID(),
      userId: input.userId,
      nomeDevedor: input.nomeDevedor.trim(),
      emailDevedor: Email.of(input.emailDevedor),
      descricao: input.descricao.trim(),
      valor: Money.fromDecimal(input.valor),
      dataVencimento: input.dataVencimento,
      timezone,
      now,
    });

    const envios = this.regua.calcularEnvios(input.dataVencimento, timezone);
    const lembretes = envios.map((e) =>
      Lembrete.criar({
        id: randomUUID(),
        faturaId: fatura.id,
        tipo: e.tipo,
        dataEnvio: e.dataEnvio,
        now,
      }),
    );
    fatura.anexarLembretes(lembretes);

    await this.uow.executar(async (ctx) => {
      await ctx.faturas.salvar(fatura);
      await ctx.lembretes.salvarVarios(lembretes);

      const payload: FaturaCriadaEventPayload = {
        faturaId: fatura.id,
        userId: fatura.userId,
        valorCents: fatura.valor.cents,
        currency: 'BRL',
        dataVencimento: fatura.dataVencimento,
        timezone: fatura.timezone,
        occurredAt: now.toISOString(),
      };
      await ctx.outbox.registrar({
        id: randomUUID(),
        aggregateId: fatura.id,
        eventType: FATURA_CRIADA_EVENT,
        payload: payload as unknown as Record<string, unknown>,
        occurredAt: now,
      });
    });

    return fatura;
  }
}
