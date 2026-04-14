import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { LembreteTipo } from '../../domain/enums/lembrete-tipo.enum';
import { InvalidVencimentoException } from '../../domain/exceptions/domain.exceptions';

/**
 * Régua de cobranças: D-3, D+1, D+7 no TZ do devedor às REMINDER_HOUR.
 *
 * Senior rationale: timezone é bug latente #1 em software financeiro BR.
 * Luxon com IANA TZ elide "sumiu uma hora no DST". "09:00 local" é intenção
 * de negócio — não "09:00 UTC que vira 06:00 em SP".
 */
export interface ReguaOffset {
  tipo: LembreteTipo;
  dias: number;
}

export const REGUA_PADRAO: readonly ReguaOffset[] = Object.freeze([
  { tipo: LembreteTipo.D_MENOS_3, dias: -3 },
  { tipo: LembreteTipo.D_MAIS_1, dias: 1 },
  { tipo: LembreteTipo.D_MAIS_7, dias: 7 },
]);

@Injectable()
export class ReguaCalculator {
  constructor(
    private readonly offsets: readonly ReguaOffset[] = REGUA_PADRAO,
    private readonly reminderHour = 9,
  ) {}

  calcularEnvios(dataVencimento: string, timezone: string): { tipo: LembreteTipo; dataEnvio: Date }[] {
    const base = DateTime.fromISO(dataVencimento, { zone: timezone });
    if (!base.isValid) {
      throw new InvalidVencimentoException(
        `dataVencimento ou timezone inválidos: ${dataVencimento} @ ${timezone}`,
      );
    }
    return this.offsets.map((offset) => {
      const dt = base
        .plus({ days: offset.dias })
        .set({ hour: this.reminderHour, minute: 0, second: 0, millisecond: 0 });
      return { tipo: offset.tipo, dataEnvio: dt.toJSDate() };
    });
  }
}
