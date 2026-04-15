/**
 * Tokens de injeção para portas (contratos). Implementações vivem em infrastructure/.
 * Usar tokens como símbolos de string permite manter o domínio 100% sem NestJS.
 */
export const FATURA_REPOSITORY = Symbol('FATURA_REPOSITORY');
export const LEMBRETE_REPOSITORY = Symbol('LEMBRETE_REPOSITORY');
export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const CLOCK = Symbol('CLOCK');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
