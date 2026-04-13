# Avaliacao Tecnica — Desenvolvedor Fullstack

Repositorio com a solucao da avaliacao tecnica para a posicao de Desenvolvedor Fullstack na Talent Studio by UDS Tecnologia.

## Estrutura do Repositorio

```
├── exercicio-1/    Backend NestJS — Regua de Cobrancas
├── exercicio-2/    Code Review e Debugging
├── exercicio-3/    Decisao de Arquitetura
├── AI_USAGE.md     Disclosure de uso de IA
└── docker-compose.yml  PostgreSQL para desenvolvimento
```

## Pre-requisitos

- Node.js 20+
- Docker e Docker Compose (para o PostgreSQL)
- npm

## Como rodar

### 1. Subir o PostgreSQL

```bash
docker-compose up -d
```

Isso inicia um container PostgreSQL 16 na porta 5432 com as credenciais:
- Database: `cobranca_db`
- User: `cobranca_user`
- Password: `cobranca_pass`

### 2. Exercicio 1 — Backend NestJS

```bash
cd exercicio-1
cp .env.example .env
npm install
npm run start:dev
```

A aplicacao inicia na porta 3000. Endpoints disponiveis:

- `POST /faturas` — Cria uma fatura e agenda lembretes automaticamente
- `GET /faturas?userId=<uuid>&page=1&limit=20` — Lista faturas de um usuario
- `GET /faturas/:id` — Busca uma fatura por ID com seus lembretes

#### Exemplo de uso:

```bash
# Criar uma fatura
curl -X POST http://localhost:3000/faturas \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "nomeDevedor": "João Silva",
    "emailDevedor": "joao@empresa.com",
    "descricao": "Consultoria mensal - Janeiro/2025",
    "valor": 3500.00,
    "dataVencimento": "2025-02-15"
  }'
```

A resposta incluira a fatura criada com 3 lembretes agendados (D-3, D+1, D+7).

#### Rodar os testes:

```bash
cd exercicio-1
npm test
```

### 3. Exercicio 2 — Code Review

As respostas estao em `exercicio-2/RESPOSTAS.md` com:
- Identificacao de todos os problemas do codigo original
- Codigo corrigido em `exercicio-2/codigo-corrigido/fatura.controller.ts`
- Analise de por que o bug passou despercebido em testes
- Estrategias para alta concorrencia

### 4. Exercicio 3 — Decisao de Arquitetura

O documento de arquitetura esta em `exercicio-3/RESPOSTAS.md` cobrindo:
- Padroes de design (Strategy + Adapter + Factory)
- Isolamento via Arquitetura Hexagonal
- Tratamento de falhas parciais com Saga Pattern
- Gestao de credenciais com AWS Secrets Manager

## Variaveis de Ambiente

| Variavel | Descricao | Default |
|---|---|---|
| `DB_HOST` | Host do PostgreSQL | `localhost` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_USERNAME` | Usuario do banco | `cobranca_user` |
| `DB_PASSWORD` | Senha do banco | `cobranca_pass` |
| `DB_DATABASE` | Nome do banco | `cobranca_db` |
| `PORT` | Porta da aplicacao | `3000` |
| `NODE_ENV` | Ambiente | `development` |
