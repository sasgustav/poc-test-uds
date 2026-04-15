export const FATURA_CRIADA_EVENT = 'cobranca.fatura.criada.v1';

export interface FaturaCriadaEventPayload {
  faturaId: string;
  userId: string;
  valorCents: number;
  currency: string;
  dataVencimento: string;
  timezone: string;
  occurredAt: string; // ISO
}
