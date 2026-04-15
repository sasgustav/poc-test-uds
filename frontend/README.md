# CobrançaPro — Frontend

Interface web do sistema **CobrançaPro**, construída com React, TypeScript e Vite. Permite o gerenciamento completo de faturas de cobrança com régua de lembretes automatizada.

## Stack Tecnológica

| Tecnologia | Finalidade |
|---|---|
| React 19 | Biblioteca de UI |
| TypeScript | Tipagem estática |
| Vite | Build tool e dev server |
| TailwindCSS v4 | Estilização utilitária |
| React Router DOM | Roteamento SPA |
| Axios | Cliente HTTP |
| Lucide React | Biblioteca de ícones |

## Como Executar

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento (porta 5173)
npm run dev
```

> O frontend depende do backend NestJS rodando na porta 3000. O Vite proxy redireciona `/v1` para `http://localhost:3000`.

---

## Telas da Aplicação

### 1. Painel de Faturas (Tela Inicial)

**Rota:** `/`  
**Arquivo:** `src/pages/FaturaListPage.tsx`

Tela principal do sistema que funciona como um **dashboard operacional** de cobranças. Exibe métricas consolidadas e a listagem paginada de todas as faturas emitidas.

#### Elementos da Tela

- **Header de navegação** — Logo "CobrançaPro", links para "Painel de Faturas" e "Nova Fatura", badge "Operação Ativa"
- **Título e descrição** — "Faturas emitidas" com subtítulo orientativo
- **Botão "+ Nova Fatura"** — Atalho rápido para emissão de nova cobrança
- **Cards de métricas (4 cards):**
  - **Faturas listadas** — Total de registros cadastrados
  - **Volume financeiro** — Soma dos valores visíveis na página (R$)
  - **Pendências ativas** — Quantidade de faturas pagas na página
  - **Ticket médio** — Média por cobrança (R$)
- **Tabela de registros recentes** — Colunas: Cliente/Detalhes, Valor, Vencimento, Status Operacional, Ações
- **Paginação** — Navegação entre páginas de resultados
- **Responsividade** — Em dispositivos móveis, a tabela se transforma em cards empilhados

#### Screenshot

![Painel de Faturas](docs/screenshots/01-painel-faturas.png)

---

### 2. Emitir Nova Cobrança (Formulário de Criação)

**Rota:** `/faturas/new`  
**Arquivo:** `src/pages/FaturaCreatePage.tsx`

Formulário para emissão de novas faturas. Layout em duas colunas: formulário à esquerda e painel de dicas à direita.

#### Elementos da Tela

- **Link "Voltar ao painel"** — Retorna para a tela inicial
- **Cabeçalho** — Badge "Onboarding financeiro", título "Emitir nova cobrança" e descrição orientativa
- **Seção "Dados do Sacado":**
  - **Nome do cliente** — Campo de texto (placeholder: "Ex: Marina Souza LTDA")
  - **E-mail de faturamento** — Campo de e-mail (placeholder: financeiro@empresa.com)
- **Seção "Detalhes Financeiros":**
  - **Descrição do fornecimento** — Campo de texto longo para referência do contrato/serviço
  - **Valor Total** — Campo numérico em reais (R$)
  - **Vencimento** — Seletor de data (date picker)
  - **Fuso Operacional** — Select com opções: America/Sao_Paulo, America/Fortaleza, America/Campo_Grande
- **Botões de ação** — "Emitir Fatura Oficial" (submit) e "Cancelar operação" (volta ao painel)
- **Painel lateral "Checkout Eficiente"** — Dicas para preenchimento correto:
  - Orientação sobre descrição clínica
  - Importância da validade do e-mail
  - Explicação da régua de lembretes (D-3, D+1, D+7)
- **Painel "Motor de Cobrança"** — Explica o agendamento automático de até 3 notificações via cron-jobs

#### Screenshot

![Nova Fatura](docs/screenshots/02-nova-fatura.png)

---

### 3. Detalhes da Fatura

**Rota:** `/faturas/:id`  
**Arquivo:** `src/pages/FaturaDetailPage.tsx`

Tela de visualização detalhada de uma fatura específica. Exibe todas as informações operacionais, financeiras e a timeline de lembretes.

#### Elementos da Tela

- **Link "Voltar ao painel"** — Retorna para a listagem
- **ID da fatura** — UUID exibido no canto superior direito
- **Card principal — Detalhes da Cobrança:**
  - **Descrição da fatura** — Título principal (ex: "Mensalidade Janeiro")
  - **Status badge** — Indicador visual do status (Pendente, Paga, Vencida, Cancelada)
  - **Devedor** — Nome do cliente responsável
  - **E-mail de Contato** — E-mail cadastrado do sacado
- **Botões de ação (condicionais)** — Visíveis apenas quando o status é "pendente" ou "vencida":
  - **Confirmar Pagamento** — Altera status para "paga"
  - **Cancelar Cobrança** — Altera status para "cancelada"
- **Régua de Lembretes** — Timeline visual em formato zig-zag com os lembretes programados:
  - **D-3** — Lembrete 3 dias antes do vencimento
  - **D+1** — Lembrete 1 dia após o vencimento
  - **D+7** — Lembrete 7 dias após o vencimento
  - Cada card mostra: tipo, status (Enviado/Pendente/Falhou/Descartado), data prevista e tentativas
- **Sidebar — Resumo Financeiro:**
  - **Valor** — Destaque visual com o valor total em R$
  - **Data de Vencimento** — Com indicador de urgência
  - **Timezone / Local** — Fuso horário da operação
  - **Ciclo de Vida** — Fluxo visual dos estados: Pendente → Vencida → Paga / Cancelada (com destaque no estado atual)
- **Metadados Internos** — Data de criação e última atualização do registro

#### Screenshot

![Detalhes da Fatura](docs/screenshots/03-detalhes-fatura.png)

---

## Layout Global

**Arquivo:** `src/components/Layout.tsx`

O layout envolve todas as telas e fornece:

- **Header fixo** — Logo, navegação principal, badge de status do sistema e avatar do usuário
- **Navegação mobile** — Barra inferior com ícones para "Faturas" e "Nova Fatura" (visível apenas em telas pequenas)
- **Footer** — Créditos do desenvolvedor com link para LinkedIn

---

## Estrutura de Pastas

```
src/
├── api.ts                      # Cliente HTTP (axios) com endpoints da API
├── App.tsx                     # Rotas da aplicação
├── index.css                   # Estilos globais (TailwindCSS)
├── main.tsx                    # Ponto de entrada
├── types.ts                    # Interfaces e tipos TypeScript
├── components/
│   ├── Layout.tsx              # Shell da aplicação (header, nav, footer)
│   └── StatusBadge.tsx         # Componente de badge de status
└── pages/
    ├── FaturaListPage.tsx      # Painel de faturas (dashboard)
    ├── FaturaCreatePage.tsx    # Formulário de nova fatura
    └── FaturaDetailPage.tsx    # Detalhes de uma fatura
```

---

## API Endpoints Consumidos

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/v1/faturas` | Lista faturas com paginação |
| `GET` | `/v1/faturas/:id` | Detalhes de uma fatura |
| `POST` | `/v1/faturas` | Cria nova fatura |
| `PATCH` | `/v1/faturas/:id/status` | Atualiza status (pagar/cancelar) |
| `GET` | `/v1/health/readiness` | Health check do backend |
