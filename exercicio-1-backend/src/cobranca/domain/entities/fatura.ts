import {
  FaturaStatus,
  FATURA_TRANSICOES_PERMITIDAS,
} from '../enums/fatura-status.enum';
import { LembreteTipo } from '../enums/lembrete-tipo.enum';
import {
  InvalidStatusTransitionException,
  InvalidVencimentoException,
} from '../exceptions/domain.exceptions';
import type { Email } from '../value-objects/email';
import type { Money } from '../value-objects/money';
import type { Lembrete } from './lembrete';

export interface FaturaProps {
  id: string;
  userId: string;
  nomeDevedor: string;
  emailDevedor: Email;
  descricao: string;
  valor: Money;
  dataVencimento: string; // ISO YYYY-MM-DD
  timezone: string;
  status: FaturaStatus;
  createdAt: Date;
  updatedAt: Date;
  lembretes: Lembrete[];
}

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Aggregate root. Controla invariantes de negócio da fatura + seus lembretes.
 *
 * Senior rationale: entidade pura, sem decorators de ORM nem framework.
 * Mappers traduzem para/da camada de persistência.
 */
export class Fatura {
  private constructor(private props: FaturaProps) {}

  static reconstruir(props: FaturaProps): Fatura {
    return new Fatura(props);
  }

  static criar(input: {
    id: string;
    userId: string;
    nomeDevedor: string;
    emailDevedor: Email;
    descricao: string;
    valor: Money;
    dataVencimento: string;
    timezone: string;
    now: Date;
  }): Fatura {
    if (!DATA_ISO_REGEX.test(input.dataVencimento)) {
      throw new InvalidVencimentoException(
        `dataVencimento deve estar em YYYY-MM-DD, recebeu ${input.dataVencimento}`,
      );
    }
    return new Fatura({
      ...input,
      status: FaturaStatus.PENDENTE,
      createdAt: input.now,
      updatedAt: input.now,
      lembretes: [],
    });
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get nomeDevedor(): string { return this.props.nomeDevedor; }
  get emailDevedor(): Email { return this.props.emailDevedor; }
  get descricao(): string { return this.props.descricao; }
  get valor(): Money { return this.props.valor; }
  get dataVencimento(): string { return this.props.dataVencimento; }
  get timezone(): string { return this.props.timezone; }
  get status(): FaturaStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get lembretes(): readonly Lembrete[] { return this.props.lembretes; }

  anexarLembretes(lembretes: Lembrete[]): void {
    this.props.lembretes = lembretes;
  }

  mudarStatus(novo: FaturaStatus, now: Date): void {
    const atual = this.props.status;
    const permitidas = FATURA_TRANSICOES_PERMITIDAS[atual];
    if (!permitidas.includes(novo)) {
      throw new InvalidStatusTransitionException(atual, novo);
    }
    this.props.status = novo;
    this.props.updatedAt = now;
  }

  /**
   * Versão de ETag baseada em updatedAt (epoch ms).
   * Simples, não colide em uso realista e evita materializar hash a cada GET.
   */
  etag(): string {
    return `W/"${this.props.updatedAt.getTime().toString(16)}"`;
  }

  /** Tipos da régua de cobrança ordenados. Documenta a política do domínio. */
  static readonly TIPOS_REGUA: readonly LembreteTipo[] = [
    LembreteTipo.D_MENOS_3,
    LembreteTipo.D_MAIS_1,
    LembreteTipo.D_MAIS_7,
  ];
}
