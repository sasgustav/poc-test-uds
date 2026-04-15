import { randomUUID } from 'node:crypto';
import { AtualizarStatusFaturaUseCase } from '../../../src/cobranca/application/use-cases/atualizar-status.use-case';
import { FaturaStatus } from '../../../src/cobranca/domain/enums/fatura-status.enum';
import {
  FaturaNotFoundException,
  InvalidStatusTransitionException,
} from '../../../src/cobranca/domain/exceptions/domain.exceptions';
import { makeFatura } from '../../support/factories';
import { InMemoryFaturaRepository } from '../../support/in-memory-repos';

const clock = { now: () => new Date('2026-05-10T12:00:00Z') };

describe('AtualizarStatusFaturaUseCase', () => {
  let repo: InMemoryFaturaRepository;
  let uc: AtualizarStatusFaturaUseCase;

  beforeEach(() => {
    repo = new InMemoryFaturaRepository();
    uc = new AtualizarStatusFaturaUseCase(repo, clock);
  });

  it('nega acesso a fatura de outro tenant (FaturaNotFound)', async () => {
    const f = makeFatura({ userId: 'user-A' });
    await repo.salvar(f);
    await expect(uc.executar(f.id, 'user-B', FaturaStatus.PAGA)).rejects.toThrow(
      FaturaNotFoundException,
    );
  });

  it('rejeita transição inválida PAGA → CANCELADA', async () => {
    const userId = randomUUID();
    const f = makeFatura({ userId });
    f.mudarStatus(FaturaStatus.PAGA, new Date());
    await repo.salvar(f);
    await expect(uc.executar(f.id, userId, FaturaStatus.CANCELADA)).rejects.toThrow(
      InvalidStatusTransitionException,
    );
  });

  it('aplica transição válida e persiste', async () => {
    const userId = randomUUID();
    const f = makeFatura({ userId });
    await repo.salvar(f);
    const updated = await uc.executar(f.id, userId, FaturaStatus.PAGA);
    expect(updated.status).toBe(FaturaStatus.PAGA);
    expect((await repo.buscarPorId(f.id))!.status).toBe(FaturaStatus.PAGA);
  });
});
