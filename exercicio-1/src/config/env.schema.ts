import { z } from 'zod';

/**
 * Schema de validação de configuração (fail-fast no boot).
 *
 * Senior rationale: variáveis de ambiente são limite de sistema.
 * Validar via Zod aqui evita classes inteiras de bugs (type coercion
 * do process.env, env ausente descoberta em produção, valores inválidos
 * retornando undefined silencioso).
 */
const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const csv = z
  .string()
  .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_DATABASE: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  API_DEFAULT_VERSION: z.string().default('1'),
  CORS_ORIGINS: csv.default('*'),

  API_KEY_SHA256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'API_KEY_SHA256 deve ser sha256 hex (64 chars)')
    .optional(),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('regua-cobrancas'),
  OTEL_ENABLED: booleanFromString.default(false),

  SCHEDULER_ENABLED: booleanFromString.default(true),
  SCHEDULER_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  SCHEDULER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DEFAULT_TIMEZONE: z.string().default('America/Sao_Paulo'),
  REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(9),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  return parsed.data;
}
