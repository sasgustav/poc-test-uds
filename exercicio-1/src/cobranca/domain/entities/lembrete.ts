import crypto from 'node:crypto';

import { LembreteStatus } from '../enums/lembrete-status.enum';
import type { LembreteTipo } from '../enums/lembrete-tipo.enum';

export interface LembreteProps {
  id: string;
  faturaId: string;
  dataEnvio: Date;
  tipo: LembreteTipo;
  status: LembreteStatus;
  tentativas: number;
  erroMsg: string | null;
  processadoEm: Date | null;
  proximaTentativa: Date | null;
  createdAt: Date;
}

export class Lembrete {
  private constructor(private props: LembreteProps) {}

  static reconstruir(props: LembreteProps): Lembrete {
    return new Lembrete(props);
  }

  static criar(input: {
    id: string;
    faturaId: string;
    dataEnvio: Date;
    tipo: LembreteTipo;
    now: Date;
  }): Lembrete {
    return new Lembrete({
      ...input,
      status: LembreteStatus.PENDENTE,
      tentativas: 0,
      erroMsg: null,
      processadoEm: null,
      proximaTentativa: input.dataEnvio,
      createdAt: input.now,
    });
  }

  get id(): string { return this.props.id; }
  get faturaId(): string { return this.props.faturaId; }
  get dataEnvio(): Date { return this.props.dataEnvio; }
  get tipo(): LembreteTipo { return this.props.tipo; }
  get status(): LembreteStatus { return this.props.status; }
  get tentativas(): number { return this.props.tentativas; }
  get erroMsg(): string | null { return this.props.erroMsg; }
  get processadoEm(): Date | null { return this.props.processadoEm; }
  get proximaTentativa(): Date | null { return this.props.proximaTentativa; }
  get createdAt(): Date { return this.props.createdAt; }

  marcarEnviado(now: Date): void {
    if (this.props.status !== LembreteStatus.PENDENTE) {
      throw new Error(
        `Lembrete ${this.props.id}: não pode marcar como enviado no status ${this.props.status}`,
      );
    }
    this.props.status = LembreteStatus.ENVIADO;
    this.props.tentativas += 1;
    this.props.processadoEm = now;
    this.props.erroMsg = null;
    this.props.proximaTentativa = null;
  }

  /**
   * Retry com exponential backoff + jitter (full jitter, AWS arch blog 2015).
   * Fórmula: delay = random(0, min(base * 2^attempt, cap))
   * Evita thundering herd quando provedor de email volta do incidente.
   *
   * Usa Math.random() em vez de node:crypto para manter a entidade
   * livre de dependências de runtime. Jitter não requer segurança criptográfica.
   */
  marcarFalha(opts: {
    erro: string;
    now: Date;
    maxAttempts: number;
    baseMs?: number;
    capMs?: number;
  }): void {
    if (this.props.status !== LembreteStatus.PENDENTE) {
      throw new Error(
        `Lembrete ${this.props.id}: não pode marcar falha no status ${this.props.status}`,
      );
    }
    const base = opts.baseMs ?? 1000;
    const cap = opts.capMs ?? 60_000;
    this.props.tentativas += 1;
    this.props.erroMsg = opts.erro.slice(0, 2000);
    this.props.processadoEm = opts.now;
    if (this.props.tentativas >= opts.maxAttempts) {
      this.props.status = LembreteStatus.FALHOU;
      this.props.proximaTentativa = null;
      return;
    }
    const maxDelay = Math.min(base * 2 ** this.props.tentativas, cap);
    const jitter = crypto.randomInt(0, maxDelay);
    this.props.proximaTentativa = new Date(opts.now.getTime() + jitter);
    this.props.status = LembreteStatus.PENDENTE;
  }

  /** Descarta o lembrete (ex: fatura cancelada antes do envio). */
  descartar(now: Date): void {
    if (this.props.status !== LembreteStatus.PENDENTE) {
      throw new Error(
        `Lembrete ${this.props.id}: não pode descartar no status ${this.props.status}`,
      );
    }
    this.props.status = LembreteStatus.DESCARTADO;
    this.props.processadoEm = now;
    this.props.proximaTentativa = null;
  }
}
