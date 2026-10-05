import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';

const AppEnvSchema = Type.Object({
  // Required only if `priceFormulas.DUST` is configured; see loadConfig.ts.
  MIDNIGHT_NETWORK: Type.Optional(Type.String()),
  MIDNIGHT_WALLET_SEED_FILE: Type.Optional(Type.String()),
  MIDNIGHT_WALLET_MNEMONIC_FILE: Type.Optional(Type.String()),
  MIDNIGHT_WALLET_MNEMONIC_ARN: Type.Optional(Type.String()),
  MIDNIGHT_WALLET_MNEMONIC_SECRET_NAME: Type.Optional(Type.String()),
  PRICE_CONFIG_FILE: Type.String(),
  PORT: Type.Number(),
  LOG_LEVEL: Type.String(),
  QUOTE_TTL_SECONDS: Type.Number(),
  QUOTE_SECRET_FILE: Type.String(),
  OFFER_TTL_SECONDS: Type.Number(),
  MIDNIGHT_PROOF_SERVER_URL: Type.Optional(Type.String()),
  // Required only if `priceFormulas.DUST` is configured; see loadConfig.ts.
  MIDNIGHT_WALLET_STATE_DIR: Type.Optional(Type.String()),
  OTEL_SERVICE_NAME: Type.Optional(Type.String()),
  OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String()),
  OTEL_METRIC_EXPORT_INTERVAL_MS: Type.Optional(Type.Number()),
  CAPACITY_EXCHANGE_PEER_URLS: Type.Optional(Type.String()),
  CARDANO_BLOCKFROST_API_KEY: Type.Optional(Type.String()),
  CARDANO_BLOCKFROST_BASE_URL: Type.Optional(Type.String()),
  CARDANO_SERVER_ADDRESS: Type.Optional(Type.String()),
  CARDANO_UTXORPC_URL: Type.Optional(Type.String()),
});

export type AppEnv = Static<typeof AppEnvSchema>;

/** Parse and validate app env vars from process.env. */
export function parseAppEnv(): AppEnv {
  const env = {
    MIDNIGHT_NETWORK: process.env.MIDNIGHT_NETWORK,
    MIDNIGHT_WALLET_SEED_FILE: process.env.MIDNIGHT_WALLET_SEED_FILE,
    MIDNIGHT_WALLET_MNEMONIC_FILE: process.env.MIDNIGHT_WALLET_MNEMONIC_FILE,
    MIDNIGHT_WALLET_MNEMONIC_ARN: process.env.MIDNIGHT_WALLET_MNEMONIC_ARN,
    MIDNIGHT_WALLET_MNEMONIC_SECRET_NAME: process.env.MIDNIGHT_WALLET_MNEMONIC_SECRET_NAME,
    PRICE_CONFIG_FILE: process.env.PRICE_CONFIG_FILE,
    PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
    LOG_LEVEL: process.env.LOG_LEVEL,
    QUOTE_TTL_SECONDS: process.env.QUOTE_TTL_SECONDS
      ? Number(process.env.QUOTE_TTL_SECONDS)
      : undefined,
    QUOTE_SECRET_FILE: process.env.QUOTE_SECRET_FILE,
    OFFER_TTL_SECONDS: process.env.OFFER_TTL_SECONDS
      ? Number(process.env.OFFER_TTL_SECONDS)
      : undefined,
    MIDNIGHT_PROOF_SERVER_URL: process.env.MIDNIGHT_PROOF_SERVER_URL,
    MIDNIGHT_WALLET_STATE_DIR: process.env.MIDNIGHT_WALLET_STATE_DIR,
    CAPACITY_EXCHANGE_PEER_URLS: process.env.CAPACITY_EXCHANGE_PEER_URLS,
    CARDANO_BLOCKFROST_API_KEY: process.env.CARDANO_BLOCKFROST_API_KEY,
    CARDANO_BLOCKFROST_BASE_URL: process.env.CARDANO_BLOCKFROST_BASE_URL,
    CARDANO_SERVER_ADDRESS: process.env.CARDANO_SERVER_ADDRESS,
    CARDANO_UTXORPC_URL: process.env.CARDANO_UTXORPC_URL,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_METRIC_EXPORT_INTERVAL_MS: process.env.OTEL_METRIC_EXPORT_INTERVAL_MS
      ? Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS)
      : undefined,
  };

  if (!Value.Check(AppEnvSchema, env)) {
    const errors = [...Value.Errors(AppEnvSchema, env)];
    throw new Error(
      `Invalid app env:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`,
    );
  }

  return env as AppEnv;
}
