import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

/**
 * Exporta /metrics em formato Prometheus.
 * Métricas customizadas (scheduler, outbox, idempotency) são registradas
 * diretamente via OpenTelemetry meter (compatível).
 */
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
})
export class AppMetricsModule {}
