/**
 * Injeta variáveis de ambiente necessárias para os testes E2E.
 * Valores apontam para o Postgres do docker-compose.
 */
process.env['DB_HOST'] ??= 'localhost';
process.env['DB_PORT'] ??= '5432';
process.env['DB_USERNAME'] ??= 'cobranca_user';
process.env['DB_PASSWORD'] ??= 'cobranca_pass';
process.env['DB_DATABASE'] ??= 'cobranca_db';
process.env['NODE_ENV'] ??= 'test';
process.env['SCHEDULER_ENABLED'] ??= 'false';
process.env['OTEL_ENABLED'] ??= 'false';
