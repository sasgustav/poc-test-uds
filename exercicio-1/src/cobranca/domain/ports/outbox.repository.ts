/**
 * Transactional Outbox Pattern.
 *
 * Evento gravado na MESMA transação que muda estado do domínio. Um processor
 * separado publica/entrega eventos, marca como processado e deleta (ou mantém
 * para auditoria). Garante "pelo menos uma vez" com consistência forte local.
 */
export interface OutboxEventRecord {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface OutboxRepository {
  registrar(event: OutboxEventRecord): Promise<void>;
  buscarNaoProcessados(limit: number): Promise<OutboxEventRecord[]>;
  marcarProcessado(id: string): Promise<void>;
  marcarFalha(id: string, erro: string): Promise<void>;
  contarPendentes(): Promise<number>;
}
