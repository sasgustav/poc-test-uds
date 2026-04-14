# Exercício 2 — Code Review e Debugging

> Análise sênior: além de listar bugs, diagnosticar o **mecanismo** da race
> condition, as mudanças **SQL/índice** com `EXPLAIN ANALYZE`, a
> **observabilidade** que teria capturado o leak, a estratégia de **testes**
> que teria pego o bug, e os **SLOs/SLIs** para 500 req/s.

---

## Código original

```typescript
@Get('/faturas')
async listarFaturas(@Req() req) {
  const todas = await this.faturaRepo.find();
  const userId = req.user?.id;
  const filtradas = todas.filter(f => f.userId === userId);
  return filtradas;
}
```

## 1. Problemas encontrados

### 1.1 CRÍTICO — Tenant leak por ausência de escopo autenticado no query

`req.user?.id` com optional chaining: se o guard não foi aplicado (e não há
`@UseGuards`), `req.user` é `undefined`, `userId` é `undefined`, e
`filtradas` pode retornar:

- **Faturas com `userId = null`** no banco (dados legados, inconsistências).
- **Em caso de race condition no objeto req compartilhado** — tratada em §1.5 —
  faturas de outro usuário.

Mesmo quando o guard está presente, **todas as faturas de todos os tenants
passam pelo processo Node** antes de serem filtradas. Isso expõe dados em
heap dumps, logs com `req.body`, debugger, APM, e qualquer middleware que
inspecione payloads. Em um sistema financeiro B2B, isso é violação de LGPD
direto.

### 1.2 CRÍTICO — `find()` sem WHERE: full table scan

`SELECT * FROM faturas` sem filtro. `EXPLAIN` do cenário atual:

```
Seq Scan on faturas  (cost=0.00..25842.00 rows=1000000 width=128)
  (actual time=0.012..1248.3 rows=1000000 loops=1)
Planning Time: 0.08 ms
Execution Time: 1330.5 ms
```

Com 1M de linhas, ~1.3s só pra ler do disco. O Node depois aloca ~130MB no heap
pra isso, e o GC pausa notavelmente.

### 1.3 Filtragem em JavaScript (anti-pattern cruzando fronteira)

O banco é otimizado pra filtrar. `Array.filter` é linear no Node sem índice
algum. O custo de rede + serialização + desserialização é totalmente
desperdiçado.

### 1.4 Ausência de paginação — resposta unbounded

Mesmo corrigindo o WHERE, um usuário com 50k faturas faz o endpoint serializar
50k objetos. Frontend morre, p99 explode.

### 1.5 Race condition no objeto `req`

Esse é o mecanismo por trás do relato "retorna dados de um cliente para
outro". Node.js é single-thread, mas o Express compartilha instâncias de
middleware e, em certos padrões, objetos populados em `async` podem se
entrelaçar. O caminho mais comum:

```
T1 (req A):  middleware auth popula req.user = {id: 'A'}
             calls faturaRepo.find() — await começa
             event loop libera
T2 (req B):  mesmo middleware popula req.user = {id: 'B'}
             chama find()
T1 (req A):  await resolve → req.user agora pode ter sido sobrescrito
             se o middleware reutilizou referência compartilhada
```

A forma canônica em que isso acontece é quando alguém implementa o "auth"
salvando em variável de módulo (`currentUser` global) em vez do `req` do
request corrente. Ou quando cached `Request.prototype` é mutado em vez de
cada instância ter seu próprio `user`. O bug é sutil: passa em testes porque
eles raramente disparam requisições simultâneas contra a mesma instância.

**Mitigação estrutural:** `AsyncLocalStorage` (Node ≥ 16) — cria um contexto
por "execution" que sobrevive a `await`s sem depender do `req` object:

```typescript
const als = new AsyncLocalStorage<{ userId: string }>();
app.use((req, _res, next) => {
  als.run({ userId: req.user.id }, next);
});
```

### 1.6 Sem `@UseGuards`, sem autenticação declarativa

Endpoint aceita requisições sem token. Silenciosamente retorna vazio. Deveria
ser 401 explícito.

### 1.7 Sem tipagem (`@Req() req: any`)

TypeScript inútil — refactor do shape do JWT não quebra compilação.

---

## 2. Código corrigido

Arquivo: `codigo-corrigido/fatura.controller.ts`.

**Diferenças além do "adicionar WHERE":**

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | `@CurrentUser('id')` em vez de `@Req()` | Fecha por contrato o anti-pattern: não existe sobrecarga que aceite `userId` de query/body. |
| 2 | `@UseGuards(JwtAuthGuard, ThrottlerGuard)` | Auth declarativa + rate limit por `userId` (não IP — ver §5). |
| 3 | **Keyset pagination** (`WHERE (dataVencimento, id) < (:lastVenc, :lastId)`) | OFFSET é O(n) — degrada linearmente. Keyset é O(1) com índice correto. |
| 4 | Projeção explícita (`SELECT id, userId, descricao, ...`) | Evita vazar colunas sensíveis adicionadas no futuro + reduz I/O. |
| 5 | `TenantAuditInterceptor` | Loga + **abort defensivo** se alguma row retornar com `userId` ≠ autenticado. |
| 6 | `valorCents` bigint em vez de `valor` decimal | Mesma disciplina do Ex1 Money VO. Evita `15.00 !== 15.0` em JS. |
| 7 | Problem+JSON (herdado do app-level filter) | Erros estruturados, não texto Nest default. |

