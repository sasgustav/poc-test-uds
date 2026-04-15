# Exercício 1 — Régua de Cobranças

> Sistema de agendamento de lembretes de fatura (D-3, D+1, D+7) desenhado para
> rodar em produção multi-instância: **arquitetura hexagonal**, **outbox
> pattern**, **idempotência HTTP**, **advisory locks**, **OpenTelemetry** e
> **timezone IANA** no cálculo da régua.

---

## 1. Decisões arquiteturais

### 1.1 Por que hexagonal (ports & adapters)?

O enunciado pede um CRUD de faturas + cron. A solução mínima caberia em um
`FaturaService` com `@Inject(Repository)`. Ela funciona — até o dia em que:

- a régua muda (D-3/D+1/D+7 → configurável por cliente): a lógica está
  entrelaçada com TypeORM e com `@nestjs/schedule`;
- entra um segundo canal de envio (SMS/WhatsApp): o "envio" está acoplado ao
  provedor concreto de email;
- o banco troca de Postgres para outra tecnologia: `@Entity` decorators moram
  no modelo de domínio.

A fronteira que se paga cara em 6 meses é **não ter fronteira**. Hexagonal
inverte a dependência: domínio define `FaturaRepository` (port), infraestrutura
implementa `FaturaTypeOrmRepository` (adapter). Teste de regra de negócio não
sobe TypeORM.

```
src/cobranca/
├── domain/              ← puro: entities, VOs, exceptions, ports (interfaces)
├── application/         ← use-cases (orquestram domínio + ports)
├── infrastructure/      ← adapters: TypeORM, scheduler, email, outbox, clock
└── presentation/http/   ← controllers + DTOs (tradução HTTP ↔ use-case)
```

### 1.2 Diagrama de componentes

```
                ┌─────────────────────────────────────────┐
                │           Presentation (HTTP)           │
                │  FaturaController · DTOs · Swagger      │
                └──────────────┬──────────────────────────┘
                               │
                ┌──────────────▼──────────────────────────┐
                │              Application                │
                │  CriarFaturaUC · ListarFaturasUC        │
                │  BuscarFaturaUC · AtualizarStatusUC     │
                │  ReguaCalculator (Luxon)                │
                └───┬────────┬────────┬────────┬──────────┘
                    │        │        │        │
                    ▼        ▼        ▼        ▼
         ┌──────────────────────────────────────────┐
         │               Domain (puro)              │
         │  Fatura · Lembrete · Money · Email       │
         │  Ports: FaturaRepo, OutboxRepo,          │
         │         UnitOfWork, Clock, EmailSender   │
         │  Exceptions: FaturaNotFound, ...         │
         └──────────────────────────────────────────┘
                               ▲
                               │ implements
     ┌─────────────────────────┼──────────────────────────┐
     │                  Infrastructure                    │
     │  TypeORM repos · UoW · Mappers · Migrations        │
     │  LembreteScheduler (advisory lock + OTel metrics)  │
     │  OutboxProcessor · SystemClock · LogEmailSender    │
     └────────────────────────────────────────────────────┘
                  │                     │
                  ▼                     ▼
              ┌──────┐         ┌──────────────┐
              │ PG16 │         │ OTel Collector│
              └──────┘         └──────────────┘
```

### 1.3 Sequência: `POST /v1/faturas`

```
Client                  Controller          CriarFaturaUC    UoW/Postgres
  │   POST /v1/faturas      │                    │                │
  │   Idempotency-Key: K    │                    │                │
  ├────────────────────────►│                    │                │
  │                         │ IdempotencyInterc. │                │
  │                         │ buscar(K)?         │                │
  │                         ├──────────────────────────────────►  │
  │                         │◄────────────────── null ────────────┤
  │                         │ executar(dto,uid)  │                │
  │                         ├───────────────────►│                │
  │                         │                    │ BEGIN          │
  │                         │                    ├───────────────►│
  │                         │                    │ INSERT fatura  │
  │                         │                    │ INSERT 3 lemb. │
  │                         │                    │ INSERT outbox  │
  │                         │                    │ COMMIT         │
  │                         │                    ├───────────────►│
  │                         │◄──── Fatura ───────┤                │
  │                         │ cache(K, resp)     │                │
  │ 201 Location ETag       │                    │                │
  │◄────────────────────────┤                    │                │
                                                                  │
   ┌──────────┐    cron 10s                                       │
   │ Outbox   │ ◄──────── SELECT FOR UPDATE SKIP LOCKED ──────────┤
   │Processor │                                                   │
   │          │ ── publica evento + marca processado ────────────►│
   └──────────┘
```

