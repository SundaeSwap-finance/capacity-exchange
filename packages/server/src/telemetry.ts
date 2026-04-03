import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { diag, DiagLogLevel } from '@opentelemetry/api';
import type { Logger } from 'pino';
import type { AppConfig } from './loadConfig.js';
import { packageName, packageVersion } from './packageInfo.js';

export interface Telemetry {
  close(): Promise<void>;
}

/** Bridges OTel's DiagLogger to pino. */
function pinoToDiagLogger(log: Logger) {
  function format(msg: string, args: unknown[]): string {
    let i = 0;
    return String(msg).replace(/%s/g, () => String(args[i++] ?? ''));
  }

  return {
    error: (msg: string, ...args: unknown[]) => log.error(format(msg, args)),
    warn: (msg: string, ...args: unknown[]) => log.warn(format(msg, args)),
    info: (msg: string, ...args: unknown[]) => log.info(format(msg, args)),
    debug: (msg: string, ...args: unknown[]) => log.debug(format(msg, args)),
    verbose: (msg: string, ...args: unknown[]) => log.trace(format(msg, args)),
  };
}

/** Initialize OpenTelemetry. */
export function initTelemetry(config: AppConfig, logger: Logger): Telemetry | undefined {
  if (!config.otelEndpoint) {
    logger.info('OTEL_EXPORTER_OTLP_ENDPOINT not set, telemetry disabled');
    return undefined;
  }

  const otelServiceName = config.otelServiceName ?? packageName;
  const exportIntervalMillis = config.otelMetricExportIntervalMs ?? 30_000;
  logger.info({ otelServiceName, endpoint: config.otelEndpoint, exportIntervalMillis }, 'Initializing OpenTelemetry');

  diag.setLogger(pinoToDiagLogger(logger.child({ component: 'otel' })), DiagLogLevel.WARN);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: otelServiceName,
      [ATTR_SERVICE_VERSION]: packageVersion,
    }),
    // metricReaders (plural) silently drops counters/histograms in sdk-node 0.214.0
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${config.otelEndpoint}/v1/metrics` }),
      exportIntervalMillis,
    }),
  });

  sdk.start();
  return { close: () => sdk.shutdown() };
}
