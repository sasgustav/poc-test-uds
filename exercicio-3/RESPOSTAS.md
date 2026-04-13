# Exercício 3 — Decisão de Arquitetura: Integração com Gateways de Pagamento

## Contexto

O produto precisa integrar com três gateways de pagamento completamente diferentes: Stripe (REST moderno), Asaas (REST brasileiro) e um gateway bancário legado (SOAP/XML). Novos gateways poderão ser adicionados no futuro. A solução precisa ser extensível sem que cada novo gateway contamine o código existente.

---

## 1. Qual padrão de design eu usaria e por quê?

### Padrão principal: Strategy + Adapter

Usaria a combinação de dois padrões complementares:

**Strategy Pattern** define uma interface comum (`PaymentGateway`) que abstrai as operações de pagamento. Cada gateway implementa essa interface com sua lógica específica. O código de domínio depende apenas da interface, nunca da implementação concreta.

**Adapter Pattern** é necessário especificamente para o gateway SOAP legado. Enquanto Stripe e Asaas têm APIs REST que mapeiam naturalmente para a interface `PaymentGateway`, o gateway SOAP tem um contrato completamente diferente (XML, WSDL, operações com nomes distintos). O Adapter traduz chamadas da interface `PaymentGateway` para chamadas SOAP sem expor essa complexidade ao resto do sistema.

**Factory Pattern** complementa os dois anteriores: uma `PaymentGatewayFactory` recebe um identificador (ex: `'stripe'`, `'asaas'`, `'banco_legado'`) e retorna a implementação correta. No NestJS, isso se implementa naturalmente com injeção de dependência dinâmica.

### Por que não apenas Factory?

Factory resolve "qual instanciar", mas não resolve "como garantir que todos tenham a mesma interface". Strategy garante polimorfismo — qualquer gateway, existente ou futuro, implementa o mesmo contrato. Sem Strategy, cada novo gateway teria métodos com nomes e assinaturas diferentes, e o código chamador precisaria de if/else para cada um.

### Por que não apenas herança (Template Method)?

Herança criaria acoplamento entre gateways que não compartilham lógica. Stripe e o gateway SOAP não têm nada em comum na implementação — forçar uma classe base seria artificial. Composição via interface é mais flexível e respeita o princípio "favor composition over inheritance".

### Estrutura concreta no NestJS:

```typescript
// A interface que define o contrato — o "Port" na arquitetura hexagonal
export interface PaymentGateway {
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  getChargeStatus(chargeId: string): Promise<ChargeStatus>;
  refund(chargeId: string, amount?: number): Promise<RefundResult>;
}

// Objetos de domínio — o gateway traduz de/para estes
export interface CreateChargeInput {
  amount: number;          // Em centavos, para evitar decimais
  currency: string;        // 'BRL'
  customerId: string;
  description: string;
  idempotencyKey: string;  // Crucial para segurança em retries
}

export interface ChargeResult {
  gatewayChargeId: string;
  status: 'pending' | 'confirmed' | 'failed';
  rawResponse?: unknown;   // Resposta original do gateway, para debug
}
```

---

## 2. Como isolaria a lógica específica de cada gateway sem contaminar o domínio?

### Arquitetura Hexagonal (Ports and Adapters)

A estrutura de diretórios reflete a separação entre domínio e infraestrutura:

```
src/
├── pagamento/
│   ├── pagamento.module.ts
│   ├── domain/
│   │   ├── ports/
│   │   │   └── payment-gateway.port.ts      # Interface PaymentGateway
│   │   ├── models/
│   │   │   ├── charge.model.ts              # CreateChargeInput, ChargeResult, etc.
│   │   │   └── payment-transaction.entity.ts # Registro local de transações
│   │   └── services/
│   │       └── payment.service.ts           # Orquestra o fluxo, usa o port
│   │
│   └── infrastructure/
│       ├── gateways/
│       │   ├── stripe.adapter.ts            # Implementa PaymentGateway via Stripe SDK
│       │   ├── asaas.adapter.ts             # Implementa PaymentGateway via API Asaas
│       │   └── banco-legado.adapter.ts      # Implementa PaymentGateway via SOAP
│       └── gateway.factory.ts               # Resolve qual adapter usar
```

