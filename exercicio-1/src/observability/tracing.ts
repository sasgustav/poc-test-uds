import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * Bootstrap do OpenTelemetry.
 *
 * IMPORTANTE: deve ser chamado ANTES de qualquer import de NestJS para que
 * a auto-instrumentação patch-e HTTP/PG corretamente. Chamar em main.ts
 * na primeira linha.
 */
export function startTracing(): NodeSDK | null {
  if (process.env['OTEL_ENABLED'] !== 'true') return null;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? 'regua-cobrancas',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  return sdk;
}