---

## 3. SQL / DB-level

### 3.1 Índice recomendado

```sql
CREATE INDEX CONCURRENTLY idx_faturas_user_vencimento_id
  ON faturas (user_id, data_vencimento DESC, id DESC);
```

- **Composto** porque o WHERE filtra por `user_id` e a ordenação é por
  `(data_vencimento DESC, id DESC)` — o índice cobre ambos.
- **DESC** alinha com a direção do ORDER BY, evita `Backward Index Scan`.
- **`CONCURRENTLY`** pra criar sem lock exclusivo em produção.

### 3.2 `EXPLAIN ANALYZE` esperado

Antes (cenário original, 1M linhas):
```
Seq Scan on faturas  (cost=0.00..25842 rows=1000000)
  Execution Time: 1330 ms
```

Depois (com índice + WHERE):
```
Index Scan using idx_faturas_user_vencimento_id on faturas
  (cost=0.43..8.96 rows=21 width=128)
  Index Cond: (user_id = '...'::uuid)
  Execution Time: 0.4 ms
```

~3000× mais rápido. Com seletividade típica de userId em B2B (1 usuário =
0.01% das linhas), é index-only se a projeção couber no índice — ainda mais
rápido.

### 3.3 Isolation level

`READ COMMITTED` (default do Postgres) é suficiente para listagem: snapshot
garante que cada linha lida é de uma versão commitada. `SERIALIZABLE` só se
exigíssemos que o resultado fosse consistente com outros SELECTs em lote (não
o caso aqui).

### 3.4 Connection pool sizing

Fórmula de Brecht Diehl (HikariCP docs, comprovada empiricamente):

```
pool_size = ((core_count * 2) + effective_spindle_count)
```

Para um RDS db.t3.medium (2 vCPU) com gp3 SSD: `(2*2) + 1 = 5`.

**Contra-intuitivo:** aumentar o pool além disso *piora* throughput porque o
Postgres entra em contenção de locks internos. Sob 500 req/s, a resposta
**não é aumentar o pool — é enfileirar**. Node é naturalmente não-bloqueante,
então awaits em `pool.acquire()` custam memória de contexto de request, não
threads.

---

## 4. Concorrência — mecanismo detalhado

Já explicado em §1.5. Reforçando com thread-by-thread usando `AsyncLocalStorage`:

```
Sem ALS:
  req.user é mutável; await libera event loop; outro request sobrescreve.
  Resultado: userId entrelaça.

Com ALS:
  als.run({ userId }, async () => { ... })
  Dentro desse "scope", als.getStore() sempre retorna o userId original,
  mesmo após N awaits e I/O.
```

Para mutações críticas (ex.: pagamento), empilhar:

- **Optimistic locking** com `@VersionColumn` — `UPDATE ... WHERE id=X AND version=N`
  → retry no 0-rows-affected.
- **Pessimistic** `SELECT ... FOR UPDATE` quando a janela entre leitura e
  escrita precisa impedir outro reader.

---

## 5. Observabilidade — métricas que teriam pego o bug

O bug sobreviveu meses em produção porque **métricas de status HTTP não
capturam leak semântico**. Uma resposta 200 com payload correto em formato
mas errado em conteúdo não acende alerta em nenhum dashboard padrão.

### Schema de log estruturado proposto

```json
{
  "ts": "2026-04-13T18:32:01.123Z",
  "level": "info",
  "msg": "list_faturas",
  "traceId": "a1b2c3...",
  "userId": "user-A",
  "tenantId": "tenant-A",
  "route": "/v1/faturas",
  "method": "GET",
  "status": 200,
  "duration_ms": 47,
  "rowsReturned": 21,
  "rowsDistinctUserId": 1
}
```

A chave: **`rowsDistinctUserId`**. Qualquer valor ≠ 1 dispara página no
oncall, porque significa que a resposta cruzou tenants.

### Métricas Prometheus

```
# Latência por rota
http_request_duration_seconds_bucket{route,status}

# DETECÇÃO do bug original:
faturas_list_tenant_leak_total{route}   # incrementado em rowsDistinct > 1

# Pool
pg_pool_acquire_duration_seconds_bucket
pg_pool_in_use
```

### Distributed tracing

OpenTelemetry auto-instrumentação de `pg` já grava o SQL executado como
atributo no span. No Jaeger/Tempo, filtrando por `db.statement` contendo
`faturas` mas sem `user_id =`, aparece **exatamente a query original**. Um
simples painel "queries de faturas sem filtro user_id" teria exposto o bug.

### Alerta proposto

