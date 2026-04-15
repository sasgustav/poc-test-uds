/**
 * Clock injetável para testes determinísticos.
 * Senior rationale: evita `new Date()` espalhado pelo domínio, que é fonte #1
 * de testes flaky e impossíveis de reproduzir.
 */
export interface Clock {
  now(): Date;
}
