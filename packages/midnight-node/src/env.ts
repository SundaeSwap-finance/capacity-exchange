export type Env = Record<string, string | undefined>;

/** Reads `name` from `env`, throwing if missing or empty. */
export function requireEnvVar(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
