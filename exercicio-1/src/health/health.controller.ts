import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { OutboxRepository } from '../cobranca/domain/ports/outbox.repository';
import { OUTBOX_REPOSITORY } from '../cobranca/domain/ports/tokens';
import { Public } from '../common/guards/api-key.guard';

const OUTBOX_DEPTH_THRESHOLD = 1000;

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
  ) {}

  @Public()
  @Get('health/liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([() => Promise.resolve({ app: { status: 'up' } } as HealthIndicatorResult)]);
  }

  @Public()
  @Get('health/readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      async () => this.db.pingCheck('database', { timeout: 1500 }),
      async (): Promise<HealthIndicatorResult> => {
        const depth = await this.outbox.contarPendentes();
        const healthy = depth < OUTBOX_DEPTH_THRESHOLD;
        return {
          outbox: {
            status: healthy ? 'up' : 'down',
            pending: depth,
            threshold: OUTBOX_DEPTH_THRESHOLD,
          },
        };
      },
    ]);
  }
}
