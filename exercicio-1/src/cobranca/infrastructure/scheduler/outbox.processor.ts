import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { metrics } from '@opentelemetry/api';
import { DataSource } from 'typeorm';
import type { OutboxRepository } from '../../domain/ports/outbox.repository';
import { OUTBOX_REPOSITORY } from '../../domain/ports/tokens';
import { tryAdvisoryLock } from './advisory-lock';

const OUTBOX_LOCK = 'regua-cobrancas:outbox-processor';

/**
 * Outbox processor. Lê eventos não processados e os "publica".
 *
 * Em produção, a publicação seria em Kafka/SNS/RabbitMQ. Aqui, loggar
 * demonstra o padrão. Garantia: at-least-once. Consumidor precisa ser
 * idempotente usando `event.id`.
 */
@Injectable()
export class OutboxProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private running = false;
  private shuttingDown = false;
  private readonly meter = metrics.getMeter('regua-cobrancas.outbox');
  private readonly published = this.meter.createCounter('outbox_eventos_publicados_total');
  private readonly failures = this.meter.createCounter('outbox_eventos_falhas_total');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    const deadline = Date.now() + 15_000;
    while (this.running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  @Cron('*/10 * * * * *')
  async processar(): Promise<void> {
    if (this.shuttingDown || this.running) return;
    this.running = true;
    try {
      await this.ds.transaction(async (manager) => {
        if (!(await tryAdvisoryLock(manager, OUTBOX_LOCK))) return;
        const batch = await this.outbox.buscarNaoProcessados(50);
        for (const event of batch) {
          try {
            // Em produção: publicar no broker
            this.logger.log({ msg: 'outbox.publish', event });
            await this.outbox.marcarProcessado(event.id);
            this.published.add(1, { eventType: event.eventType });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            try {
              await this.outbox.marcarFalha(event.id, msg);
            } catch (markError) {
              this.logger.error({
                msg: 'outbox.marcarFalha.error',
                eventId: event.id,
                err: markError instanceof Error ? markError.message : String(markError),
              });
            }
            this.failures.add(1, { eventType: event.eventType });
          }
        }
      });
    } finally {
      this.running = false;
    }
  }
}
