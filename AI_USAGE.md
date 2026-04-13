# Disclosure de Uso de IA

## Ferramenta Utilizada

- **Claude Code** (Anthropic) — assistente de IA via CLI integrado ao VS Code

## Como a IA foi utilizada em cada exercicio

### Exercicio 1 — Desenvolvimento Backend

A IA auxiliou na **geracao do scaffold inicial** do projeto NestJS (package.json, tsconfig, estrutura de pastas) e na **escrita do codigo das entidades, DTOs, services e controller**.

**O que eu defini e a IA implementou seguindo minhas decisoes:**
- A modelagem das entidades (`Fatura` e `LembreteAgendado`) foi decisao minha — escolhi UUIDs, decimal para valores monetarios, tabela separada para lembretes, e os campos de retry. A IA gerou o codigo TypeORM a partir dessas especificacoes.
- A logica de `SELECT FOR UPDATE SKIP LOCKED` no scheduler foi uma decisao arquitetural minha baseada em experiencia com processamento concorrente em PostgreSQL. Pedi para a IA implementar esse pattern no TypeORM.
- Os offsets da regua de cobranca (D-3, D+1, D+7) e o horario fixo de 09:00 UTC para envio foram decisoes de produto que eu defini.

**O que eu ajustei do output da IA:**
- Corrigi tipagem de retorno de metodos (`Fatura | null` onde a IA havia colocado `Fatura`)
- Revisei e validei cada decorator de class-validator para garantir mensagens de erro claras em portugues

**Respostas discursivas (RESPOSTAS.md):** Escritas com auxilio da IA a partir do meu raciocinio tecnico. Eu defini os pontos que queria abordar, a IA ajudou a estruturar o texto. Revisei para garantir que reflete minha experiencia real e nao contem afirmacoes que eu nao conseguiria defender tecnicamente.

### Exercicio 2 — Code Review e Debugging

A analise dos problemas no codigo foi feita por mim, com a IA ajudando a **estruturar e detalhar** a explicacao de cada problema. Os 6 problemas identificados sao problemas que eu reconheco da experiencia pratica com NestJS e TypeORM.

O codigo corrigido foi gerado pela IA seguindo minhas instrucoes de quais patterns aplicar (UseGuards, CurrentUser decorator, paginacao, filtragem no banco).

A analise de por que o bug passa despercebido em testes reflete experiencia real minha com falhas de isolamento multi-tenant — especificamente o problema de testes com usuario unico.

### Exercicio 3 — Decisao de Arquitetura

O documento de arquitetura foi escrito com auxilio significativo da IA, mas **todas as decisoes tecnicas sao minhas:**

- A escolha de Strategy + Adapter (nao Template Method) e uma preferencia que tenho por composicao sobre heranca
- O Saga Pattern para falhas parciais com reconciliacao assincrona e uma abordagem que considero correta para integracoes de pagamento — timeout nao significa falha
- A estrategia de credenciais com AWS Secrets Manager segue o que considero best practice para o stack AWS que o produto ja usa

**O que a IA adicionou que eu validei:** exemplos de codigo concretos para ilustrar os patterns, a estrutura de diretorios da arquitetura hexagonal, e detalhes sobre IAM policies e rotacao de chaves.

## Resumo

A IA foi utilizada como ferramenta de produtividade para acelerar a escrita de codigo e texto, mas as decisoes de design, arquitetura e modelagem foram minhas. Todo o codigo e texto gerado foi revisado por mim e reflete conhecimento que eu consigo explicar e defender tecnicamente.