### Princípios de isolamento:

**O domínio nunca importa infraestrutura.** `payment.service.ts` importa apenas `payment-gateway.port.ts` (a interface). Ele não sabe se está falando com Stripe ou SOAP. Isso é injeção de dependência na prática:

```typescript
@Injectable()
export class PaymentService {
  constructor(private readonly gatewayFactory: PaymentGatewayFactory) {}

  async processarPagamento(faturaId: string, gatewayId: string): Promise<PaymentTransaction> {
    const gateway = this.gatewayFactory.getGateway(gatewayId);
    // gateway é do tipo PaymentGateway — o service não sabe qual implementação é
    const result = await gateway.createCharge({ ... });
    // Salva o resultado local
  }
}
```

**Cada adapter encapsula TODA a complexidade do seu gateway.** O `stripe.adapter.ts` importa o Stripe SDK, faz a tradução de `CreateChargeInput` para `stripe.charges.create(...)`, e converte a resposta para `ChargeResult`. O `banco-legado.adapter.ts` monta XML, faz a chamada SOAP, parseia a resposta XML, e retorna o mesmo `ChargeResult`. O domínio não sabe e não se importa.

**Testabilidade.** Para testar o `PaymentService`, basta criar um mock de `PaymentGateway`. Não precisa de SDK do Stripe, nem de servidor SOAP. Cada adapter pode ser testado isoladamente com mocks do seu SDK/client específico.

### Registro dinâmico no NestJS:

```typescript
@Module({
  providers: [
    PaymentService,
    PaymentGatewayFactory,
    { provide: 'STRIPE_GATEWAY', useClass: StripeAdapter },
    { provide: 'ASAAS_GATEWAY', useClass: AsaasAdapter },
    { provide: 'BANCO_LEGADO_GATEWAY', useClass: BancoLegadoAdapter },
  ],
})
export class PagamentoModule {}
```

A `PaymentGatewayFactory` recebe todos os adapters via `@Inject()` e resolve pelo identificador. Adicionar um novo gateway significa criar um novo adapter + registrar no module. Zero alteração no domínio.

---

## 3. Como trataria falhas parciais (ex: gateway retorna timeout após débito confirmado)?

Esse é o cenário mais perigoso em integração de pagamentos. Um timeout **não significa que a operação falhou** — pode significar que o débito aconteceu mas a resposta não chegou. Tratar timeout como falha e não cobrar pode causar prejuízo. Tratar como sucesso e cobrar de novo causa cobrança duplicada e chargeback.

### Solução: Saga Pattern com reconciliação assíncrona

O fluxo segue 4 etapas:

**Etapa 1 — Registro local ANTES da chamada ao gateway:**

```typescript
// Antes de chamar o gateway, persiste a intenção no banco local
const transaction = await this.transactionRepo.save({
  faturaId,
  gatewayId,
  amount,
  idempotencyKey: uuidv4(),
  status: 'processing',  // Estado intermediário
  createdAt: new Date(),
});
```

Isso garante que temos registro da tentativa mesmo se o processo morrer durante a chamada.

**Etapa 2 — Chamada ao gateway com idempotency key:**

```typescript
try {
  const result = await gateway.createCharge({
    ...input,
    idempotencyKey: transaction.idempotencyKey,
  });

  await this.transactionRepo.update(transaction.id, {
    status: result.status === 'confirmed' ? 'confirmed' : 'failed',
    gatewayChargeId: result.gatewayChargeId,
    gatewayResponse: result.rawResponse,
  });
} catch (error) {
  if (isTimeoutError(error)) {
    await this.transactionRepo.update(transaction.id, {
      status: 'requires_reconciliation',
      errorMessage: error.message,
    });
  } else {
    await this.transactionRepo.update(transaction.id, {
      status: 'failed',
      errorMessage: error.message,
    });
  }
}
```

A **idempotency key** é fundamental: se enviarmos a mesma key duas vezes ao Stripe, ele retorna o resultado da primeira chamada sem processar novamente. Todos os gateways sérios suportam esse conceito (no SOAP legado, implementaríamos via um campo de referência única).

**Etapa 3 — Worker de reconciliação:**

