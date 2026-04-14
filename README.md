# Avaliação Técnica — Desenvolvedor Fullstack (UDS / Talent Studio)

Repositório com a solução da avaliação técnica. A entrega foi reelevada
para padrão **sênior especialista**: arquitetura hexagonal, outbox pattern,
idempotência HTTP, advisory locks, observabilidade (OTel + Prometheus +
pino), migrations versionadas, API RFC 7807 + keyset pagination, testes
property-based, DevEx completo (Dockerfile non-root, CI, Husky,
ESLint strict-type-checked).

## Estrutura

```
├── exercicio-1/   Backend NestJS — Régua de Cobranças (overhaul hexagonal)
├── exercicio-2/   Code Review: tenant leak + keyset + observabilidade
├── exercicio-3/   ADR 001 — Integração multi-gateway de pagamentos
├── docker-compose.yml   Postgres + Jaeger + app
├── .github/workflows/   CI (lint · typecheck · test · build)
└── AI_USAGE.md          Disclosure de uso de IA
```

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- npm

## Quickstart (opção 1 — tudo em container)

```bash
docker-compose up -d --build
# app:    http://localhost:3000
# docs:   http://localhost:3000/docs
# health: http://localhost:3000/health/readiness
# jaeger: http://localhost:16686
```

## Quickstart (opção 2 — app local, PG em container)

```bash
docker-compose up -d postgres
cd exercicio-1
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev
```

## Endpoints principais (Ex1)

Versionados via URI prefix. Autenticados via `X-API-Key` (stub) + `X-User-Id`
(demo — em prod viria do JWT).

```bash
# Criar fatura (com Idempotency-Key)
curl -X POST http://localhost:3000/v1/faturas \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "nomeDevedor": "João Silva",
    "emailDevedor": "joao@empresa.com",
    "descricao": "Consultoria mensal",
    "valor": 3500.00,
    "dataVencimento": "2026-06-15",
    "timezone": "America/Sao_Paulo"
  }'

# Listar (paginated)
curl "http://localhost:3000/v1/faturas?page=1&pageSize=20" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000"

# Buscar por id (com ETag)
curl http://localhost:3000/v1/faturas/<id> \
  -H "X-User-Id: ..." -H "If-None-Match: W/\"abc\""

# PATCH status (state machine validada no domínio)
curl -X PATCH http://localhost:3000/v1/faturas/<id>/status \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ..." \
  -d '{"status":"paga"}'
```

Swagger UI interativo: **http://localhost:3000/docs**.

## Observabilidade

| Endpoint | Uso |
|----------|-----|
| `GET /health/liveness` | Liveness probe (K8s) |
| `GET /health/readiness` | Readiness (PG ping + outbox depth) |
| `GET /metrics` | Prometheus scrape |
| `GET /docs` | Swagger UI / OpenAPI 3 |
| Jaeger UI | http://localhost:16686 |

## Testes

```bash
cd exercicio-1
npm test              # unit (domain + application + property-based)
npm run test:cov      # com coverage (threshold 85%)
npm run test:e2e      # requires Postgres rodando
npm run lint
npm run typecheck
```

## Variáveis de ambiente

Validadas via Zod no boot (fail-fast). Veja `exercicio-1/.env.example` — as
principais:

| Variável | Default | Propósito |
|----------|---------|-----------|
| `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` | localhost/5432/cobranca_* | Conexão PG |
| `DB_POOL_MAX` | 20 | Pool size (ver Ex2 RESPOSTAS §3.4) |
| `API_KEY_SHA256` | — | Hex sha256 da API key; ausente = modo dev permissivo |
| `DEFAULT_TIMEZONE` | America/Sao_Paulo | TZ IANA p/ cálculo da régua |
| `REMINDER_HOUR` | 9 | Hora local do envio |
| `SCHEDULER_MAX_ATTEMPTS` | 5 | Retry antes de mover p/ DLQ (FALHOU) |
| `THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT` | 60, 120 | Rate limit |
| `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT` | false, — | Tracing |
| `CORS_ORIGINS` | `*` | CSV allowlist |

## Por que esse nível de rigor

A avaliação original foi classificada como "pleno". O gap para sênior não era
o quê foi entregue — os endpoints funcionam — mas **como se comportaria em
produção**: o scheduler tinha flag em memória (quebra em multi-instância), não
havia idempotência HTTP, `synchronize:true` em produção, filtro por `userId`
sem enforcement por contrato, zero observabilidade estruturada. O overhaul
atual corrige esses eixos sem sacrificar legibilidade — cada decisão está
documentada nos `RESPOSTAS.md` de cada exercício com tradeoffs alternativas.

---

Desenvolvido por Gustavo Vasconcelos.
