import { encode } from 'cbor2';
import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { assetLabel, formatValue } from '../cardano/value.js';
import { decodeBech32Address } from '../cardano/address.js';
import { formatAsset, step, wrote } from '../log.js';
import { offerFee, vkeyWitnessBytes } from '../tx/batch.js';
import { bytesToHex } from '../tx/codec.js';
import { buildOfferBody, minUtxoLovelace } from '../tx/subtx.js';
import { ARTIFACTS, readJson, type Selection, type StoredDraft, workPath, writeJson } from './state.js';

export interface BuildOptions {
  selection: string;
  send: string;
  to: string;
}

/** `--send 100000000:policyhexname` */
function parseSend(spec: string): { unit: string; quantity: bigint } {
  const [quantity, unit] = spec.split(':');
  if (!quantity || !unit) {
    throw new Error(`--send must look like <quantity>:<unit>, got '${spec}'`);
  }
  return { unit, quantity: BigInt(quantity) };
}

/**
 * Builds the caller's offer: a sub-transaction spending their token UTxO into a payment and a
 * change output, left unsigned until the price is known.
 *
 * It is deliberately unbalanced. The change output needs lovelace the caller does not have,
 * and whoever carries the offer has to supply it along with the fee. That is the capacity
 * this step works out: the change output's minimum, plus the ledger's fee formula applied to
 * the offer's own signed size. Anything the batch costs beyond that is the exchange's affair.
 *
 * `cardano-cli` has no way to build a sub-transaction, so the body is assembled here.
 */
export function runBuild(config: Config, options: BuildOptions): void {
  const cli = new CardanoCli(config);
  const selection = readJson<Selection>(options.selection, 'UTxO selection');
  const { unit, quantity } = parseSend(options.send);

  const held = BigInt(selection.assets[unit] ?? '0');
  if (held < quantity) {
    throw new Error(`Caller holds ${held} of ${assetLabel(unit)}, cannot send ${quantity}`);
  }

  // The exchange is paid in this token out of the caller's own change, so some has to stay
  // behind. How much is not known until `quote`, but none at all can never be enough.
  const leftover = held - quantity;
  if (leftover === 0n) {
    throw new Error(
      `Sending all ${held} of ${assetLabel(unit)} leaves nothing to pay the exchange with. ` +
        'Send less than the full holding so the change output can cover the price.'
    );
  }

  const pp = cli.queryProtocolParams();
  const lovelace = BigInt(selection.lovelace);
  const callerAddress = decodeBech32Address(selection.address);
  const change = { address: callerAddress, value: { lovelace: 0n, assets: new Map([[unit, leftover]]) } };
  const changeLovelace = minUtxoLovelace(change, pp.utxoCostPerByte);
  change.value.lovelace = changeLovelace;

  // The recipient keeps the caller's own lovelace; the change output's minimum is what the
  // exchange has to supply on top of the fee.
  const payment = {
    address: decodeBech32Address(options.to),
    value: { lovelace, assets: new Map([[unit, quantity]]) },
  };
  const input = { txHash: selection.txHash, index: selection.index };
  const body = buildOfferBody([input], [payment, change]);

  step(
    'build',
    `input   ${selection.txHash.slice(0, 6)}…#${selection.index}   ${formatValue({ lovelace, assets: new Map([[unit, held]]) })}`
  );
  step('build', `sending ${formatAsset(quantity)} ${assetLabel(unit)} to ${options.to}`);
  step('build', `change  ${formatAsset(leftover)} ${assetLabel(unit)} back to the caller, to pay the exchange from`);

  // Signed size: the body, an empty witness set grown by one vkey witness, and no aux data.
  // Taking the price out of the change can only shorten its token quantity, so this is an
  // upper bound on the size that will actually be signed.
  const signedSize = encode([body, new Map(), null]).length + vkeyWitnessBytes(1);
  const feeShare = offerFee(signedSize, pp.txFeeFixed, pp.txFeePerByte);
  const capacity = changeLovelace + feeShare;

  step('build', `offer is ~${signedSize} bytes signed; its share of the fee is ${feeShare} lovelace`);
  step('build', `  (${pp.txFeeFixed} + ${pp.txFeePerByte} × ${signedSize}, the ledger's own fee formula)`);
  step('build', `change output needs ${changeLovelace} lovelace the caller does not have`);
  step('build', `capacity to request: ${feeShare} + ${changeLovelace} = ${capacity} lovelace`);

  const draftPath = workPath(config, ARTIFACTS.draft);
  const draft: StoredDraft = {
    body: bytesToHex(encode(body)),
    callerAddress: selection.address,
    capacity: capacity.toString(),
  };
  writeJson(draftPath, draft);
  wrote('build', draftPath);
  step('build', `next: ces-fund quote --selection ${options.selection} --capacity ${capacity} --ces-url <url>`);
}