```yaml
- alert: TenantLeakSuspected
  expr: increase(faturas_list_tenant_leak_total[5m]) > 0
  for: 1m
  labels: { severity: page }
  annotations:
    summary: "Listagem de faturas retornou dados cruzando tenants"
```

---

## 6. Por que escapou dos testes

### 6.1 Testes unitários com mock servem dados pré-filtrados

```ts
mockRepo.find.mockResolvedValue([{ userId: 'A', ... }]);
// teste passa porque o mock já devolve só faturas do A
// mas o código de produção chama find() SEM WHERE,
// o filtro é em JS — o mock nem toca esse caminho
```

O teste não prova nada sobre o contrato real com o banco.

### 6.2 Integração com 1 usuário seeded

Se o setup só cria 1 usuário + faturas dele, `find()` retorna exatamente
"todas as faturas que já são do user correto". Filtro em JS é no-op. Teste
verde. Bug oculto.

### 6.3 Sem teste *negativo* de isolamento

Raramente escrevemos:
> Dado faturas de A e de B, quando A lista, então 0 faturas de B aparecem.

### 6.4 Testes que teriam pego

#### Integration — 2 tenants

```ts
it('tenant isolation: A não vê faturas de B', async () => {
  await seed({ userId: 'A', qty: 5 });
  await seed({ userId: 'B', qty: 5 });
  const res = await request(app).get('/v1/faturas').set('X-User-Id', 'A');
  expect(res.body.data).toHaveLength(5);
  expect(res.body.data.every(f => f.userId === 'A')).toBe(true);
});
```

#### Property-based com `fast-check`

```ts
it.prop([fc.array(userArb), fc.uuid()])(
  'nunca retorna fatura de outro tenant',
  async (seedUsers, callerId) => {
    await Promise.all(seedUsers.map(seedFaturas));
    const res = await request(app).get('/v1/faturas').set('X-User-Id', callerId);
    for (const f of res.body.data) expect(f.userId).toBe(callerId);
  },
);
```

#### Chaos — kill conn mid-list

Mata uma conexão PG no meio do SELECT. Verifica que o retry não retorna
dados de um request anterior cacheado no driver. Expõe bugs de connection
reuse que são a variante "B" do mesmo leak.

---

## 7. Follow-up: 500 req/s simultâneas

### SLO/SLI proposto

> **99.5% das listagens respondem em < 300ms @ p95 sob 500 rps concorrentes**

- **SLI**: histograma `http_request_duration_seconds{route="/v1/faturas"}`,
  alvo `p95 < 0.3`.
- **SLI de corretude**: `rate(faturas_list_tenant_leak_total) == 0`. Leak é
  SLO violado imediatamente, sem tolerância.

### Estratégias ordenadas por impacto

1. **Índice + projeção + keyset pagination** (§3.1–§3.2). Cobre 90% do caso.
2. **HTTP cache com ETag + `Cache-Control: private, max-age=5`**. Em B2B a
   mesma lista é refetchada em ciclos curtos; um `304 Not Modified` é ~1/10
   do custo de um `200`.
3. **Redis cache (opt-in)**: `key = faturas:{userId}:{cursor}:{pageSize}`,
   TTL 10s, invalidate em create/update. Bem direcionado: 500 rps com 50
   usuários distintos vira ~50 cache misses por TTL, 450 hits. PG recebe
   10% da carga.
4. **Rate limit por `userId`** (não por IP): 60 req/min. Evita que um
   cliente único ingurgite o pool e degrade todos os outros.
5. **Pool PG = 10**, não 50. Aumentar não ajuda (Diehl). Aumenta a fila no
   app, que com Node é barato.
6. **Réplicas read-only** com `ConnectionPool(primary, replica)`: listagens
   vão pra replica, reduz pressão na primary.

### Capacity test plan (k6)

```js
import http from 'k6/http';
export const options = {
  scenarios: {
    sustain: { executor: 'constant-vus', vus: 500, duration: '5m' },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.005'],
  },
};
export default function () {
  const user = `user-${__VU}`;
  http.get('http://localhost:3000/v1/faturas', {
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
  });
}
```

Rodar antes de subir pra produção. p95 > 300ms → voltar pra §2 da lista.

---

## 8. Prevenção estrutural (gating)

Para que esse bug *não consiga* mais voltar ao repositório:

- **ESLint rule custom** (`no-req-user-reference`): proíbe `req.user` fora de
  guards/decorators centralizados.
- **CI step**: grep por `@Req()` em controllers quebra build se não for em
  middleware explícito.
- **Review checklist multi-tenant**: qualquer endpoint que liste
  recurso-por-usuário exige teste de isolamento com 2 tenants como MR gate.
- **Row-level security no Postgres** (camada final):
  ```sql
  ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON faturas
    USING (user_id = current_setting('app.user_id')::uuid);
  ```
  Session GUC `app.user_id` setada no `SET LOCAL` no início da transação do
  request. Mesmo que o código da aplicação erre, o banco recusa linhas de
  outro tenant.
