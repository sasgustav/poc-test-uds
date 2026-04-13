# Exercício 1 — Respostas de Follow-up

## Justificativa da Modelagem

### Entidade Fatura

- **id (UUID)**: Optei por UUIDs ao invés de IDs sequenciais por três razões práticas: (1) evita enumeração — um atacante não consegue adivinhar IDs de faturas de outros clientes simplesmente incrementando um número; (2) permite geração distribuída sem coordenação central, o que importa se escalarmos para múltiplas instâncias; (3) é o padrão que a maioria dos gateways de pagamento usa como referência externa.

- **valor (decimal 12,2)**: Essa é uma decisão inegociável em software financeiro. Floating point (float/double) introduz erros de arredondamento que, acumulados ao longo de milhares de transações, geram divergências contábeis reais. O tipo `decimal` armazena o valor exato. Escolhi precisão 12 (até R$ 9.999.999.999,99) que cobre amplamente o cenário de PMEs do produto.

- **dataVencimento (date, não timestamp)**: Vencimento é um conceito de "dia", não de momento exato. Usar `date` evita confusão com timezone — a fatura vence no dia 15, independente do fuso horário do servidor.

- **nomeDevedor / emailDevedor**: A fatura precisa saber para quem enviar os lembretes. O e-mail do devedor é o destinatário direto da régua de cobranças. Optei por armazenar na fatura e não em uma tabela separada de "devedores" porque, neste estágio do produto, a relação é simples (1 fatura = 1 devedor). Se no futuro precisarmos de um cadastro de devedores com histórico, migraremos para uma entidade `Devedor` com FK na fatura.

- **status (enum)**: Modelei como enum PostgreSQL (`pendente`, `paga`, `vencida`, `cancelada`) porque os estados são finitos e bem definidos. Isso garante integridade no banco — é impossível gravar um status inválido — e serve como documentação viva da máquina de estados.

### Entidade LembreteAgendado

- **Tabela separada (não JSON dentro da fatura)**: Cada lembrete tem seu próprio ciclo de vida (pendente → enviado/falhou), contador de retentativas e timestamp de processamento. Embutir isso em um campo JSON na fatura impossibilitaria queries eficientes como "todos os lembretes pendentes com dataEnvio <= agora" e forçaria leitura/escrita da fatura inteira para atualizar um único lembrete.

- **Índice composto (status, dataEnvio)**: O job de agendamento executa a cada minuto a query `WHERE status = 'pendente' AND dataEnvio <= NOW()`. Sem este índice, a query faria full table scan conforme a tabela cresce. Com o índice, o PostgreSQL resolve a busca de forma eficiente mesmo com milhões de registros.

- **tentativas + erroMsg**: Permitem retry automático com visibilidade do motivo de falha. Sem isso, um lembrete que falha ficaria em um limbo sem diagnóstico, e a equipe não teria informação para debugar problemas com o serviço de e-mail.

---

## Pergunta 1: O que acontece se o job de agendamento cair exatamente no momento do envio de um lembrete? Como evitar duplicidade ou perda?

Esse é um cenário real e não hipotético — em produção, processos morrem por OOM, deploys, ou falha de infraestrutura. O problema se divide em dois sub-cenários:

**Cenário A — O job cai ANTES de enviar o e-mail**: Neste caso, o lembrete permanece com status `pendente` no banco. No próximo ciclo do cron (1 minuto depois), ele será selecionado novamente e processado. Não há perda nem duplicidade.

**Cenário B — O job cai DEPOIS de enviar o e-mail, mas ANTES de atualizar o status para `enviado`**: Este é o caso perigoso. O e-mail foi enviado, mas o banco ainda mostra `pendente`. No próximo ciclo, o lembrete será processado novamente, causando duplicidade.

### Como evito isso na minha implementação:

1. **`SELECT FOR UPDATE SKIP LOCKED`**: Garante que dois workers (ou dois ciclos sobrepostos) nunca processem o mesmo lembrete simultaneamente. Se uma instância trava com o lock, quando a conexão é liberada (timeout do PostgreSQL), o lock também é liberado e outro worker pode assumir.

2. **Flag `processando`**: No nível de aplicação, impede que um novo ciclo do cron se sobreponha a um ciclo em execução na mesma instância.

3. **Chave de idempotência no envio de e-mail**: Em produção, o serviço de e-mail (SendGrid, SES) receberia o `lembrete.id` como idempotency key. Mesmo que o mesmo lembrete seja processado duas vezes, o provider garante que o e-mail é enviado apenas uma vez.

A combinação dessas três camadas (lock no banco, proteção na aplicação, idempotência no provider) forma uma defesa em profundidade contra duplicidade. A perda é evitada pelo fato de que o status só muda para `enviado` após confirmação do envio — se o processo morre antes disso, o lembrete volta a ser elegível.

---

## Pergunta 2: Por que escolhi a abordagem de agendamento via @nestjs/schedule? Quais os trade-offs em relação a AWS SQS + Lambda?

### Por que @nestjs/schedule + polling no banco:

Escolhi essa abordagem por ser a mais pragmática para o estágio atual do produto. A startup tem um time de 2 devs e infraestrutura básica (EC2 + RDS). Adicionar SQS + Lambda introduz complexidade operacional que não se justifica no volume atual.

A solução de polling funciona assim: um cron roda a cada minuto, consulta a tabela `lembretes_agendados` buscando registros pendentes cuja data de envio já passou, e processa em batch. A granularidade de 1 minuto é mais que suficiente para lembretes de cobrança — ninguém nota a diferença entre receber o e-mail às 09:00:00 e 09:00:45.

### Trade-offs concretos:

| Aspecto | @nestjs/schedule + DB polling | AWS SQS + Lambda |
|---|---|---|
| **Complexidade operacional** | Baixa — tudo roda no mesmo processo NestJS, zero infraestrutura adicional | Alta — precisa configurar filas, DLQ, permissions IAM, monitoramento CloudWatch |
| **Latência** | Até 1 minuto (intervalo do cron) | Milissegundos (event-driven) |
| **Escalabilidade horizontal** | Funciona com `SKIP LOCKED`, mas tem limite prático (~10k lembretes/min por instância) | Escala automaticamente com o volume de mensagens |
| **Custo de desenvolvimento** | Horas | Dias (incluindo testes locais com localstack, IAM policies, etc.) |
| **Desenvolvimento local** | `npm run start:dev` e funciona | Precisa de LocalStack ou SAM local, aumenta atrito no onboarding |
| **Vendor lock-in** | Zero | AWS-specific |
| **Observabilidade** | Logs do NestJS + query no banco | CloudWatch Metrics + DLQ monitoring |

### Quando eu migraria para SQS + Lambda:

Se o produto crescer a ponto de ter milhares de faturas criadas por dia, o polling se tornaria ineficiente. Nesse ponto, a migração natural seria: ao criar a fatura, publicar uma mensagem no SQS com delay programado (SQS suporta até 15 minutos de delay, para delays maiores usaria Step Functions ou EventBridge Scheduler). Cada mensagem acionaria uma Lambda que processa o lembrete individual.

Mas otimizar prematuramente para esse cenário agora seria over-engineering. O time é pequeno, o volume é baixo, e cada hora gasta em infraestrutura é uma hora a menos no produto. A solução atual é simples, testável, e tem caminho claro de evolução quando necessário.
