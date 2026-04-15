import type { EntityManager } from 'typeorm';

/**
 * Postgres advisory lock (transactional).
 * Liberado automaticamente no COMMIT/ROLLBACK — garante que mesmo um crash
 * do worker libera o lock, evitando dead-scheduler.
 *
 * hashtext(key) mapeia string → int4 de forma determinística.
 *
 * @returns true se o lock foi adquirido; false se outra instância já o detém.
 */
export async function tryAdvisoryLock(
  manager: EntityManager,
  key: string,
): Promise<boolean> {
  const rows: [{ locked: boolean }] = await manager.query(
    `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
    [key],
  );
  return rows[0].locked === true;
}
