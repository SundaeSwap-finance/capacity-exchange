import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { step, wrote } from '../log.js';
import { BODY_SUB_TRANSACTIONS, asArray, decodeTx, readEnvelope } from '../tx/codec.js';
import { decodeSubTransaction, subTransactionSigners } from '../tx/subtx.js';
import { signingKeyPath } from './state.js';

export interface SignOptions {
  callerWallet: string;
}

/**
 * Signs the parent with the caller's key. The exchange's witness sits in the sub-transaction's
 * own witness set and is untouched, which is what lets an offer be signed before the
 * transaction carrying it exists.
 */
export function runSign(config: Config, nestedPath: string, options: SignOptions): void {
  const cli = new CardanoCli(config);
  const signedPath = `${nestedPath}.signed`;

  const before = subSigners(nestedPath);
  step('sign', 'cardano-cli dijkstra transaction sign');
  cli.sign(nestedPath, signingKeyPath(options.callerWallet), signedPath);

  const after = subSigners(signedPath);
  const top = topSigners(signedPath);
  step('sign', `caller witness ${top.map((k) => `${k.slice(0, 6)}…`).join(', ')} added to TOP-LEVEL witness set`);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  step(
    'sign',
    `sub-transaction witness set ${unchanged ? 'unchanged' : 'CHANGED'} (${after.map((k) => `${k.slice(0, 6)}…`).join(', ')})`
  );
  if (!unchanged) {
    throw new Error('Signing altered the sub-transaction witness set; refusing to continue');
  }
  wrote('sign', signedPath);
  step('sign', `next: ces-fund submit ${signedPath}`);
}

function subSigners(path: string): string[] {
  const tx = decodeTx(readEnvelope(path).cborHex);
  return asArray(tx.body.get(BODY_SUB_TRANSACTIONS)).flatMap((raw) =>
    subTransactionSigners(decodeSubTransaction(raw as unknown[]).items)
  );
}

function topSigners(path: string): string[] {
  const tx = decodeTx(readEnvelope(path).cborHex);
  return subTransactionSigners(tx.items);
}
