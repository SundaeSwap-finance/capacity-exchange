import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config.js';
import { requireSocket } from '../config.js';
import { emptyValue, type Value } from './value.js';

/** The era whose commands we use. Nested transactions are a Dijkstra feature. */
const ERA = 'dijkstra';

export interface Utxo {
  txHash: string;
  index: number;
  value: Value;
}

export interface ProtocolParams {
  txFeeFixed: bigint;
  txFeePerByte: bigint;
  utxoCostPerByte: bigint;
}

/**
 * Thin wrapper around the cardano-cli binary. Everything that can be done with the stock
 * tool is done with the stock tool; only nested-transaction assembly is ours, because the
 * CLI has no surface for it.
 */
export class CardanoCli {
  constructor(private readonly config: Config) {}

  /**
   * Runs cardano-cli and returns stdout, surfacing stderr on failure.
   *
   * Always bounded by a timeout: a query against a node that is unreachable, still syncing or
   * busy otherwise blocks forever with no output, which is indistinguishable from this tool
   * having frozen.
   */
  run(args: string[], opts: { needsNode?: boolean } = {}): string {
    const env = { ...process.env };
    if (opts.needsNode) {
      env.CARDANO_NODE_SOCKET_PATH = requireSocket(this.config);
    }
    try {
      return execFileSync(this.config.cardanoCli, args, {
        encoding: 'utf8',
        env,
        maxBuffer: 64 * 1024 * 1024,
        timeout: this.config.cliTimeoutMs,
        killSignal: 'SIGKILL',
        // Capture stderr instead of inheriting it, so cardano-cli's own chatter does not
        // interleave with this tool's output. It is still surfaced on failure.
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const e = err as { stderr?: string; message?: string; code?: string; signal?: string };
      if (e.code === 'ENOENT') {
        throw new Error(`cardano-cli not found at '${this.config.cardanoCli}'. Set CARDANO_CLI or pass --cardano-cli.`);
      }
      if (e.signal === 'SIGKILL' || e.code === 'ETIMEDOUT') {
        const seconds = Math.round(this.config.cliTimeoutMs / 1000);
        const where = opts.needsNode
          ? `\n  It was waiting on the node at ${this.config.socketPath}. Check the node is running ` +
            'and synced with `cardano-cli query tip`, or raise --cli-timeout.'
          : '\n  Raise --cli-timeout if this is expected.';
        throw new Error(`cardano-cli ${args.slice(0, 3).join(' ')} did not finish within ${seconds}s.${where}`);
      }
      throw new Error(`cardano-cli ${args.slice(0, 3).join(' ')} failed:\n${firstLines(e.stderr ?? e.message ?? '')}`);
    }
  }

  private network(): string[] {
    return ['--testnet-magic', String(this.config.testnetMagic)];
  }

  // --- keys and addresses ---

  /**
   * Creates payment.skey / payment.vkey / payment.addr under `dir`.
   *
   * An existing wallet is left alone and its address returned. Regenerating over one would
   * destroy the only key to whatever it holds, and by the time a wallet is interesting it is
   * usually funded.
   */
  createWallet(dir: string): { address: string; created: boolean } {
    mkdirSync(dir, { recursive: true });
    const skey = join(dir, 'payment.skey');
    if (existsSync(skey)) {
      return { address: this.deriveAddress(skey, dir), created: false };
    }
    const vkey = join(dir, 'payment.vkey');
    this.run(['address', 'key-gen', '--verification-key-file', vkey, '--signing-key-file', skey]);
    return { address: this.deriveAddress(skey, dir), created: true };
  }

  /**
   * Derives the payment address from a signing key alone, so a wallet only ever has to be
   * named by its .skey on the command line.
   */
  deriveAddress(signingKeyFile: string, scratchDir: string): string {
    mkdirSync(scratchDir, { recursive: true });
    const vkey = join(scratchDir, 'payment.vkey');
    const addrFile = join(scratchDir, 'payment.addr');
    this.run(['key', 'verification-key', '--signing-key-file', signingKeyFile, '--verification-key-file', vkey]);
    this.run(['address', 'build', '--payment-verification-key-file', vkey, ...this.network(), '--out-file', addrFile]);
    return readFileSync(addrFile, 'utf8').trim();
  }

  /** The payment key hash behind a wallet, used as a native minting policy's signer. */
  keyHash(signingKeyFile: string, scratchDir: string): string {
    this.deriveAddress(signingKeyFile, scratchDir);
    return this.run([
      'address',
      'key-hash',
      '--payment-verification-key-file',
      join(scratchDir, 'payment.vkey'),
    ]).trim();
  }

  policyId(scriptFile: string): string {
    return this.run([ERA, 'transaction', 'policyid', '--script-file', scriptFile]).trim();
  }

  // --- queries ---

  queryUtxo(address: string): Utxo[] {
    const raw = this.run([ERA, 'query', 'utxo', '--address', address, ...this.network(), '--output-json'], {
      needsNode: true,
    });
    return parseUtxoJson(raw);
  }

  /** Resolves specific UTxOs by reference, used to price a sub-transaction's inputs. */
  queryUtxoByRefs(refs: string[]): Utxo[] {
    if (refs.length === 0) {
      return [];
    }
    const filters = refs.flatMap((ref) => ['--tx-in', ref]);
    const raw = this.run([ERA, 'query', 'utxo', ...filters, ...this.network(), '--output-json'], {
      needsNode: true,
    });
    return parseUtxoJson(raw);
  }

  /** Whether the local node still holds this transaction in its mempool, i.e. it is pending. */
  txMempoolExists(txid: string): boolean {
    const raw = this.run(['query', 'tx-mempool', ...this.network(), 'tx-exists', txid], {
      needsNode: true,
    });
    return JSON.parse(raw).exists === true;
  }

  queryProtocolParams(): ProtocolParams {
    const raw = this.run([ERA, 'query', 'protocol-parameters', ...this.network()], { needsNode: true });
    const pp = JSON.parse(raw);
    return {
      txFeeFixed: BigInt(pp.txFeeFixed),
      txFeePerByte: BigInt(pp.txFeePerByte),
      utxoCostPerByte: BigInt(pp.utxoCostPerByte),
    };
  }

  // --- transactions ---

  buildRaw(args: string[]): void {
    this.run([ERA, 'transaction', 'build-raw', ...args]);
  }

  calculateMinFee(txBodyFile: string, protocolParamsFile: string, witnessCount: number): bigint {
    const raw = this.run([
      ERA,
      'transaction',
      'calculate-min-fee',
      '--tx-body-file',
      txBodyFile,
      '--protocol-params-file',
      protocolParamsFile,
      '--witness-count',
      String(witnessCount),
      '--output-json',
    ]);
    const parsed = JSON.parse(raw);
    // The field name has moved around between versions; accept either shape.
    const fee = typeof parsed === 'number' ? parsed : (parsed.fee ?? parsed.Fee ?? parsed.lovelace);
    return BigInt(fee);
  }

  sign(txFile: string, signingKeyFile: string, outFile: string): void {
    this.run([
      ERA,
      'transaction',
      'sign',
      '--tx-file',
      txFile,
      '--signing-key-file',
      signingKeyFile,
      ...this.network(),
      '--out-file',
      outFile,
    ]);
  }

  submit(txFile: string): void {
    this.run([ERA, 'transaction', 'submit', '--tx-file', txFile, ...this.network()], { needsNode: true });
  }

  txid(txFile: string): string {
    const raw = this.run([ERA, 'transaction', 'txid', '--tx-file', txFile]);
    try {
      return JSON.parse(raw).txhash;
    } catch {
      return raw.trim();
    }
  }

  writeProtocolParams(path: string): void {
    this.run([ERA, 'query', 'protocol-parameters', ...this.network(), '--out-file', path], { needsNode: true });
  }
}

/** cardano-cli prints its entire usage text on a parse error; only the head is informative. */
function firstLines(text: string, limit = 6): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const head = lines.slice(0, limit).join('\n');
  return lines.length > limit
    ? `${head}\n  …(${lines.length - limit} more lines of cardano-cli usage suppressed)`
    : head;
}

/** Turns `query utxo --output-json` into our Utxo shape. */
export function parseUtxoJson(raw: string): Utxo[] {
  const parsed = JSON.parse(raw) as Record<string, { value: Record<string, unknown> }>;
  return Object.entries(parsed).map(([ref, entry]) => {
    const [txHash, index] = ref.split('#');
    const value = emptyValue();
    for (const [key, amount] of Object.entries(entry.value)) {
      if (key === 'lovelace') {
        value.lovelace = BigInt(amount as string | number);
        continue;
      }
      // Non-lovelace entries are { policyId: { assetNameHex: quantity } }.
      for (const [assetNameHex, quantity] of Object.entries(amount as Record<string, string | number>)) {
        value.assets.set(`${key}${assetNameHex}`, BigInt(quantity));
      }
    }
    return { txHash, index: Number(index), value };
  });
}

export function utxoRef(utxo: Utxo): string {
  return `${utxo.txHash}#${utxo.index}`;
}
