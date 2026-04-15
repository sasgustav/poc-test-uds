import type { FaturaRepository } from './fatura.repository';
import type { LembreteRepository } from './lembrete.repository';
import type { OutboxRepository } from './outbox.repository';

/**
 * Unit of Work — garante que múltiplos repositórios operem na mesma transação.
 *
 * Senior rationale: sem isto, outbox + fatura poderiam commitar em transações
 * diferentes, quebrando a atomicidade que é a razão de existir do pattern.
 */
export interface TransactionalContext {
  faturas: FaturaRepository;
  lembretes: LembreteRepository;
  outbox: OutboxRepository;
}

export interface UnitOfWork {
  executar<T>(work: (ctx: TransactionalContext) => Promise<T>): Promise<T>;
}
