# Exercício 2 — Code Review e Debugging

## Código Original (com problemas)

```typescript
@Get('/faturas')
async listarFaturas(@Req() req) {
  const todas = await this.faturaRepo.find();
  const userId = req.user?.id;
  const filtradas = todas.filter(f => f.userId === userId);
  return filtradas;
}
```

---

## 1. Identificação de TODOS os problemas

### Problema 1 — Performance: Full table scan + carregamento em memória

`this.faturaRepo.find()` sem nenhum filtro WHERE carrega **toda a tabela `faturas`** para a memória da aplicação. Com 10.000 faturas, isso transfere megabytes do banco para o Node.js a cada requisição. Com 100.000, é quase certo que causa timeout ou OOM. Esse é o motivo da "lentidão intermitente" descrita no cenário — conforme a tabela cresce, o endpoint degrada progressivamente.

O agravante é que o filtro é aplicado em JavaScript (`Array.filter`), não no SQL. Ou seja, o banco faz o trabalho pesado de ler todas as linhas, a rede transfere tudo, o Node.js aloca memória para tudo, e só então descarta o que não precisa. É o pior dos mundos em termos de eficiência.

### Problema 2 — CRÍTICO: Vazamento de dados entre usuários (broken tenant isolation)

Este é o bug mais grave. O `req.user?.id` usa optional chaining (`?.`), o que significa que se `req.user` for `undefined` (requisição sem autenticação), `userId` será `undefined`. A comparação `f.userId === undefined` pode retornar faturas de outros usuários que tenham `userId` nulo/undefined no banco.

Mas mesmo no cenário "feliz" (usuário autenticado), todas as faturas de todos os usuários foram carregadas na memória do processo. Se houver qualquer logging, middleware de debug, ou memory dump, os dados de outros clientes estão expostos. Em um produto financeiro B2B, isso é uma violação de compliance que pode ter consequências legais.

O cenário de "retorna dados de um cliente para outro" descrito no problema pode acontecer por race conditions no carregamento: se sob alta carga o garbage collector mover objetos ou se houver algum caching intermediário mal configurado, referências cruzadas podem ocorrer.

### Problema 3 — Ausência de guard de autenticação

Não há `@UseGuards()` no método nem no controller. O endpoint aceita requisições de qualquer origem, autenticada ou não. O `req.user?.id` falha silenciosamente ao invés de rejeitar a requisição com 401. Em um sistema financeiro, todo endpoint que retorna dados de um usuário DEVE exigir autenticação explícita.

### Problema 4 — Ausência de paginação

O endpoint retorna todas as faturas do usuário de uma vez. Se um cliente tem 5.000 faturas, são 5.000 objetos JSON serializados e enviados na resposta. Isso impacta tempo de resposta, consumo de banda e performance do frontend que precisa renderizar tudo.

### Problema 5 — Ausência de tipagem

`@Req() req` não tem tipagem — é implicitamente `any`. O método não declara tipo de retorno. Isso significa que:
- O compilador TypeScript não consegue validar acessos a propriedades
- Refatorações no formato do token JWT ou no objeto user não geram erros de compilação
- O código parece JavaScript com decorators, anulando o valor do TypeScript

### Problema 6 — Filtragem na aplicação ao invés do banco de dados

Mesmo que o `find()` tivesse um filtro, a lógica de negócio (filtrar por userId) deveria estar no SQL, não no JavaScript. O banco de dados é otimizado para filtrar dados — tem índices, query planner, e pode retornar apenas as linhas necessárias. Filtrar na aplicação é um anti-pattern que não escala.

---

## 2. Código Corrigido

O código corrigido está em `codigo-corrigido/fatura.controller.ts`. Aqui está a versão com explicação inline:

```typescript
import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FaturaService } from '../services/fatura.service';
import { Fatura } from '../entities/fatura.entity';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface AuthenticatedUser {
  id: string;
  email: string;
}

@Controller('faturas')
@UseGuards(JwtAuthGuard) // Aplica autenticação em todo o controller
export class FaturaController {
  constructor(private readonly faturaService: FaturaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listarFaturas(
    @CurrentUser() user: AuthenticatedUser, // Decorator customizado, tipado
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<PaginatedResult<Fatura>> {
    // A filtragem por userId acontece no SQL (WHERE clause),
    // não mais em memória. O banco usa o índice em userId para
    // retornar apenas os registros do usuário autenticado.
    const [data, total] = await this.faturaService.listarPorUsuario(
      user.id,
      Number(page),
      Math.min(Number(limit), 100), // Limita máximo para evitar abuso
    );

    return { data, total, page: Number(page), limit: Number(limit) };
  }
}
```

### O que mudou e por quê:

1. **`@UseGuards(JwtAuthGuard)`**: Garante que toda requisição é autenticada antes de chegar ao handler. Requisições sem token válido recebem 401 automaticamente.

