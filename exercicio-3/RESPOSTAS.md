# ADR 001 — Integração Multi-Gateway de Pagamentos

- **Status**: Proposed
- **Data**: 2026-04-14
- **Autor**: Gustavo Vasconcelos
- **Tags**: payments, integrations, hexagonal, pci

---

## 1. Contexto

O produto precisa integrar três gateways com superfícies completamente
diferentes, com expectativa de adicionar mais:

| Gateway | Protocolo | Auth | Idempotência nativa | Webhook signature | Reconciliação |
|---------|-----------|------|---------------------|-------------------|---------------|
| **Stripe** | REST/JSON, HTTP/2 | `Authorization: Bearer sk_live_...` | `Idempotency-Key` header | HMAC-SHA256 + timestamp tol. ±5min | Events API (paginated) |
| **Asaas** | REST/JSON | `access_token` header | ❌ — implementar via `externalReference` + tabela local | HMAC-SHA1 no body | Webhook + polling |
| **Banco Legado (mock)** | SOAP/XML sobre HTTPS + mTLS | Cert cliente x.509 | ❌ — sequencial-ID gerado localmente | mTLS (sem body signature) | Arquivo CNAB 240 (batch diário) |

O desafio é ter uma API interna **única** para "cobrar fatura", "capturar
webhook", "reconciliar" sem que a heterogeneidade vaze para quem usa.

### Decision Drivers

1. **Extensibilidade** — novo gateway entra em 1 classe, não rewriting.
2. **Testabilidade** — regra de negócio não pode depender de HTTP real.
3. **PCI scope mínimo** — app nunca toca PAN/CVV; só tokens.
4. **Failure isolation** — gateway caindo não derruba fluxo de outros.
5. **Time-to-market** — solução implementável em 2 sprints.
6. **Vendor risk** — poder trocar Stripe↔Adyen sem rewriting.

---

## 2. Opções consideradas

### Opção 1 — Strategy + Adapter + Factory em Hexagonal (**escolhida**)

Port `PaymentGateway` no domínio; adapters por gateway; Factory decide qual
adapter usar por fatura (critério: país/valor/prioridade/feature-flag).

### Opção 2 — Template Method

Classe abstrata `BasePaymentGateway` com `charge()` template, hooks
`authenticate()`, `buildRequest()`, `parseResponse()`.

### Opção 3 — Middleware chain

Cada gateway é um handler numa chain; o "manager" decide quem aceita.

### Opção 4 — Unified gateway (ex.: Stripe Connect, Pagar.me Hub)

Um único provider que abstrai os outros. Zero código de adapter nosso.

---

## 3. Matriz de tradeoffs

| Critério | Strategy+Adapter | Template Method | Middleware | Unified |
|----------|:---:|:---:|:---:|:---:|
| Acoplamento domain ↔ provedor | **Zero** (port) | Médio (herança) | Zero | Alto (lock-in) |
| Custo de adicionar gateway | 1 classe + factory entry | 1 subclasse + mudança na base se shape novo | 1 middleware + config | 0 (provedor faz) |
| Testabilidade (mock do port) | **Alta** | Média (mock da base) | Média | Baixa (HTTP real ou mock complexo) |
| Stack depth / debug | +2 frames | +1 | +N (chain size) | +opaco |
| Falha isolada | **Sim** | Sim | Parcial | **Não** (todos dependem dele) |
| Suporta SOAP + REST + mTLS | **Sim** (cada adapter livre) | Forçado (shape comum na base) | Sim | Limitado ao que o provider aceita |
| PCI scope | Mínimo (tokens) | Mínimo | Mínimo | Mínimo mas terceirizado |
| Vendor lock-in custo de sair | **Baixo** (reescrever 1 adapter) | Baixo | Baixo | **Alto** (reescrever integração inteira) |
| Time-to-market | 2 sprints | 1.5 sprints | 2 sprints | 1 sprint |

**Decisão:** Opção 1. Template Method perde quando o shape dos providers é
heterogêneo (SOAP + JSON no mesmo hierarquia vira enforcement torto).
Middleware perde em debug (stack fundo) e em "qual middleware aceitou" não é
natural. Unified troca 3 lock-ins por 1 maior.

---

## 4. Desenho escolhido

### 4.1 Port no domínio

```typescript
// src/pagamento/domain/ports/payment-gateway.port.ts
export interface PaymentGateway {
  readonly name: 'stripe' | 'asaas' | 'banco-legado';
  charge(cmd: ChargeCommand): Promise<ChargeResult>;
  refund(paymentId: string, amount: Money): Promise<RefundResult>;
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): WebhookEvent;
}
```

### 4.2 Diagrama de componentes (hexágono)

