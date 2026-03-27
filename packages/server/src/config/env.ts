import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';

const AppEnvSchema = Type.Object({
  MIDNIGHT_NETWORK: Type.String(),
  WALLET_SEED_FILE: Type.Optional(Type.String()),
  WALLET_MNEMONIC_FILE: Type.Optional(Type.String()),
  WALLET_MNEMONIC_ARN: Type.Optional(Type.String()),
  PRICE_CONFIG_FILE: Type.String(),
  PORT: Type.Number(),
  LOG_LEVEL: Type.String(),
  OFFER_TTL_SECONDS: Type.Number(),
  PROOF_SERVER_URL: Type.Optional(Type.String()),
  WALLET_STATE_DIR: Type.String(),
});

export type AppEnv = Static<typeof AppEnvSchema>;

/** Parse and validate app env vars from process.env. */
export function parseAppEnv(): AppEnv {
  const env = {
    MIDNIGHT_NETWORK: process.env.MIDNIGHT_NETWORK,
    WALLET_SEED_FILE: process.env.WALLET_SEED_FILE,
    WALLET_MNEMONIC_FILE: process.env.WALLET_MNEMONIC_FILE,
    WALLET_MNEMONIC_ARN: process.env.WALLET_MNEMONIC_ARN,
    PRICE_CONFIG_FILE: process.env.PRICE_CONFIG_FILE,
    PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
    LOG_LEVEL: process.env.LOG_LEVEL,
    OFFER_TTL_SECONDS: process.env.OFFER_TTL_SECONDS ? Number(process.env.OFFER_TTL_SECONDS) : undefined,
    PROOF_SERVER_URL: process.env.PROOF_SERVER_URL,
    WALLET_STATE_DIR: process.env.WALLET_STATE_DIR,
  };

  if (!Value.Check(AppEnvSchema, env)) {
    const errors = [...Value.Errors(AppEnvSchema, env)];
    throw new Error(`Invalid app env:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
  }

  return env as AppEnv;
}
