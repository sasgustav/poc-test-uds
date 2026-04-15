import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, CobrancaModule],
  controllers: [HealthController],
})
export class HealthModule {}