```
                      ┌─────────────────────────────┐
                      │     Domain (puro)           │
                      │  Pagamento · Money          │
                      │  PaymentGateway (port)      │
                      │  WebhookVerifier (port)     │
                      └─────┬───────────────────┬───┘
                            │                   │
            ┌───────────────▼─────┐    ┌────────▼──────────┐
            │ Application         │    │                   │
            │ IniciarPagamentoUC  │    │  WebhookHandlerUC │
            │ ReconciliarUC       │    │                   │
            │ GatewayRouter       │    │                   │
            └──┬────────────┬─────┘    └────┬──────────────┘
               │            │               │
               ▼            ▼               ▼
   ┌───────────────────────────────────────────────────┐
   │              Infrastructure adapters              │
   │  StripeGateway    AsaasGateway   BancoLegadoGW    │
   │  (REST + HMAC)    (REST + HMAC)  (SOAP + mTLS)    │
   │                                                    │
   │  SecretsManagerClient   WebhookEventDedupeRepo     │
   │  ReconciliationScheduler                           │
   └───────────────────────────────────────────────────┘
```

### 4.3 Sequência — happy path

```
Client → App: POST /v1/pagamentos { faturaId, method: 'pix' }
App → GatewayRouter: qual gateway pra (BR, pix, R$500)?
Router → App: 'asaas'
App → AsaasGateway.charge(cmd)
AsaasGateway → Asaas HTTP: POST /payments Idempotency via externalReference
Asaas HTTP → AsaasGateway: 200 { id: 'pay_123', status: 'PENDING' }
AsaasGateway → App: ChargeResult(PENDING, externalRef)
App persiste Pagamento(PROCESSING) + outbox_event.PagamentoIniciado
App → Client: 202 Accepted { id, status: 'processing' }

[ minutos depois ]
Asaas Webhook → App: POST /webhooks/asaas (evento PAID)
App → AsaasGateway.verifyWebhook(headers, rawBody) → sig OK + eventId
App → WebhookEventRepo.tryRegister(eventId)  ← idempotência de webhook
App → Pagamento.confirmar(), outbox_event.PagamentoConfirmado
App → Client event bus: "pagamento.confirmado"
```

### 4.4 Sequência — falhas

```
[1] Timeout ao charge: retry com jitter + status = REQUIRES_RECONCILIATION
[2] Webhook com sig inválida: 401, log estruturado, sem persistência
[3] Webhook duplicado (eventId já visto): 200 OK, no-op (idempotente)
[4] 5xx recorrente: circuit breaker abre → GatewayRouter roteia para fallback
[5] Gateway confirma mas app não recebeu webhook: cron de reconciliação
    consulta status por externalRef (polling fallback)
```

### 4.5 State machine do pagamento

```
                   ┌────────┐ charge()          ┌─────────────┐
                   │INITIATED├──────────────────►│ PROCESSING  │
                   └────────┘                   └──────┬──────┘
                                                       │
                  ┌─── timeout/err ── webhook.paid ────┤
                  ▼                     ▼              │
       ┌──────────────────────┐   ┌──────────┐         │
       │REQUIRES_RECONCILIATION│  │CONFIRMED │         │
       └─────┬────────────────┘   └──────────┘         │
             │ cron reconc                             │
             ├─► CONFIRMED (ok)                        │
             └─► MANUAL_REVIEW (divergência)           │
                                                       ▼
                                                 ┌──────────┐
                                                 │  FAILED  │
                                                 └──────────┘
```

### 4.6 Deployment

```
      ┌───────────────┐
 ┌────┤ Secrets Mgr   │ (rotation)
 │    └───────────────┘
 │    ┌───────────────┐
 │    │  KMS (envelope│───► caches credenciais em mem TTL
 │    │   encryption) │
 │    └───────────────┘
 │
 ▼
App (AZ-A) ──────────────────────────► Stripe (globo)
App (AZ-B) ──────────────────────────► Asaas (BR)
      │
      └──── mTLS ────────────────────► Banco Legado SOAP (BR, on-prem)
      │
      └──── OTel ────► Collector ────► Jaeger + Prometheus + Loki
```

---

## 5. FMEA (Failure Mode & Effects Analysis)

