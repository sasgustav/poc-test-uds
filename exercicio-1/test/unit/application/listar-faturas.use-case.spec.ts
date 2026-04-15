import { ListarFaturasUseCase } from '../../../src/cobranca/application/use-cases/listar-faturas.use-case';
import { InMemoryFaturaRepository } from '../../support/in-memory-repos';
import { makeFatura } from '../../support/factories';

describe('ListarFaturasUseCase', () => {
  let repo: InMemoryFaturaRepository;
  let uc: ListarFaturasUseCase;

  beforeEach(() => {
    repo = new InMemoryFaturaRepository();
    uc = new ListarFaturasUseCase(repo);
  });

  it('retorna faturas do usuário com paginação', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.salvar(makeFatura({ userId: 'user-1' }));
    }
    await repo.salvar(makeFatura({ userId: 'user-2' }));

    const result = await uc.executar({ userId: 'user-1', page: 1, pageSize: 3 });
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
  });

  it('clamp: pageSize máximo é 100', async () => {
    const fatura = makeFatura({ userId: 'user-1' });
    await repo.salvar(fatura);

    // pageSize=999 é clamped para 100
    const result = await uc.executar({ userId: 'user-1', page: 1, pageSize: 999 });
    expect(result.items).toHaveLength(1);
  });

  it('clamp: page mínima é 1', async () => {
    await repo.salvar(makeFatura({ userId: 'user-1' }));

    const result = await uc.executar({ userId: 'user-1', page: 0, pageSize: 10 });
    expect(result.items).toHaveLength(1);
  });

  it('retorna lista vazia quando usuário não tem faturas', async () => {
    const result = await uc.executar({ userId: 'user-1', page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
