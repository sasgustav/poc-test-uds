/**
 * Hierarquia de exceções de domínio.
 *
 * Senior rationale: domínio NUNCA lança HttpException (acoplamento a NestJS).
 * Exceções são traduzidas para HTTP no filtro global (problem+json filter).
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;

  constructor(message: string, readonly context?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FaturaNotFoundException extends DomainException {
  readonly code = 'fatura.not_found';
  constructor(id: string) {
    super(`Fatura ${id} não encontrada`, { id });
  }
}

export class InvalidStatusTransitionException extends DomainException {
  readonly code = 'fatura.invalid_status_transition';
  constructor(from: string, to: string) {
    super(`Transição inválida de ${from} para ${to}`, { from, to });
  }
}

export class InvalidMoneyException extends DomainException {
  readonly code = 'domain.invalid_money';
}

export class InvalidEmailException extends DomainException {
  readonly code = 'domain.invalid_email';
}

export class InvalidVencimentoException extends DomainException {
  readonly code = 'fatura.invalid_vencimento';
}

export class IdempotencyConflictException extends DomainException {
  readonly code = 'idempotency.conflict';
  constructor(key: string) {
    super(`Idempotency-Key ${key} já utilizada com payload diferente`, { key });
  }
}

export class OutboxPublishException extends DomainException {
  readonly code = 'outbox.publish_failed';
}
