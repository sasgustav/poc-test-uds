import fc from 'fast-check';
import { Lembrete } from '../../../src/cobranca/domain/entities/lembrete';
import { LembreteStatus } from '../../../src/cobranca/domain/enums/lembrete-status.enum';
import { LembreteTipo } from '../../../src/cobranca/domain/enums/lembrete-tipo.enum';

function newLembrete(): Lembrete {
  return Lembrete.criar({
    id: 'l-1',
    faturaId: 'f-1',
    tipo: LembreteTipo.D_MENOS_3,
    dataEnvio: new Date('2026-05-01T09:00:00Z'),
    now: new Date('2026-04-20T00:00:00Z'),
  });
}

describe('Lembrete backoff + DLQ', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('move para FALHOU após maxAttempts', () => {
    const l = newLembrete();
    for (let i = 0; i < 5; i++) {
      l.marcarFalha({ erro: 'smtp down', now: new Date(), maxAttempts: 5 });
    }
    expect(l.status).toBe(LembreteStatus.FALHOU);
    expect(l.proximaTentativa).toBeNull();
  });

  it('property: proximaTentativa <= cap (60s) + now', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (attempts) => {
        const l = newLembrete();
        const base = new Date('2026-05-01T00:00:00Z');
        for (let i = 0; i < attempts; i++) {
          l.marcarFalha({ erro: 'x', now: base, maxAttempts: 5 });
        }
        if (l.proximaTentativa) {
          const delay = l.proximaTentativa.getTime() - base.getTime();
          expect(delay).toBeGreaterThanOrEqual(0);
          expect(delay).toBeLessThanOrEqual(60_000);
        }
      }),
    );
  });

  it('marcarEnviado limpa estado de erro', () => {
    const l = newLembrete();
    l.marcarFalha({ erro: 'boom', now: new Date(), maxAttempts: 5 });
    l.marcarEnviado(new Date());
    expect(l.status).toBe(LembreteStatus.ENVIADO);
    expect(l.erroMsg).toBeNull();
    expect(l.proximaTentativa).toBeNull();
  });
});