| # | Modo de falha | Detecção | Mitigação | Blast radius |
|---|---------------|----------|-----------|--------------|
| 1 | Stripe 5xx | `payment_errors_total{gw="stripe",class="5xx"}` | Retry com jitter (3×) → circuit breaker abre → GatewayRouter fallback Asaas | Transações de cartão internacional caem durante a janela |
| 2 | Asaas timeout (>10s) | `payment_latency_ms{gw="asaas"}` p99 | Timeout explícito 8s + retry 2× + marca `REQUIRES_RECONCILIATION` | Transações BR; reconciliação cron limpa |
| 3 | SOAP cert expirado | Alerta `cert_days_until_expiry < 30` | Rotação automática via ACM + notify antecipado | Banco legado cai silenciosamente se não monitorado |
| 4 | Webhook com sig inválida (tentativa maliciosa) | `webhook_rejected_total{gw,reason}` | Rejeita 401, log + rate limit por IP | Zero — sig verifica antes de persistir |
| 5 | Webhook duplicado | `webhook_duplicate_total{gw}` | Tabela `webhook_events(eventId UNIQUE)`, INSERT → se conflito, no-op | Zero — idempotência garantida |
| 6 | Replay attack (webhook antigo reemitido) | `webhook_timestamp_skew_seconds` | Rejeita se `|now - ts| > 5min` (tolerância do provider) | Zero |
| 7 | Double-charge por retry sem idempotency | (bug de implementação) | Asaas: `externalReference` único por fatura; SOAP: sequential-ID gerado com lock + tabela. Stripe: nativo | Financeiro — clientes cobrados 2× |
| 8 | Confirmado no gateway, perdido em trânsito | Cron reconciliação + gap > 1h → `MANUAL_REVIEW` | Query Events API diariamente, cross-check com pagamentos locais | Operacional — intervenção manual |
| 9 | Leak de segredo no log | Grep CI + redact paths em pino | Secrets nunca em log; HTTP client com interceptor redact | Crítico — rotação + postmortem |
| 10 | Gateway cobra moeda errada (BRL vs USD) | Validação DTO + asserção `response.currency == expected` | Falha no charge com erro domain | Zero se detectado antes de commit |

---

## 6. Observabilidade por gateway

### Métricas (Prometheus)

```
payment_latency_ms{gateway,method,result}         histogram
payment_success_rate{gateway}                     derived
webhook_verify_duration_ms{gateway,result}        histogram
webhook_duplicate_total{gateway}                  counter
webhook_rejected_total{gateway,reason}            counter  # sig invalid | skew | parse
reconciliation_lag_seconds                         gauge
manual_review_queue_depth                          gauge
gateway_circuit_breaker_state{gateway}             gauge   # 0=closed,1=open,2=half
```

### Distributed tracing

Cada charge cria um span `payment.charge` com atributos:

```
payment.id, payment.gateway, payment.method, payment.amount_cents,
gateway.request_id (vendor), gateway.http_status,
pagamento.idempotency_key
```

`traceId` é propagado até Stripe quando possível (header `traceparent`) — útil
pra rastrear "nosso request X corresponde a qual cobrança deles".

### Log schema

```json
{
  "msg": "payment.charge",
  "traceId": "...",
  "faturaId": "...",
  "gateway": "stripe",
  "idempotencyKey": "...",
  "status": "CONFIRMED",
  "duration_ms": 187,
  "gateway_request_id": "req_abc"
}
```

Credenciais/PAN/CVV nunca logados — `pino.redact` com paths explícitos +
ESLint rule custom para barrar `console.log` no módulo de pagamento.

---

## 7. Segurança

### 7.1 Webhook verification por gateway

| Gateway | Mecanismo | Tolerância skew |
|---------|-----------|-----------------|
| Stripe | `Stripe-Signature` HMAC-SHA256(timestamp + "." + payload) | ±5min |
| Asaas | `asaas-signature` HMAC-SHA1(payload) | configurável |
| Banco Legado | mTLS + IP allowlist | N/A (SOAP push) |

Para todos: **eventId único** em `webhook_events(id PK, gateway, received_at)`.
`INSERT ... ON CONFLICT DO NOTHING` dá idempotência em 1 roundtrip.

### 7.2 Replay attack prevention

Timestamp obrigatório dentro da tolerância. Nonce (eventId) na UNIQUE key
impede mesmo evento processado 2×. Janela tolerância curta (5min) reduz
espaço para atacante fazer replay longe do tempo original.

### 7.3 PCI scope

App **nunca** toca PAN/CVV:

- Frontend usa `Stripe Elements` (ou equivalente Asaas) — tokeniza direto no
  browser → backend recebe `pm_...` token.
- SOAP legado: mesma ideia — cliente envia token de sessão da página do
  banco, app apenas invoca "cobrar com este token".
- Data classification: `Pagamento.token` é PCI-scope (criptografado at-rest,
  TLS 1.3 em trânsito); `Pagamento.id`, `amount`, `status` são metadata PII.

### 7.4 Secrets rotation

- **Stripe keys**: rotação trimestral via Lambda rotation function do AWS
  Secrets Manager. Keys versioned — 7d overlap window pro webhook continuar
  verificando durante rotação (dois HMAC aceitos).
- **Certificado SOAP**: ACM Private CA, renovação automática T-30d; alerta
  T-45d; cobre o caso de falha de automação.
