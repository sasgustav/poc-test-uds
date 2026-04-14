import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReguaCalculator } from './application/services/regua-calculator';
import { AtualizarStatusFaturaUseCase } from './application/use-cases/atualizar-status.use-case';
import { BuscarFaturaUseCase } from './application/use-cases/buscar-fatura.use-case';
import { CriarFaturaUseCase } from './application/use-cases/criar-fatura.use-case';
import { ListarFaturasUseCase } from './application/use-cases/listar-faturas.use-case';
import {
  CLOCK,
  EMAIL_SENDER,
  FATURA_REPOSITORY,
  IDEMPOTENCY_REPOSITORY,
  LEMBRETE_REPOSITORY,
  OUTBOX_REPOSITORY,
  UNIT_OF_WORK,
} from './domain/ports/tokens';
import { SystemClock } from './infrastructure/clock/system-clock';
import { LogEmailSender } from './infrastructure/email/log-email-sender';
import { FaturaOrmEntity } from './infrastructure/persistence/typeorm/entities/fatura.orm-entity';
import { IdempotencyKeyOrmEntity } from './infrastructure/persistence/typeorm/entities/idempotency-key.orm-entity';
import { LembreteOrmEntity } from './infrastructure/persistence/typeorm/entities/lembrete.orm-entity';
import { OutboxOrmEntity } from './infrastructure/persistence/typeorm/entities/outbox.orm-entity';
import { FaturaTypeOrmRepository } from './infrastructure/persistence/typeorm/repositories/fatura.repository.impl';
import { IdempotencyTypeOrmRepository } from './infrastructure/persistence/typeorm/repositories/idempotency.repository.impl';
import { LembreteTypeOrmRepository } from './infrastructure/persistence/typeorm/repositories/lembrete.repository.impl';
import { OutboxTypeOrmRepository } from './infrastructure/persistence/typeorm/repositories/outbox.repository.impl';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm/unit-of-work';
import { LembreteScheduler } from './infrastructure/scheduler/lembrete.scheduler';
import { OutboxProcessor } from './infrastructure/scheduler/outbox.processor';
import { FaturaController } from './presentation/http/fatura.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FaturaOrmEntity,
      LembreteOrmEntity,
      OutboxOrmEntity,
      IdempotencyKeyOrmEntity,
    ]),
  ],
  controllers: [FaturaController],
  providers: [
    ReguaCalculator,
    CriarFaturaUseCase,
    BuscarFaturaUseCase,
    ListarFaturasUseCase,
    AtualizarStatusFaturaUseCase,
    LembreteScheduler,
    OutboxProcessor,
    { provide: CLOCK, useClass: SystemClock },
    { provide: EMAIL_SENDER, useClass: LogEmailSender },
    { provide: FATURA_REPOSITORY, useClass: FaturaTypeOrmRepository },
    { provide: LEMBRETE_REPOSITORY, useClass: LembreteTypeOrmRepository },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxTypeOrmRepository },
    { provide: IDEMPOTENCY_REPOSITORY, useClass: IdempotencyTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
  exports: [OUTBOX_REPOSITORY, IDEMPOTENCY_REPOSITORY],
})
export class CobrancaModule {}
