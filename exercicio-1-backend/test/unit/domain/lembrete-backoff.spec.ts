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

  it('trunca erroMsg para 2000 caracteres', () => {
    const l = newLembrete();
    const longErr = 'x'.repeat(3000);
    l.marcarFalha({ erro: longErr, now: new Date(), maxAttempts: 5 });
    expect(l.erroMsg!.length).toBe(2000);
  });
});

describe('Lembrete state guards', () => {
  it('marcarEnviado rejeita quando status é ENVIADO', () => {
    const l = newLembrete();
    l.marcarEnviado(new Date());
    expect(() => l.marcarEnviado(new Date())).toThrow(/não pode marcar como enviado/);
  });

  it('marcarEnviado rejeita quando status é FALHOU', () => {
    const l = newLembrete();
    for (let i = 0; i < 5; i++) {
      l.marcarFalha({ erro: 'fail', now: new Date(), maxAttempts: 5 });
    }
    expect(l.status).toBe(LembreteStatus.FALHOU);
    expect(() => l.marcarEnviado(new Date())).toThrow(/não pode marcar como enviado/);
  });

  it('marcarFalha rejeita quando status é ENVIADO', () => {
    const l = newLembrete();
    l.marcarEnviado(new Date());
    expect(() =>
      l.marcarFalha({ erro: 'x', now: new Date(), maxAttempts: 5 }),
    ).toThrow(/não pode marcar falha/);
  });

  it('marcarFalha rejeita quando status é DESCARTADO', () => {
    const l = newLembrete();
    l.descartar(new Date());
    expect(() =>
      l.marcarFalha({ erro: 'x', now: new Date(), maxAttempts: 5 }),
    ).toThrow(/não pode marcar falha/);
  });
});

describe('Lembrete descartar()', () => {
  it('transiciona PENDENTE → DESCARTADO', () => {
    const l = newLembrete();
    const now = new Date('2026-05-01T10:00:00Z');
    l.descartar(now);
    expect(l.status).toBe(LembreteStatus.DESCARTADO);
    expect(l.processadoEm).toEqual(now);
    expect(l.proximaTentativa).toBeNull();
  });

  it('rejeita descartar quando já ENVIADO', () => {
    const l = newLembrete();
    l.marcarEnviado(new Date());
    expect(() => l.descartar(new Date())).toThrow(/não pode descartar/);
  });

  it('rejeita descartar quando já FALHOU', () => {
    const l = newLembrete();
    for (let i = 0; i < 5; i++) {
      l.marcarFalha({ erro: 'fail', now: new Date(), maxAttempts: 5 });
    }
    expect(() => l.descartar(new Date())).toThrow(/não pode descartar/);
  });
});

describe('Lembrete reconstruir()', () => {
  it('reconstrói com propriedades preservadas', () => {
    const l = Lembrete.reconstruir({
      id: 'l-2',
      faturaId: 'f-2',
      tipo: LembreteTipo.D_MAIS_1,
      dataEnvio: new Date('2026-06-01T09:00:00Z'),
      status: LembreteStatus.ENVIADO,
      tentativas: 1,
      erroMsg: null,
      processadoEm: new Date('2026-06-01T09:01:00Z'),
      proximaTentativa: null,
      createdAt: new Date('2026-05-20T00:00:00Z'),
    });
    expect(l.id).toBe('l-2');
    expect(l.status).toBe(LembreteStatus.ENVIADO);
    expect(l.tentativas).toBe(1);
    expect(l.dataEnvio).toEqual(new Date('2026-06-01T09:00:00Z'));
  });
});
