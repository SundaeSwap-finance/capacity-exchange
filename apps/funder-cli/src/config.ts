/**
 * Resolves the handful of settings every command needs. Each one may come from a flag or
 * an environment variable; the flag always wins so a one-off run can override a shell that
 * is set up for something else.
 */
export interface Config {
  /** Path to (or name of) the cardano-cli binary. */
  cardanoCli: string;
  /** Node socket. Only the commands that talk to a node require it. */
  socketPath?: string;
  /** Network magic. Musashi is 164. */
  testnetMagic: number;
  /** Where intermediate artifacts (drafts, quotes, offers) are kept. */
  workDir: string;
  /** Hard bound on any single cardano-cli invocation. */
  cliTimeoutMs: number;
}

export interface GlobalOptions {
  cardanoCli?: string;
  socketPath?: string;
  testnetMagic?: string;
  workDir?: string;
  cliTimeout?: string;
}

export const DEFAULT_TESTNET_MAGIC = 164;

export function resolveConfig(opts: GlobalOptions): Config {
  const magic = opts.testnetMagic ?? process.env.CARDANO_TESTNET_MAGIC;
  return {
    cardanoCli: opts.cardanoCli ?? process.env.CARDANO_CLI ?? 'cardano-cli',
    socketPath: opts.socketPath ?? process.env.CARDANO_NODE_SOCKET_PATH,
    testnetMagic: magic ? Number(magic) : DEFAULT_TESTNET_MAGIC,
    workDir: opts.workDir ?? process.env.CES_FUND_WORK_DIR ?? '.ces-fund',
    cliTimeoutMs: Number(opts.cliTimeout ?? process.env.CES_FUND_CLI_TIMEOUT ?? 120) * 1000,
  };
}

/** Commands that hit the node need a socket; fail early with a message that says how to fix it. */
export function requireSocket(config: Config): string {
  if (!config.socketPath) {
    throw new Error('No node socket configured. Set CARDANO_NODE_SOCKET_PATH or pass --socket-path.');
  }
  return config.socketPath;
}
