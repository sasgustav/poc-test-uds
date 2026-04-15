import type { Fatura } from '../../src/cobranca/domain/entities/fatura';
import type { Lembrete } from '../../src/cobranca/domain/entities/lembrete';
import type {
  FaturaRepository,
  ListarFaturasOptions,
  Paginated,
} from '../../src/cobranca/domain/ports/fatura.repository';
import type { LembreteRepository } from '../../src/cobranca/domain/ports/lembrete.repository';
import type {
  OutboxEventRecord,
  OutboxRepository,
} from '../../src/cobranca/domain/ports/outbox.repository';
import type {
  TransactionalContext,
  UnitOfWork,
} from '../../src/cobranca/domain/ports/unit-of-work.port';

export class InMemoryFaturaRepository implements FaturaRepository {
  readonly store = new Map<string, Fatura>();

  async salvar(f: Fatura): Promise<void> {
    this.store.set(f.id, f);
  }
  async buscarPorId(id: string): Promise<Fatura | null> {
    return this.store.get(id) ?? null;
  }
  async buscarPorIdDoUsuario(id: string, userId: string): Promise<Fatura | null> {
    const f = this.store.get(id);
    return f?.userId === userId ? f : null;
  }
  async listarPorUsuario(opts: ListarFaturasOptions): Promise<Paginated<Fatura>> {
    const all = [...this.store.values()].filter((f) => f.userId === opts.userId);
    const start = (opts.page - 1) * opts.pageSize;
    return { items: all.slice(start, start + opts.pageSize), total: all.length };
  }
}

export class InMemoryLembreteRepository implements LembreteRepository {
  readonly store = new Map<string, Lembrete>();

  async salvarVarios(ls: Lembrete[]): Promise<void> {
    for (const l of ls) this.store.set(l.id, l);
  }
  async atualizar(l: Lembrete): Promise<void> {
    this.store.set(l.id, l);
  }
  async buscarProntosParaEnvio(limit: number): Promise<Lembrete[]> {
    const now = Date.now();
    return [...this.store.values()]
      .filter(
        (l) =>
          l.status === 'pendente' &&
          l.proximaTentativa !== null &&
          l.proximaTentativa.getTime() <= now,
      )
      .slice(0, limit);
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  readonly store: (OutboxEventRecord & { processed: boolean; erro?: string })[] = [];

  async registrar(r: OutboxEventRecord): Promise<void> {
    this.store.push({ ...r, processed: false });
  }
  async buscarNaoProcessados(limit: number): Promise<OutboxEventRecord[]> {
    return this.store.filter((r) => !r.processed).slice(0, limit);
  }
  async marcarProcessado(id: string): Promise<void> {
    const r = this.store.find((x) => x.id === id);
    if (r) r.processed = true;
  }
  async marcarFalha(id: string, erro: string): Promise<void> {
    const r = this.store.find((x) => x.id === id);
    if (r) r.erro = erro;
  }
  async contarPendentes(): Promise<number> {
    return this.store.filter((r) => !r.processed).length;
  }
}

/** Fake UoW que simula commit atômico via staging. */
export class FakeUnitOfWork implements UnitOfWork {
  constructor(
    readonly faturas: InMemoryFaturaRepository,
    readonly lembretes: InMemoryLembreteRepository,
    readonly outbox: InMemoryOutboxRepository,
  ) {}

  async executar<T>(fn: (ctx: TransactionalContext) => Promise<T>): Promise<T> {
    const stagedF: Fatura[] = [];
    const stagedL: Lembrete[] = [];
    const stagedO: OutboxEventRecord[] = [];
    const ctx: TransactionalContext = {
      faturas: {
        salvar: async (f) => void stagedF.push(f),
        buscarPorId: this.faturas.buscarPorId.bind(this.faturas),
        buscarPorIdDoUsuario: this.faturas.buscarPorIdDoUsuario.bind(this.faturas),
        listarPorUsuario: this.faturas.listarPorUsuario.bind(this.faturas),
      },
      lembretes: {
        salvarVarios: async (ls) => void stagedL.push(...ls),
        atualizar: async (l) => void stagedL.push(l),
        buscarProntosParaEnvio: this.lembretes.buscarProntosParaEnvio.bind(this.lembretes),
      },
      outbox: {
        registrar: async (r) => void stagedO.push(r),
        buscarNaoProcessados: this.outbox.buscarNaoProcessados.bind(this.outbox),
        marcarProcessado: this.outbox.marcarProcessado.bind(this.outbox),
        marcarFalha: this.outbox.marcarFalha.bind(this.outbox),
        contarPendentes: this.outbox.contarPendentes.bind(this.outbox),
      },
    };
    const result = await fn(ctx);
    // commit
    for (const f of stagedF) await this.faturas.salvar(f);
    for (const l of stagedL) this.lembretes.store.set(l.id, l);
    for (const r of stagedO) await this.outbox.registrar(r);
    return result;
  }
}