2. **`@CurrentUser()` ao invés de `@Req()`**: Decorator customizado que extrai o usuário do token JWT de forma tipada. Elimina o acesso direto ao Request (que é um detalhe de implementação do Express) e provê tipagem forte.

3. **Filtragem no banco**: `faturaService.listarPorUsuario(user.id, ...)` executa `WHERE userId = $1 LIMIT $2 OFFSET $3` no PostgreSQL. O banco usa o índice em `userId` e retorna apenas os registros necessários.

4. **Paginação**: `page` e `limit` como query params, com `Math.min(limit, 100)` para prevenir que um cliente solicite todas as faturas de uma vez.

5. **Tipagem completa**: Interface `AuthenticatedUser`, tipo de retorno explícito `Promise<PaginatedResult<Fatura>>`.

---

## 3. Como esse bug de isolamento poderia ter passado despercebido em testes?

Esse bug sobrevive a testes por três razões estruturais:

**Razão 1 — Testes unitários com mock não reproduzem o problema.** Quando mockamos o repositório, tipicamente configuramos o mock para retornar dados que já estão filtrados: `mockFaturaRepo.find.mockResolvedValue([faturaDoUsuarioA])`. O teste passa porque o mock já retorna o que esperamos. Nunca testamos o que `find()` sem filtro realmente retorna do banco.

**Razão 2 — Testes de integração com um único usuário.** A maioria dos setups de teste cria um usuário e as faturas dele. Se existe apenas um usuário no banco de testes, `find()` sem filtro retorna apenas suas faturas — o filtro em memória funciona "corretamente" por acidente. O bug só aparece quando existem dados de múltiplos usuários.

**Razão 3 — Ausência de testes negativos de isolamento.** Raramente escrevemos o teste: "dado que existem faturas do Usuário A e do Usuário B no banco, quando Usuário A lista suas faturas, então NENHUMA fatura do Usuário B deve estar presente". Este tipo de teste é essencial para sistemas multi-tenant, mas não é coberto por frameworks de teste padrão ou geradores de scaffold.

### Como prevenir isso no futuro:

- Incluir no setup de testes de integração sempre pelo menos dois usuários com dados distintos
- Ter um teste explícito de isolamento multi-tenant para todo endpoint que filtra por usuário
- Usar row-level security (RLS) no PostgreSQL como camada extra de proteção — mesmo que o código da aplicação erre, o banco impede acesso a linhas de outros tenants

---

## Pergunta de Follow-up: Estratégias para 500 requisições simultâneas

### Estratégia 1 — Connection pooling otimizado + índices + projeção de colunas

O primeiro gargalo sob carga é o pool de conexões com o banco. O padrão do TypeORM é geralmente 10 conexões, o que com 500 requisições simultâneas cria uma fila massiva.

Ações concretas:
- **Configurar o pool**: `max: 50` conexões no TypeORM (ajustar baseado na capacidade do RDS). Com 50 conexões, 500 requisições são atendidas em ~10 batches.
- **Índice composto**: `CREATE INDEX idx_faturas_user_created ON faturas (userId, createdAt DESC)` — o PostgreSQL resolve a query de listagem inteiramente pelo índice, sem tocar na tabela (index-only scan).
- **Projeção**: Selecionar apenas as colunas necessárias (`SELECT id, descricao, valor, dataVencimento, status`) ao invés de `SELECT *`. Reduz I/O de disco e transferência de rede.

Essa estratégia é a mais importante porque ataca a causa raiz — o banco é o recurso mais escasso.

### Estratégia 2 — Cache em camada de aplicação com Redis

Para endpoints de leitura como listagem de faturas, o cache é altamente efetivo porque os dados mudam com baixa frequência (uma fatura é criada ou atualizada esporadicamente, mas listada muitas vezes).

Implementação:
- **Cache key**: `faturas:${userId}:page:${page}:limit:${limit}`
- **TTL**: 30 segundos — suficiente para absorver picos de tráfego sem servir dados muito defasados
- **Invalidação**: Ao criar, atualizar ou cancelar uma fatura, deletar todas as chaves `faturas:${userId}:*` via pattern delete

Com 500 requisições simultâneas de 50 usuários distintos (10 req/user), o Redis absorve 450 das 500 requisições após o primeiro miss de cada usuário. O banco recebe apenas 50 queries ao invés de 500.

### Estratégia 3 (bônus) — Rate limiting com @nestjs/throttler

Como proteção adicional contra picos abusivos ou ataques DDoS:

```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 req/min por IP
```

Isso não melhora a performance em si, mas protege o sistema de degradar sob carga anormal. Sem rate limiting, um único cliente mal-comportado pode monopolizar conexões do pool e degradar a experiência de todos os outros.
