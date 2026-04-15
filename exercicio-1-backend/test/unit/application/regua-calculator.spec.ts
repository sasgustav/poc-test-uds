import fc from 'fast-check';
import { DateTime } from 'luxon';
import { ReguaCalculator } from '../../../src/cobranca/application/services/regua-calculator';
import { LembreteTipo } from '../../../src/cobranca/domain/enums/lembrete-tipo.enum';

describe('ReguaCalculator', () => {
  const calc = new ReguaCalculator();

  it('calcula D-3, D+1, D+7 às 09:00 no TZ do devedor', () => {
    const envios = calc.calcularEnvios('2026-05-15', 'America/Sao_Paulo');
    const byTipo = Object.fromEntries(envios.map((e) => [e.tipo, e.dataEnvio]));

    const assert = (tipo: LembreteTipo, expectedISO: string) => {
      const d = DateTime.fromJSDate(byTipo[tipo]!).setZone('America/Sao_Paulo');
      expect(d.toFormat('yyyy-LL-dd HH:mm')).toBe(expectedISO);
    };
    assert(LembreteTipo.D_MENOS_3, '2026-05-12 09:00');
    assert(LembreteTipo.D_MAIS_1, '2026-05-16 09:00');
    assert(LembreteTipo.D_MAIS_7, '2026-05-22 09:00');
  });

  it('respeita TZ distinto (America/Manaus sem DST, −04)', () => {
    const envios = calc.calcularEnvios('2026-05-15', 'America/Manaus');
    const d = DateTime.fromJSDate(envios[0]!.dataEnvio).setZone('America/Manaus');
    expect(d.hour).toBe(9);
    expect(d.offset).toBe(-240);
  });

  it('property: sempre 3 envios, sempre às 09:00 local', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') }),
        fc.constantFrom('America/Sao_Paulo', 'UTC', 'America/Manaus', 'America/Noronha'),
        (d, tz) => {
          const iso = DateTime.fromJSDate(d).toFormat('yyyy-LL-dd');
          const envios = calc.calcularEnvios(iso, tz);
          expect(envios).toHaveLength(3);
          for (const e of envios) {
            expect(DateTime.fromJSDate(e.dataEnvio).setZone(tz).hour).toBe(9);
          }
        },
      ),
    );
  });
});