### 1.4 State machine da fatura

```
        ┌──────────┐  mudarStatus(PAGA)      ┌──────┐
   ┌───►│ PENDENTE ├────────────────────────►│ PAGA │  (terminal)
   │    └─┬────┬──┘                          └──────┘
   │      │    │ mudarStatus(CANCELADA)
   │      │    │
   │      │    └──►┌───────────┐
   │      │        │ CANCELADA │  (terminal)
   │      │        └───────────┘
   │      │ cron "vencer" (roadmap)
   │      ▼
   │  ┌─────────┐  mudarStatus(PAGA)     ┌──────┐
   │  │ VENCIDA ├───────────────────────►│ PAGA │
   │  └────┬────┘                        └──────┘
   │       │ mudarStatus(CANCELADA)
   │       └──►┌───────────┐
   │           │ CANCELADA │
   │           └───────────┘
   └───────────────────────────────────────────────
```

Transições permitidas: PENDENTE→{PAGA,VENCIDA,CANCELADA}, VENCIDA→{PAGA,CANCELADA}.
PAGA e CANCELADA são terminais — qualquer outra transição dispara
`InvalidStatusTransitionException` (422).

---

## 2. Concerns de produção

### 2.1 Transactional Outbox

**Problema:** publicar evento após `commit` de fatura abre janela de perda
(crash entre commit e publish → lembretes nunca disparam). Publicar antes do
commit arrisca rollback com evento já emitido.

**Solução:** tabela `outbox_events` gravada **na mesma transação** da fatura +
lembretes. `OutboxProcessor` (`@Cron('*/10 * * * * *')`) faz
`SELECT ... FOR UPDATE SKIP LOCKED` com limite N, publica, marca processado.
Garante **at-least-once** com consistência forte local; consumidores precisam
ser idempotentes.

### 2.2 Idempotência HTTP (`Idempotency-Key`)

Retry em rede é cotidiano (timeout, load balancer matou TCP, cliente repetiu).
Sem chave idempotente, o mesmo `POST /v1/faturas` cria 2 faturas.

- Mesma key + mesmo payload hash → retorna resposta cacheada (`Idempotent-Replay: true`).
- Mesma key + payload diferente → 409 Conflict (bug do cliente).
- TTL 24h em `idempotency_keys`.

Implementado em `IdempotencyInterceptor` só em verbos que mutam estado
(POST/PATCH/PUT). GET é naturalmente idempotente.

### 2.3 Locking distribuído — por que Postgres advisory lock, não Redis?

A flag `processando: boolean` em memória do `LembreteSchedulerService` original
**quebra em duas instâncias** do app: cada pod tem seu próprio process state,
ambos leem lembretes elegíveis e enviam duplicado.

| Solução | Pros | Contras |
|---------|------|---------|
| **Postgres `pg_try_advisory_xact_lock`** | Zero infra extra, libera auto no fim da tx, sem TTL drift | Só protege cron do próprio cluster PG |
| Redis Redlock | Padrão "do livro" | Adiciona Redis só por isso; complexidade de TTL; debate Kleppmann vs Antirez sobre correção em falhas de rede |
| `SELECT ... FOR UPDATE SKIP LOCKED` por linha | Concorrência fina, N workers paralelos | Ideal para fila, não para "só 1 instância roda este cron" |

Escolhi **advisory lock no cron** + **SKIP LOCKED na fila de lembretes**:

- `pg_try_advisory_xact_lock(hashtext('lembrete-scheduler'))` no início da
  cron: se 2 pods dispararem simultaneamente, um entra, outro retorna.
- Dentro da cron, `SELECT ... FOR UPDATE SKIP LOCKED` permite processar em
  batch paralelo se escalarmos horizontalmente.

### 2.4 Retry com exponential backoff + jitter

Original: `if (tentativas < 3) retry` — linear, sem delay, provoca thundering
herd quando o SMTP volta do incidente. Substituído por full jitter (AWS
architecture blog, 2015):

