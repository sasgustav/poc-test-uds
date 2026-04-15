import { randomUUID } from 'node:crypto';
import { Fatura } from '../../src/cobranca/domain/entities/fatura';
import { Email } from '../../src/cobranca/domain/value-objects/email';
import { Money } from '../../src/cobranca/domain/value-objects/money';

/**
 * Factory de faturas para testes. Expoe defaults realistas e aceita overrides
 * parciais — evita repetir fixture boilerplate em cada spec.
 */
export function makeFatura(overrides: Partial<{
  id: string;
  userId: string;
  nomeDevedor: string;
  emailDevedor: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  timezone: string;
  now: Date;
}> = {}): Fatura {
  return Fatura.criar({
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    nomeDevedor: overrides.nomeDevedor ?? 'Maria Silva',
    emailDevedor: Email.of(overrides.emailDevedor ?? 'maria@example.com'),
    descricao: overrides.descricao ?? 'Fatura de teste',
    valor: Money.fromDecimal(overrides.valor ?? 150),
    dataVencimento: overrides.dataVencimento ?? '2026-06-01',
    timezone: overrides.timezone ?? 'America/Sao_Paulo',
    now: overrides.now ?? new Date('2026-05-01T12:00:00Z'),
  });
}
