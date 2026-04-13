import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fatura } from './entities/fatura.entity';
import { LembreteAgendado } from './entities/lembrete-agendado.entity';
import { FaturaController } from './controllers/fatura.controller';
import { FaturaService } from './services/fatura.service';
import { LembreteSchedulerService } from './services/lembrete-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Fatura, LembreteAgendado])],
  controllers: [FaturaController],
  providers: [FaturaService, LembreteSchedulerService],
  exports: [FaturaService],
})
export class CobrancaModule {}