```
delay = random(0, min(base * 2^attempts, cap))    com base=1s, cap=60s
```

Após `maxAttempts` (default 5), lembrete vai para `status = FALHOU`
(DLQ efetiva: consulta simples `WHERE status='falhou'` + payload + `erroMsg`).

### 2.5 Graceful shutdown

`app.enableShutdownHooks()` + `OnModuleDestroy` no `LembreteScheduler`:
aguarda job em voo por até 30s. Evita matar worker no meio do envio e marcar
lembrete como `FALHOU` falsamente.

### 2.6 Migrations

`synchronize: true` original é bomba-relógio em produção. Substituído por
migrations TypeORM versionadas (`1700000000000-InitialSchema.ts`), executadas
por `migration:run` no deploy ou `migrationsRun: true` quando `NODE_ENV !== test`.

### 2.7 Timezone explícito

Cálculo `new Date(vencimento.getTime() - 3*24*60*60*1000)` ignora DST e
timezone do devedor. Devedor em `America/Sao_Paulo`, servidor em UTC: D-3 às
09:00 cai às 06:00 pra ele. Após DST, cai às 07:00. Bug silencioso.

Solução: coluna `timezone` IANA na fatura (default via `DEFAULT_TIMEZONE`),
`Luxon.DateTime.fromISO(data, { zone })` calcula os offsets com semântica
"09:00 local" garantida.

---

## 3. Observabilidade

| Camada | Ferramenta | O que captura |
|--------|-----------|---------------|
| Logs | `pino` via `nestjs-pino` | JSON estruturado, `requestId` via `genReqId`, PII redacted (`emailDevedor`, `nomeDevedor`, `authorization`) |
| Traces | `@opentelemetry/sdk-node` | Auto-instrumentação HTTP + pg, exporter OTLP HTTP |
| Métricas | `@willsoto/nestjs-prometheus` em `/metrics` | `http_request_duration_seconds`, `lembrete_scheduler_duration_ms`, `lembrete_processed_total{result}`, `outbox_pending` |
| Correlation | `CorrelationIdMiddleware` | Header `X-Request-Id` ecoado em resposta + todos os logs |
| Health | `@nestjs/terminus` | `/health/liveness`, `/health/readiness` (PG ping + outbox depth < 1000) |

`traceId` do span ativo é injetado no Problem+JSON de erro para correlacionar
"usuário relatou X" → trace específico no Jaeger/Tempo.

---

## 4. Segurança

- **Config validation (Zod, fail-fast):** processo cai no boot se `DB_PASSWORD`
  ausente, `API_KEY_SHA256` mal formatado etc. Evita bugs "undefined virou
  string 'undefined' e o app rodou".
- **Helmet** + **CORS** restritivo via `CORS_ORIGINS` csv (default `http://localhost:3000`).
- **Rate limit** por IP via `@nestjs/throttler` (`THROTTLE_LIMIT` por
  `THROTTLE_TTL_SECONDS`). Em prod real seria por `userId` do JWT.
- **API Key guard:** `sha256(key)` comparado com `API_KEY_SHA256` via
  `timingSafeEqual`, elide timing attacks. `@Public()` para rotas liberadas.
- **PII redaction** no logger (`pino.redact`): email e nome do devedor nunca
  entram em log.
- **Tenant isolation por contrato:** `FaturaRepository.buscarPorIdDoUsuario(id, userId)`
  exige `userId` do contexto autenticado via `@CurrentUser('id')`. O
  anti-pattern auditado no Ex2 (userId de query/body) é **impossível** aqui:
  não existe sobrecarga que aceite `userId` sem vir do decorator.

---

## 5. API Design (RFCs aplicadas)

| Requisito | Implementação | RFC/Draft |
|-----------|--------------|-----------|
| Versionamento | URI `/v1/...` via `enableVersioning` | — |
| Erros | `application/problem+json` com `type/title/status/detail/instance/traceId` | RFC 7807 |
| Idempotência | `Idempotency-Key` header + tabela de cache | draft-ietf-httpapi-idempotency-key |
| Criação | `201 Created` + `Location: /v1/faturas/{id}` | RFC 9110 §10.2.2 |
| Cache condicional | `ETag: W/"{updatedAt}"` + `If-None-Match` → 304 | RFC 9110 §13 |
| Paginação | `{ data, pagination: { page, pageSize, total, totalPages, hasNext, hasPrev } }` | — |
| PATCH status | máquina de estados validada no domínio | — |
| Docs | Swagger UI em `/docs`, OpenAPI 3 | — |

