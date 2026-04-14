import { randomUUID } from 'node:crypto';
import { ReguaCalculator } from '../../../src/cobranca/application/services/regua-calculator';
import { CriarFaturaUseCase } from '../../../src/cobranca/application/use-cases/criar-fatura.use-case';
import { FATURA_CRIADA_EVENT } from '../../../src/cobranca/domain/events/fatura-criada.event';
import type { Clock } from '../../../src/cobranca/domain/ports/clock.port';
import {
  FakeUnitOfWork,
  InMemoryFaturaRepository,
  InMemoryLembreteRepository,
  InMemoryOutboxRepository,
} from '../../support/in-memory-repos';

const NOW = new Date('2026-05-01T12:00:00Z');
const clock: Clock = { now: () => NOW };

describe('CriarFaturaUseCase', () => {
  let faturas: InMemoryFaturaRepository;
  let lembretes: InMemoryLembreteRepository;
  let outbox: InMemoryOutboxRepository;
  let uow: FakeUnitOfWork;
  let useCase: CriarFaturaUseCase;

  beforeEach(() => {
    faturas = new InMemoryFaturaRepository();
    lembretes = new InMemoryLembreteRepository();
    outbox = new InMemoryOutboxRepository();
    uow = new FakeUnitOfWork(faturas, lembretes, outbox);
    useCase = new CriarFaturaUseCase(uow, clock, new ReguaCalculator());
  });

  it('persiste fatura + 3 lembretes + evento outbox atomicamente', async () => {
    const userId = randomUUID();
    const f = await useCase.executar(
      {
        userId,
        nomeDevedor: 'Maria Silva',
        emailDevedor: 'maria@example.com',
        descricao: 'Fatura',
        valor: 150.5,
        dataVencimento: '2026-06-01',
      },
      'America/Sao_Paulo',
    );

    expect(faturas.store.size).toBe(1);
    expect(lembretes.store.size).toBe(3);
    expect(outbox.store).toHaveLength(1);
    expect(outbox.store[0]!.eventType).toBe(FATURA_CRIADA_EVENT);
    expect(outbox.store[0]!.aggregateId).toBe(f.id);
    expect(f.valor.cents).toBe(15_050);
  });

  it('rollback: se UoW falha, nada é persistido', async () => {
    const failingUow = {
      executar: async () => {
        throw new Error('DB timeout');
      },
    };
    useCase = new CriarFaturaUseCase(failingUow as never, clock, new ReguaCalculator());
    await expect(
      useCase.executar(
        {
          userId: randomUUID(),
          nomeDevedor: 'X',
          emailDevedor: 'x@y.com',
          descricao: 'desc',
          valor: 10,
          dataVencimento: '2026-06-01',
        },
        'America/Sao_Paulo',
      ),
    ).rejects.toThrow('DB timeout');
    expect(faturas.store.size).toBe(0);
    expect(lembretes.store.size).toBe(0);
    expect(outbox.store).toHaveLength(0);
  });
});