- **KMS envelope**: credencial em cache tem data key encrypted com CMK. App
  processo descriptografa na boot + refresh a cada 1h.

---

## 8. SLO / SLI / Capacity

| SLI | SLO | Janela | Justificativa |
|-----|-----|--------|---------------|
| `(settled_within_60s + failed_with_clear_error) / total` | 99.5% | 30d | Cobre: confirmação fast-path OU falha explícita. "Pendente indefinido" é violação. |
| Webhook verificado e processado | 99.95% / 7d | 7d | Perder webhook = fatura não confirma; reconc cron só limpa depois. |
| p95 latência `payment.charge` | < 2s Stripe / 3s Asaas / 8s SOAP | 7d | Limites vindos de observação empírica + SLA do vendor. |
| Reconciliação lag | p99 < 1h | 30d | Cron horário; acima disso viola UX. |

### Load expected

- Pico dezembro: 500 tx/min (média); 2000 tx/min (pico 10min durante Black Friday).
- Sustain: 60 tx/min.
- Budget error: 0.5% × 30d × 86400 × tx/s ≈ margem para 12h de indisponibilidade
  por mês.

### Chaos testing

- Inject latency 10s em Stripe via toxiproxy → assertar fallback kicks in em
  ≤ 1s.
- Kill Asaas mid-transaction → assertar pagamento vai pra
  `REQUIRES_RECONCILIATION`, cron confirma ou marca `MANUAL_REVIEW`.
- Simular 5 × 500 errors consecutivos do SOAP → circuit breaker abre; novas
  requests falham fast com "gateway unavailable" em vez de esperar timeout.

---

## 9. Multi-região e vendor lock-in

### Multi-região

- Secrets Manager replication cross-region (us-east-1 ↔ sa-east-1) — failover
  de região não invalida credenciais cache.
- Endpoints de gateways são globais (Stripe) ou BR-only (Asaas, Banco) — em
  DR region, BR gateways continuam funcionando; Stripe via endpoint global.

### Failover policy do `GatewayRouter`

```
Métricas colhidas: success_rate{gw} por 5min.
Ordem de preferência por fatura BR:
  1. Asaas (fee 2.49%, sucesso 99.5%)
  2. Stripe (fee 2.9% + 0.39, sucesso 99.99% — fallback de custo alto)
  3. Banco Legado (fee BRL 2.50 fixo — usado só para B2B >R$10k, offline OK)

Se Asaas success_rate{5m} < 98% → routing skip Asaas até recuperar.
```

### Custo de vendor lock-in quantificado

- Trocar Stripe → Adyen: reescrever `StripeGateway` (~80h dev + 40h QA +
  certificação PCI). Vale se fee economy > **R$ 8.000/mês** (ROI 12 meses
  considerando 80h × R$ 150 + overhead).
- Trocar Banco Legado SOAP → novo banco SOAP: ~120h (SOAP é mais verboso +
  tests de mTLS). Vale se fee diferencial > **R$ 12.000/mês**.

Essa quantificação é a virtude do padrão: o cálculo "quanto custa sair" é
concreto, não handwaving.

---

## 10. Consequências

### Positivas

- Novo gateway = 1 classe + 1 entry no `GatewayRouter`. Sem tocar use-cases.
- Testes de regra (`IniciarPagamentoUseCase`) rodam com `FakeGateway` em ms.
- Circuit breaker + fallback = 0 downtime de produto quando 1 gateway cai.
- Idempotência + reconciliação = 0 double-charge + 0 pagamento perdido.

### Negativas

- **Code surface**: 3 adapters + webhook handlers = mais superfície pra
  manter. Mitigação: testes de contrato por gateway + shared test helpers.
- **Debug cross-gateway**: trace precisa incluir qual adapter atendeu. Já
  coberto pelo span attribute `payment.gateway`.
- **Config complexa**: cada adapter tem secrets + URLs de sandbox/prod + TOS
  diferentes. Mitigação: Zod schema com `API_KEY_STRIPE`, `API_KEY_ASAAS`,
  `SOAP_CERT_PATH` etc., fail-fast no boot.

### Neutras

- Precisa de Secrets Manager + KMS na stack — já justificados por outras
  partes do produto (não são custo novo desse ADR).
- Webhook events table = ~10k linhas/dia, retenção 90d = manageable. Purga
  por TTL.

---

## 11. Referências

- Martin Fowler, *Patterns of Enterprise Application Architecture* — Gateway,
  Strategy.
- AWS Architecture Blog (2015), *Exponential Backoff and Jitter*.
- IETF draft *The Idempotency-Key HTTP Header Field*.
- Stripe API docs — webhook signing, rotation.
- PCI DSS v4.0 — scope reduction via tokenization.
- Kleppmann, *Designing Data-Intensive Applications*, cap. 11 (stream processing,
  at-least-once semantics).
