import type { Fatura } from '../entities/fatura';

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface ListarFaturasOptions {
  userId: string;
  page: number;
  pageSize: number;
}

export interface FaturaRepository {
  salvar(fatura: Fatura): Promise<void>;
  /**
   * Busca escopada por tenant (userId). Tenant isolation é invariante de
   * domínio — o mesmo anti-pattern auditado no Exercício 2 é prevenido aqui
   * por contrato de port: impossível chamar sem userId do contexto autenticado.
   */
  buscarPorIdDoUsuario(id: string, userId: string): Promise<Fatura | null>;
  /** Versão sem escopo de tenant. Uso restrito: schedulers/outbox em background. */
  buscarPorId(id: string): Promise<Fatura | null>;
  listarPorUsuario(opts: ListarFaturasOptions): Promise<Paginated<Fatura>>;
}
