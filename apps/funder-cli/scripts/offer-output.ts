/**
 * Places an arbitrary output (such as a SundaeSwap V4 order with an inline datum) through a
 * live Capacity Exchange: builds an offer spending the caller's one token UTxO, prices its ADA
 * shortfall with GET /api/cardano/prices, signs it, posts it and waits for `<offer id>#0`.
 *
 *   CARDANO_NODE_SOCKET_PATH=… bun scripts/offer-output.ts \
 *     --skey caller.skey --addr caller.addr --output-hex <cbor> --ces-url http://127.0.0.1:3015
 *
 * The output's own tokens come out of the caller's UTxO; the rest, less the price, goes back
 * to the caller with the change output's minimum ADA.
 */
import { decode } from 'cbor2';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  buildOfferBody,
  bytesToHex,
  decodeBech32Address,
  decodeOutput,
  encodeEnvelope,
  hexToBytes,
  minUtxoLovelace,
  offerFee,
  readSigningKey,
  signSubTransaction,
  type TxOutput,
  type Value,
} from '@sundaeswap/capacity-exchange-cardano-tx';

const { values: args } = parseArgs({
  options: {
    skey: { type: 'string' },
    addr: { type: 'string' },
    'output-hex': { type: 'string' },
    'ces-url': { type: 'string' },
    cli: { type: 'string', default: process.env.CARDANO_CLI ?? 'cardano-cli' },
    magic: { type: 'string', default: process.env.CARDANO_TESTNET_MAGIC ?? '164' },
  },
});
for (const k of ['skey', 'addr', 'output-hex', 'ces-url'] as const) {
  if (!args[k]) throw new Error(`--${k} is required`);
}
const cesUrl = args['ces-url']!.replace(/\/$/, '');
const bech32 = readFileSync(args.addr!, 'utf8').trim();

function cli(...a: string[]): string {
  return execFileSync(args.cli!, [...a, '--testnet-magic', args.magic!], { encoding: 'utf8' });
}

const pp = JSON.parse(cli('dijkstra', 'query', 'protocol-parameters'));
const txFeeFixed = BigInt(pp.txFeeFixed);
const txFeePerByte = BigInt(pp.txFeePerByte);
const utxoCostPerByte = BigInt(pp.utxoCostPerByte);

const utxos = Object.entries(
  JSON.parse(cli('dijkstra', 'query', 'utxo', '--address', bech32, '--output-json')) as Record<
    string,
    { value: Record<string, unknown> }
  >
);
if (utxos.length !== 1) throw new Error(`expected exactly one caller UTxO, found ${utxos.length}`);
const [ref, { value: rawValue }] = utxos[0];
const [txHash, index] = ref.split('#');
const held: Value = { lovelace: 0n, assets: new Map() };
for (const [policy, v] of Object.entries(rawValue)) {
  if (policy === 'lovelace') held.lovelace = BigInt(v as number);
  else for (const [name, q] of Object.entries(v as Record<string, number>)) held.assets.set(policy + name, BigInt(q));
}

const placed = decodeOutput(decode(hexToBytes(args['output-hex']!)));
const callerAddress = decodeBech32Address(bech32);

function changeOutput(price: bigint, unit?: string): TxOutput {
  const assets = new Map(held.assets);
  for (const [u, q] of placed.value.assets) assets.set(u, (assets.get(u) ?? 0n) - q);
  if (unit) assets.set(unit, (assets.get(unit) ?? 0n) - price);
  for (const [u, q] of assets) {
    if (q < 0n) throw new Error(`caller holds too little ${u}`);
    if (q === 0n) assets.delete(u);
  }
  const out: TxOutput = { address: callerAddress, value: { lovelace: 0n, assets } };
  out.value.lovelace = minUtxoLovelace(out, utxoCostPerByte);
  return out;
}

function sign(change: TxOutput) {
  const body = buildOfferBody([{ txHash, index: Number(index) }], [placed, change]);
  return signSubTransaction(body, readSigningKey(args.skey!));
}

// Capacity from a draft priced with a placeholder of the same width as any real price.
const draft = sign(changeOutput(0n));
const shortfall = placed.value.lovelace + changeOutput(0n).value.lovelace - held.lovelace;
const capacity = shortfall + offerFee(draft.bytes.length + 16, txFeeFixed, txFeePerByte);
console.log(`ADA shortfall ${shortfall} lovelace, capacity ${capacity}`);

const priced = await fetch(`${cesUrl}/api/cardano/prices?amount=${capacity}`).then((r) => r.json());
const price = priced.prices.find((p: { currency: { rawId: string } }) => held.assets.has(p.currency.rawId));
if (!price) throw new Error(`no quoted price in a token the caller holds: ${JSON.stringify(priced.prices)}`);
console.log(`price ${price.amount} of ${price.currency.rawId}`);

const sub = sign(changeOutput(BigInt(price.amount), price.currency.rawId));
const posted = await fetch(`${cesUrl}/api/cardano/offers`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ envelope: bytesToHex(encodeEnvelope(sub.bytes)), quoteId: priced.quoteId }),
});
const status = await posted.json();
console.log(`POST /offers ${posted.status}`, status);
if (posted.status !== 202) process.exit(1);
const offerId: string = status.offerId;

for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await fetch(`${cesUrl}/api/cardano/offers/${offerId}`).then((r) => r.json());
  console.log(
    `offer ${s.state}${s.batchTxId ? ` batch ${s.batchTxId}` : ''}${s.reason ? ` ${JSON.stringify(s.reason)}` : ''}`
  );
  if (s.state === 'submitted' || s.state === 'rejected') break;
}

const deadline = Date.now() + 15 * 60_000;
while (Date.now() < deadline) {
  const found = JSON.parse(cli('dijkstra', 'query', 'utxo', '--tx-in', `${offerId}#0`, '--output-json'));
  if (Object.keys(found).length > 0) {
    console.log(`on chain: ${offerId}#0`, JSON.stringify(found[`${offerId}#0`].value));
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 10_000));
}
console.error(`timed out waiting for ${offerId}#0`);
process.exit(1);