Um job agendado (similar ao do exercício 1) busca transações com status `requires_reconciliation` e consulta o gateway:

```typescript
@Cron('*/5 * * * *') // A cada 5 minutos
async reconciliar(): Promise<void> {
  const pendentes = await this.transactionRepo.find({
    where: { status: 'requires_reconciliation' },
  });

  for (const tx of pendentes) {
    const gateway = this.gatewayFactory.getGateway(tx.gatewayId);
    const status = await gateway.getChargeStatus(tx.gatewayChargeId || tx.idempotencyKey);

    if (status.confirmed) {
      await this.transactionRepo.update(tx.id, { status: 'confirmed' });
    } else if (status.notFound) {
      // Gateway não tem registro — o débito realmente não aconteceu
      await this.transactionRepo.update(tx.id, { status: 'failed' });
    }
    // Se ainda ambíguo, deixa para o próximo ciclo
  }
}
```

**Etapa 4 — O banco local é source of truth:**

A aplicação nunca consulta o gateway para saber se "o pagamento foi feito". Ela consulta a tabela `payment_transactions` local. O worker de reconciliação é o único que sincroniza o estado entre gateway e banco local. Isso desacopla o fluxo principal de negócio da disponibilidade do gateway.

### E se a reconciliação falhar persistentemente?

Após N tentativas de reconciliação sem resolução, a transação é escalada para um estado `requires_manual_review` e gera um alerta (Slack, e-mail para o time financeiro). Em pagamentos, existe um ponto onde automação precisa dar lugar a intervenção humana — é melhor escalar do que tomar a decisão errada automaticamente.

---

## 4. Onde e como armazenaria as credenciais de cada gateway?

### Ambientes e estratégias:

**Desenvolvimento local:**
- Arquivo `.env` (gitignored) com chaves de teste/sandbox dos gateways
- Carregado via `@nestjs/config` (`ConfigService`)
- O `.env.example` no repositório lista as variáveis necessárias sem valores reais

```env
STRIPE_SECRET_KEY=sk_test_...
ASAAS_API_KEY=...
BANCO_LEGADO_CERT_PATH=./certs/sandbox.pem
BANCO_LEGADO_WSDL_URL=https://sandbox.banco.com.br/service?wsdl
```

**Produção:**
- **AWS Secrets Manager** (já estamos na AWS com EC2+RDS): armazena as credenciais de forma encriptada com rotação automática
- A aplicação busca as credenciais na inicialização via SDK da AWS e cacheia em memória (com TTL para respeitar rotação)
- As credenciais NUNCA passam por variáveis de ambiente do EC2 em produção — isso exporia elas em metadata e process dumps

```typescript
@Injectable()
export class SecretsService {
  private cache = new Map<string, { value: string; expiresAt: number }>();

  async getSecret(secretName: string): Promise<string> {
    const cached = this.cache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    this.cache.set(secretName, {
      value: response.SecretString!,
      expiresAt: Date.now() + 5 * 60 * 1000, // Cache por 5 minutos
    });

    return response.SecretString!;
  }
}
```

**Multi-tenant (futuro — cada cliente com seus gateways):**
- A tabela `tenant_gateway_config` armazena o identificador do secret no Secrets Manager (ex: `prod/tenant-123/stripe`), nunca a chave em si
- O adapter resolve a credencial em runtime: `const key = await this.secrets.getSecret(tenant.stripeSecretArn)`
- Isso permite que cada tenant use chaves diferentes sem alterar código

### Segurança adicional:

- **Princípio do menor privilégio**: a IAM role do EC2 tem permissão apenas para `secretsmanager:GetSecretValue` nos ARNs específicos dos gateways
- **Audit trail**: o Secrets Manager loga todo acesso no CloudTrail, permitindo rastrear quem acessou qual credencial e quando
- **Rotação**: configurar rotação automática (Stripe permite múltiplas API keys ativas simultaneamente, facilitando rotação zero-downtime)
- **Gateway SOAP legado com certificado**: o certificado `.pem` é armazenado como secret, escrito em disco temporário em runtime (`/tmp/cert.pem`), e removido no shutdown da aplicação. Nunca versionado no Git.