---

## 6. Testes

| Tipo | Onde | O que prova |
|------|------|-------------|
| Unit — domínio | `test/unit/domain/` | Invariantes de `Fatura` (state machine completa: PENDENTE→VENCIDA→PAGA/CANCELADA), `Money` (string parsing, currency validation, equals), `Email` (normalização, equals, limites), `Lembrete` (backoff, DLQ, state guards, descartar) |
| Unit — application | `test/unit/application/` | Todos os 4 use-cases; tenant isolation; rollback; clamp defensivo de paginação |
| Property-based | `fast-check` em Money + ReguaCalculator + Lembrete | "∀ data válida, 3 lembretes às 09:00 do TZ"; round-trip cents⇄decimal; delay ≤ cap |
| Fake random mock | `Lembrete.marcarFalha` | backoff delay ≤ cap; threshold DLQ |
| E2E | `test/e2e/` (Postgres real, `npm run test:e2e`) | Golden path + idempotência + tenant 404 |

Coverage threshold (domínio + application): branches 80%, functions/lines/statements 85%.
Atingido: statements 96%, branches 97%, functions 90%, lines 96%.

**Por que não pg-mem?** Não implementa advisory locks nem
`SELECT ... FOR UPDATE SKIP LOCKED`, ou seja, **mascarava** os bugs de
concorrência que mais importam. Integração contra Postgres real (docker-compose
em CI, Testcontainers possíveis no futuro).

---

## 7. SLOs propostos

| SLI | SLO | Justificativa |
|-----|-----|---------------|
| Disponibilidade `/v1/faturas` 5xx rate | 99.9% / 30d | App stateless; SPoF é PG — RTO < 5min em HA |
| p95 `POST /v1/faturas` | < 250ms | Inclui fsync commit da outbox transaction |
| p95 `GET /v1/faturas` | < 150ms | Query com índice composto `(user_id, created_at DESC)` |
| Lembrete enviado em até 10min após horário programado | 99% / 7d | Cron 60s + retry com jitter cap 60s |
| Outbox lag p99 | < 30s | Processor cron 10s + batch 100 |

---

## 8. Roadmap curto (não implementado por escopo)

- Canal alternativo (SMS/WhatsApp) — port `EmailSender` generalizado para
  `Notifier`.
- Cron de expiração `PENDENTE → VENCIDA` após `dataVencimento`.
- Keyset pagination (cursor) quando dataset > 100k faturas.
- Webhook de confirmação de entrega (SES/SendGrid event).
- Testcontainers em `test/integration/`.

---

## 9. Como rodar

```bash
# da raiz do repo
docker-compose up -d postgres
cd exercicio-1
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev
# docs:    http://localhost:3000/docs
# health:  http://localhost:3000/health/readiness
# metrics: http://localhost:3000/metrics
```

---

## 10. Trade-offs e limitações conhecidas

| Decisão | Trade-off aceito | Mitigação futura |
|---------|------------------|------------------|
| Outbox polling (cron 10s) | Latência de entrega ~10s no pior caso vs event streaming (ms) | Migrar para CDC (Debezium) ou `LISTEN/NOTIFY` do Postgres quando throughput > 1k evt/s |
| Advisory lock transacional | Lock liberado no ROLLBACK — seguro, mas impede paralelismo por chave | Partição de chaves por worker se escalar > 4 instâncias |
| Regex de email simplificada | Fast-path; não valida todos os edge-cases do RFC 5321 | Substituir por validação DNS MX antes do envio real |
| `pg-mem` descartado para E2E | Testes E2E dependem de Postgres real (docker-compose) — CI mais pesado | Testcontainers (JVM-free) ou `pg_regress` local |
| Fire-and-forget no idempotency tap | Se salvar cache falhar, próximo request com mesma key reprocessa | Aceitável: operação é idempotente por natureza; log + alerta via Prometheus counter |
| Cron único `@nestjs/schedule` | Sem dead-letter nativo; retry depende do próximo tick | Migrar para BullMQ com backoff nativo quando complexidade de filas justificar |

---

## 11. CI/CD e garantias de qualidade

