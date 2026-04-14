export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Idempotency-Key pattern (RFC draft-ietf-httpapi-idempotency-key).
 * 24h de retenção por padrão.
 */
export interface IdempotencyRepository {
  buscar(key: string): Promise<IdempotencyRecord | null>;
  registrar(record: IdempotencyRecord): Promise<void>;
}
