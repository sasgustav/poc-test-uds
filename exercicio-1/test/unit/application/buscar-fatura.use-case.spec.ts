import { BuscarFaturaUseCase } from '../../../src/cobranca/application/use-cases/buscar-fatura.use-case';
import { FaturaNotFoundException } from '../../../src/cobranca/domain/exceptions/domain.exceptions';
import { makeFatura } from '../../support/factories';
import { InMemoryFaturaRepository } from '../../support/in-memory-repos';

describe('BuscarFaturaUseCase', () => {
  let repo: InMemoryFaturaRepository;
  let uc: BuscarFaturaUseCase;

  beforeEach(() => {
    repo = new InMemoryFaturaRepository();
    uc = new BuscarFaturaUseCase(repo);
  });

  it('retorna fatura existente do usuário', async () => {
    const fatura = makeFatura({ userId: 'user-1', id: 'f-1' });
    await repo.salvar(fatura);

    const result = await uc.executar('f-1', 'user-1');
    expect(result.id).toBe('f-1');
  });

  it('lança FaturaNotFoundException quando fatura não existe', async () => {
    await expect(uc.executar('inexistente', 'user-1')).rejects.toThrow(
      FaturaNotFoundException,
    );
  });

  it('lança FaturaNotFoundException quando fatura pertence a outro tenant', async () => {
    const fatura = makeFatura({ userId: 'user-1', id: 'f-1' });
    await repo.salvar(fatura);

    await expect(uc.executar('f-1', 'user-outro')).rejects.toThrow(
      FaturaNotFoundException,
    );
  });
});