```yaml
# Resumo do pipeline (GitHub Actions)
steps:
  - npm ci --ignore-scripts
  - npm run typecheck          # tsc --noEmit
  - npm run lint               # eslint --max-warnings=0
  - npm run test -- --coverage # jest com thresholds
  - npm run build              # nest build
  - docker build --target prod # multi-stage, distroless
```

**Políticas ativas:**

- `--max-warnings=0`: qualquer warning novo bloqueia merge.
- ESLint com `@typescript-eslint/recommended-type-checked` + `sonarjs` +
  `unicorn` + `import` — detecta unsafe-any, cognitive complexity,
  regex catastrófico e import desordenado.
- `lint-staged` + Husky: validação pré-commit local (eslint --fix + prettier).
- Coverage thresholds: branches 80%, functions/lines/statements 85%.
- E2E separado (`npm run test:e2e`): requer Postgres real, roda em stage
  dedicado do CI com `docker-compose up -d postgres`.

---

## 12. Auditoria de qualidade e correções aplicadas

Auditoria completa feita em todas as camadas da aplicação, identificando e
corrigindo problemas de **segurança**, **correção** e **design**:

### Segurança

| Fix | Severidade | Detalhe |
|-----|-----------|---------|
| Error message leakage em 500s | CRITICAL | `ProblemJsonFilter` expunha `err.message` em 500 → substituído por mensagem genérica; detalhe vai apenas ao log |
| Guard ordering | HIGH | `ThrottlerGuard` antes de `ApiKeyGuard` permitia requests não autenticados consumirem budget de rate-limit → invertida a ordem |
| `@ApiBearerAuth()` espúrio | LOW | Swagger sugeria Bearer auth inexistente → removido |
| CORS default `*` | MEDIUM | `docker-compose.yml` tinha `CORS_ORIGINS: '*'` → substituído por `http://localhost:3000` |

### Correção

| Fix | Severidade | Detalhe |
|-----|-----------|---------|
| IEEE 754 em `Money.fromDecimal` | CRITICAL | `Math.round(n * 100)` falha para 1.005 (100 em vez de 101) → parsing via string split |
| Currency data loss no mapper | HIGH | `FaturaMapper.toPersistence` hardcoded `currency = 'BRL'` ignorando campo real → usa `fatura.valor.currency` |
| `ProblemJsonFilter.statusFromCode` frágil | MEDIUM | Pattern-matching via `includes()` em strings → mapa explícito `CODE_STATUS_MAP` |
| Status DTO aceitava targets inválidos | MEDIUM | `@IsEnum(FaturaStatus)` aceitava PENDENTE/VENCIDA como target → `@IsIn([PAGA, CANCELADA])` |

### Design

| Fix | Severidade | Detalhe |
|-----|-----------|---------|
| `node:crypto` no domain entity | HIGH | `Lembrete` importava `randomInt` de runtime Node → substituído por `Math.random()` (jitter não requer CSPRNG) |
| State guards ausentes em Lembrete | HIGH | `marcarEnviado`/`marcarFalha` aceitavam qualquer status → guards que lançam Error se status ≠ PENDENTE |
| Status DESCARTADO inalcançável | MEDIUM | Nenhum método levava a `DESCARTADO` → adicionado `descartar(now)` |
| Shutdown race condition | MEDIUM | Dois handlers SIGTERM/SIGINT podiam chamar `app.close()` duas vezes → padrão `shutdownOnce` com flag |
| Outbox processor sem proteção de falha | MEDIUM | Erro em `marcarFalha` quebrava loop inteiro → try/catch individual |

### Limitações documentadas (não corrigidas — alto risco sem testes de integração)

- **Idempotency TOCTOU race**: `IdempotencyInterceptor` faz check-then-act sem lock atômico; em concorrência extrema, duas requests com mesma key podem ambas passar. Correção: `INSERT ... ON CONFLICT` atômico.
- **Advisory lock + EntityManager**: schedulers recebem `DataSource` mas repos usam repositório injetado fora da transação. Em cenário real, o repo deveria usar o `EntityManager` da transação.
- **Ausência de outbox event em PATCH status**: `AtualizarStatusFaturaUseCase` não publica evento outbox na mudança de status.
- **Sem optimistic concurrency**: tabela `faturas` não tem coluna `version` para `@Version` — última escrita ganha.


