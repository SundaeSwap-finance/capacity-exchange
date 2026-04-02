import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { readFileSync } from 'fs';
import type { Logger } from 'pino';
import type { AppConfig } from './loadConfig.js';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export interface Telemetry {
  close(): Promise<void>;
}

/** Initialize OpenTelemetry. */
export function initTelemetry(config: AppConfig, logger: Logger): Telemetry | undefined {
  if (!config.otelEndpoint) {
    logger.info('OTEL_EXPORTER_OTLP_ENDPOINT not set, telemetry disabled');
    return undefined;
  }

  const otelServiceName = config.otelServiceName ?? packageJson.name;
  const exportIntervalMillis = config.otelMetricExportIntervalMs ?? 30_000;
  logger.info({ otelServiceName, endpoint: config.otelEndpoint, exportIntervalMillis }, 'Initializing OpenTelemetry');

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: otelServiceName,
      [ATTR_SERVICE_VERSION]: packageJson.version,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${config.otelEndpoint}/v1/metrics` }),
      exportIntervalMillis,
    }),
  });

  sdk.start();
  return { close: () => sdk.shutdown() };
}
