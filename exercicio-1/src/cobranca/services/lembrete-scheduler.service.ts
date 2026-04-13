import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LembreteAgendado } from '../entities/lembrete-agendado.entity';
import { LembreteStatus } from '../enums/lembrete-status.enum';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

@Injectable()
export class LembreteSchedulerService {
  private readonly logger = new Logger(LembreteSchedulerService.name);
  private processando = false;

  constructor(
    @InjectRepository(LembreteAgendado)
    private readonly lembreteRepository: Repository<LembreteAgendado>,
  ) {}

  /**
   * Job executado a cada minuto para processar lembretes pendentes.
   *
   * Utiliza SELECT FOR UPDATE SKIP LOCKED para garantir que múltiplas
   * instâncias da aplicação não processem o mesmo lembrete simultaneamente.
   * Isso é fundamental para evitar duplicidade de envios em ambientes
   * com múltiplas réplicas ou em caso de restart do job.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processarLembretesPendentes(): Promise<void> {
    if (this.processando) {
      this.logger.debug('Job anterior ainda em execução, pulando ciclo');
      return;
    }

    this.processando = true;

    try {
      const lembretes = await this.buscarLembretesPendentes();

      if (lembretes.length === 0) {
        return;
      }

      this.logger.log(`Processando ${lembretes.length} lembrete(s) pendente(s)`);

      for (const lembrete of lembretes) {
        await this.processarLembrete(lembrete);
      }
    } catch (error) {
      this.logger.error(
        `Erro no job de processamento: ${error.message}`,
        error.stack,
      );
    } finally {
      this.processando = false;
    }
  }

  /**
   * Busca lembretes pendentes cuja data de envio já passou.
   *
   * O uso de FOR UPDATE SKIP LOCKED é a peça-chave para concorrência:
   * - FOR UPDATE: trava as linhas selecionadas, impedindo outro worker de selecioná-las
   * - SKIP LOCKED: ao invés de bloquear, pula linhas já travadas por outro worker
   *
   * Isso permite escalabilidade horizontal sem filas externas.
   */
  private async buscarLembretesPendentes(): Promise<LembreteAgendado[]> {
    return this.lembreteRepository
      .createQueryBuilder('lembrete')
      .leftJoinAndSelect('lembrete.fatura', 'fatura')
      .setLock('pessimistic_write', undefined, ['lembrete'])
      .where('lembrete.status = :status', { status: LembreteStatus.PENDENTE })
      .andWhere('lembrete.dataEnvio <= NOW()')
      .orderBy('lembrete.dataEnvio', 'ASC')
      .limit(BATCH_SIZE)
      .getMany();
  }

  /**
   * Processa um lembrete individual: tenta enviar o e-mail e atualiza o status.
   *
   * Em caso de falha, incrementa o contador de tentativas.
   * Após MAX_RETRIES tentativas sem sucesso, marca definitivamente como 'falhou'.
   */
  private async processarLembrete(lembrete: LembreteAgendado): Promise<void> {
    try {
      await this.enviarEmail(lembrete);

      await this.lembreteRepository.update(lembrete.id, {
        status: LembreteStatus.ENVIADO,
        processadoEm: new Date(),
        tentativas: lembrete.tentativas + 1,
      });

      this.logger.log(
        `Lembrete ${lembrete.id} (${lembrete.tipo}) enviado com sucesso para fatura ${lembrete.faturaId}`,
      );
    } catch (error) {
      const tentativas = lembrete.tentativas + 1;
      const novoStatus =
        tentativas >= MAX_RETRIES
          ? LembreteStatus.FALHOU
          : LembreteStatus.PENDENTE;

      await this.lembreteRepository.update(lembrete.id, {
        status: novoStatus,
        tentativas,
        erroMsg: error.message,
      });

      if (novoStatus === LembreteStatus.FALHOU) {
        this.logger.error(
          `Lembrete ${lembrete.id} falhou definitivamente após ${MAX_RETRIES} tentativas: ${error.message}`,
        );
      } else {
        this.logger.warn(
          `Lembrete ${lembrete.id} falhou (tentativa ${tentativas}/${MAX_RETRIES}): ${error.message}`,
        );
      }
    }
  }

  /**
   * Simula o envio de e-mail.
   *
   * Em produção, aqui seria injetado um serviço de e-mail (SendGrid, SES, etc.)
   * com chave de idempotência (lembrete.id) para evitar envios duplicados
   * mesmo em caso de retry.
   */
  private async enviarEmail(lembrete: LembreteAgendado): Promise<void> {
    const fatura = lembrete.fatura;
    this.logger.debug(
      `Simulando envio de e-mail para ${fatura?.emailDevedor} ` +
      `(devedor: ${fatura?.nomeDevedor}, tipo: ${lembrete.tipo}, fatura: ${lembrete.faturaId})`,
    );
    // Em produção:
    // await this.emailService.send({
    //   to: fatura.emailDevedor,
    //   subject: `Lembrete de cobrança - ${fatura.descricao}`,
    //   template: 'cobranca-lembrete',
    //   context: { nomeDevedor: fatura.nomeDevedor, valor: fatura.valor, tipo: lembrete.tipo },
    //   idempotencyKey: lembrete.id,
    // });
  }
}
