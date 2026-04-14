# Disclosure de Uso de IA

## Ferramenta

Assistente de IA (LLM comercial via CLI integrado ao editor) usado como
pair programmer durante o desenvolvimento.

## Como foi usado

- **Scaffolding e boilerplate**: estrutura de diretórios (domain / application /
  infrastructure / presentation), mappers ORM↔Domain, DTOs com decorators
  class-validator + Swagger, filtro problem+json, middleware de correlation-id,
  migrations TypeORM iniciais, Dockerfile multi-stage, workflow de CI.
- **Revisão e redação**: revisão de trechos dos `RESPOSTAS.md`, sugestões de
  diagramas ASCII e tabelas comparativas.

## Decisões que são minhas

Tudo que envolve tradeoff arquitetural e não é derivável do enunciado:

- Hexagonal strict (domínio puro, sem `@Entity`) em vez de service + repo.
- Outbox pattern em vez de publicar evento pós-commit.
- `pg_try_advisory_xact_lock` em vez de Redis Redlock (não adicionar infra
  só por 1 cron; libera automático no fim da transação).
- Money VO em centavos (bigint) — evita aritmética de float em contexto
  financeiro.
- Luxon com IANA TZ para D-3/D+1/D+7 (DST + devedores em múltiplos TZs).
- Exponential backoff + full jitter no retry (vs. linear sem delay).
- `@CurrentUser('id')` por contrato + `buscarPorIdDoUsuario` no port:
  impede estruturalmente o anti-pattern de `userId` vindo de query/body.
- RFC 7807 Problem+JSON, ETag/If-None-Match, PATCH com state machine,
  keyset pagination — aplicar RFCs em vez de API "invented here".
- ADR em formato MADR com matriz de tradeoffs quantificada (4 opções) e
  FMEA; decisão final com consequências e alternativas rejeitadas.
- Strategy + Adapter em Hexagonal para multi-gateway (rejeitando Unified
  por vendor lock-in e Middleware chain por stack depth).

## Revisão crítica do código gerado

- Ajustei o contrato do `FaturaRepository` para ter `buscarPorIdDoUsuario`
  explícito, fechando o anti-pattern auditado no Ex2.
- Removi `pg-mem` dos e2e: não implementa advisory locks nem
  `SELECT FOR UPDATE SKIP LOCKED`, mascararia bugs reais.
- Ajustei paths de migration, exclusões de coverage, e o schema Zod de env
  para fail-fast no boot.

## Política aplicada

1. Não incluí nada que não consiga explicar e defender tecnicamente.
2. Toda decisão tem "por quê" baseado em experiência com esses sistemas,
   não apenas "porque é o padrão".
3. Tradeoffs rejeitados estão documentados, não só a escolha vencedora.
4. Código gerado foi lido, ajustado onde divergia do desenho pretendido,
   e coberto por testes.
