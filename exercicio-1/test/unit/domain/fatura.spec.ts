import { FaturaStatus } from '../../../src/cobranca/domain/enums/fatura-status.enum';
import {
  InvalidStatusTransitionException,
  InvalidVencimentoException,
} from '../../../src/cobranca/domain/exceptions/domain.exceptions';
import { makeFatura } from '../../support/factories';

describe('Fatura (aggregate)', () => {
  it('rejeita dataVencimento fora de YYYY-MM-DD', () => {
    expect(() => makeFatura({ dataVencimento: '01/01/2026' })).toThrow(
      InvalidVencimentoException,
    );
  });

  it('etag muda quando updatedAt muda', () => {
    const f = makeFatura();
    const etag1 = f.etag();
    f.mudarStatus(FaturaStatus.PAGA, new Date(f.updatedAt.getTime() + 1000));
    expect(f.etag()).not.toBe(etag1);
  });

  it('anexarLembretes é acessível via getter', () => {
    const f = makeFatura();
    expect(f.lembretes).toHaveLength(0);
  });

  it('expõe todas as propriedades via getters', () => {
    const f = makeFatura({ nomeDevedor: 'João', descricao: 'Teste props' });
    expect(f.nomeDevedor).toBe('João');
    expect(f.descricao).toBe('Teste props');
    expect(f.timezone).toBe('America/Sao_Paulo');
    expect(f.userId).toBeDefined();
    expect(f.emailDevedor.toString()).toBe('maria@example.com');
  });

  describe('state machine', () => {
    it('permite PENDENTE → PAGA', () => {
      const f = makeFatura();
      f.mudarStatus(FaturaStatus.PAGA, new Date());
      expect(f.status).toBe(FaturaStatus.PAGA);
    });

    it('permite PENDENTE → CANCELADA', () => {
      const f = makeFatura();
      f.mudarStatus(FaturaStatus.CANCELADA, new Date());
      expect(f.status).toBe(FaturaStatus.CANCELADA);
    });

    it('permite PENDENTE → VENCIDA', () => {
      const f = makeFatura();
      f.mudarStatus(FaturaStatus.VENCIDA, new Date());
      expect(f.status).toBe(FaturaStatus.VENCIDA);
    });

    it('permite VENCIDA → PAGA', () => {
      const f = makeFatura();
      f.mudarStatus(FaturaStatus.VENCIDA, new Date());
      f.mudarStatus(FaturaStatus.PAGA, new Date());
      expect(f.status).toBe(FaturaStatus.PAGA);
    });

    it('permite VENCIDA → CANCELADA', () => {
      const f = makeFatura();
      f.mudarStatus(FaturaStatus.VENCIDA, new Date());
      f.mudarStatus(FaturaStatus.CANCELADA, new Date());
      expect(f.status).toBe(FaturaStatus.CANCELADA);
    });

    it.each([
      [FaturaStatus.PAGA, FaturaStatus.CANCELADA],
      [FaturaStatus.PAGA, FaturaStatus.PENDENTE],
      [FaturaStatus.PAGA, FaturaStatus.VENCIDA],
      [FaturaStatus.CANCELADA, FaturaStatus.PAGA],
      [FaturaStatus.CANCELADA, FaturaStatus.PENDENTE],
      [FaturaStatus.CANCELADA, FaturaStatus.VENCIDA],
      [FaturaStatus.VENCIDA, FaturaStatus.PENDENTE],
    ])('rejeita transição %s → %s', (inicial, alvo) => {
      const f = makeFatura();
      f.mudarStatus(inicial, new Date());
      expect(() => f.mudarStatus(alvo, new Date())).toThrow(InvalidStatusTransitionException);
    });
  });
});
