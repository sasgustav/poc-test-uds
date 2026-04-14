import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration inicial — substitui `synchronize: true`.
 *
 * Senior rationale: synchronize em produção é gatilho para data loss
 * (drops silenciosos em rename de coluna). Migrations versionadas e
 * revisáveis em PR são o padrão que auditoria financeira exige.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await q.query(`
      CREATE TABLE "faturas" (
        "id" uuid PRIMARY KEY,
        "userId" uuid NOT NULL,
        "nomeDevedor" varchar(255) NOT NULL,
        "emailDevedor" varchar(255) NOT NULL,
        "descricao" varchar(255) NOT NULL,
        "valor_cents" bigint NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'BRL',
        "dataVencimento" date NOT NULL,
        "timezone" varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
        "status" varchar(16) NOT NULL DEFAULT 'pendente',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX "idx_faturas_user_vencimento" ON "faturas" ("userId", "dataVencimento")`);
    await q.query(`CREATE INDEX "idx_faturas_user_created" ON "faturas" ("userId", "createdAt" DESC)`);

    await q.query(`
      CREATE TABLE "lembretes_agendados" (
        "id" uuid PRIMARY KEY,
        "faturaId" uuid NOT NULL REFERENCES "faturas"("id") ON DELETE CASCADE,
        "dataEnvio" timestamptz NOT NULL,
        "tipo" varchar(8) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pendente',
        "tentativas" int NOT NULL DEFAULT 0,
        "erroMsg" text,
        "processadoEm" timestamptz,
        "proximaTentativa" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX "idx_lembretes_status_proxima" ON "lembretes_agendados" ("status", "proximaTentativa")`);
    await q.query(`CREATE INDEX "idx_lembretes_fatura" ON "lembretes_agendados" ("faturaId")`);

    await q.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid PRIMARY KEY,
        "aggregateId" uuid NOT NULL,
        "eventType" varchar(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "occurredAt" timestamptz NOT NULL,
        "processedAt" timestamptz,
        "attempts" int NOT NULL DEFAULT 0,
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX "idx_outbox_pending" ON "outbox_events" ("processedAt", "occurredAt")`);

    await q.query(`
      CREATE TABLE "idempotency_keys" (
        "key" varchar(128) PRIMARY KEY,
        "requestHash" varchar(64) NOT NULL,
        "statusCode" int NOT NULL,
        "responseBody" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz NOT NULL
      )
    `);
    await q.query(`CREATE INDEX "idx_idempotency_expires" ON "idempotency_keys" ("expiresAt")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
    await q.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await q.query(`DROP TABLE IF EXISTS "lembretes_agendados"`);
    await q.query(`DROP TABLE IF EXISTS "faturas"`);
  }
}
