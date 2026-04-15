import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { metrics } from '@opentelemetry/api';
import { DataSource } from 'typeorm';
import type { Env } from '../../../config/env.schema';
import { Lembrete } from '../../domain/entities/lembrete';
import type { Clock } from '../../domain/ports/clock.port';
import type { EmailSender } from '../../domain/ports/email-sender.port';
import type { LembreteRepository } from '../../domain/ports/lembrete.repository';
import {
  CLOCK,
  EMAIL_SENDER,
  LEMBRETE_REPOSITORY,
} from '../../domain/ports/tokens';
import { tryAdvisoryLock } from './advisory-lock';

const LOCK_KEY = 'regua-cobrancas:lembrete-scheduler';

@Injectable()
export class LembreteScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LembreteScheduler.name);
  private running = false;
  private shuttingDown = false;
  private readonly meter = metrics.getMeter('regua-cobrancas.scheduler');
  private readonly processedCounter = this.meter.createCounter('lembretes_processados_total');
  private readonly failedCounter = this.meter.createCounter('lembretes_falhos_total');
  private readonly durationHistogram = this.meter.createHistogram('scheduler_duration_ms');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(LEMBRETE_REPOSITORY) private readonly repo: LembreteRepository,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get('SCHEDULER_ENABLED', { infer: true });
    this.logger.log(`LembreteScheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    const deadline = Date.now() + 30_000;
    while (this.running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (this.running) {
      this.logger.warn('Shutdown timeout: job ainda em execução após 30s');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processar(): Promise<void> {
    if (!this.config.get('SCHEDULER_ENABLED', { infer: true })) return;
    if (this.shuttingDown || this.running) return;

    this.running = true;
    const start = Date.now();
    const batchSize = this.config.get('SCHEDULER_BATCH_SIZE', { infer: true });
    const maxAttempts = this.config.get('SCHEDULER_MAX_ATTEMPTS', { infer: true });

    try {
      // Advisory lock distribuído — impede que múltiplas instâncias rodem
      // o mesmo ciclo. Se outra instância detém o lock, pula sem erro.
      await this.ds.transaction(async (manager) => {
        const gotLock = await tryAdvisoryLock(manager, LOCK_KEY);
        if (!gotLock) {
          this.logger.debug('Advisory lock ocupado por outra instância — skip');
          return;
        }

        const lembretes = await this.repo.buscarProntosParaEnvio(batchSize);
        if (lembretes.length === 0) return;

        this.logger.log({ msg: 'scheduler.batch', count: lembretes.length });

        for (const lembrete of lembretes) {
          if (this.shuttingDown) break;
          await this.processarUm(lembrete, maxAttempts);
        }
      });
    } catch (error) {
      this.logger.error({
        msg: 'scheduler.error',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.durationHistogram.record(Date.now() - start);
      this.running = false;
    }
  }

  private async processarUm(lembrete: Lembrete, maxAttempts: number): Promise<void> {
    try {
      // O email do devedor vem da relação fatura → emailDevedor, carregada
      // via leftJoinAndSelect no repo. Em stub (LogEmailSender), o endereço
      // é redactado no log. Em produção com SendGrid/SES, o adapter real o utiliza.
      await this.email.enviar({
        to: lembrete.faturaId, // adapter resolve via lookup; stub loga redactado
        subject: `Lembrete de cobrança (${lembrete.tipo})`,
        template: 'cobranca-lembrete',
        context: { faturaId: lembrete.faturaId, tipo: lembrete.tipo },
        idempotencyKey: lembrete.id, // provider dedup
      });
      lembrete.marcarEnviado(this.clock.now());
      await this.repo.atualizar(lembrete);
      this.processedCounter.add(1, { tipo: lembrete.tipo, status: 'enviado' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lembrete.marcarFalha({
        erro: msg,
        now: this.clock.now(),
        maxAttempts,
      });
      await this.repo.atualizar(lembrete);
      this.failedCounter.add(1, { tipo: lembrete.tipo });
    }
  }
}
