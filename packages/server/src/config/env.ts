import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';

const AppEnvSchema = Type.Object({
  networkId: Type.String(),
  walletSeedFile: Type.Optional(Type.String()),
  walletMnemonicFile: Type.Optional(Type.String()),
  priceConfigFile: Type.String(),
  port: Type.Number(),
  logLevel: Type.String(),
  offerTtlSeconds: Type.Number(),
  proofServerUrl: Type.Optional(Type.String()),
  walletStateDir: Type.String(),
});

export type AppEnv = Static<typeof AppEnvSchema>;

/** Parse and validate app env vars from process.env. */
export function parseAppEnv(): AppEnv {
  const env = {
    networkId: process.env.MIDNIGHT_NETWORK,
    walletSeedFile: process.env.WALLET_SEED_FILE,
    walletMnemonicFile: process.env.WALLET_MNEMONIC_FILE,
    priceConfigFile: process.env.PRICE_CONFIG_FILE,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    logLevel: process.env.LOG_LEVEL,
    offerTtlSeconds: process.env.OFFER_TTL_SECONDS ? Number(process.env.OFFER_TTL_SECONDS) : undefined,
    proofServerUrl: process.env.PROOF_SERVER_URL,
    walletStateDir: process.env.WALLET_STATE_DIR,
  };

  if (!Value.Check(AppEnvSchema, env)) {
    const errors = [...Value.Errors(AppEnvSchema, env)];
    throw new Error(`Invalid app env:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
  }

  return env as AppEnv;
}
