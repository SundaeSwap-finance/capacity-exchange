/**
 * Ad-hoc script: measures the real DUST cost of an offer transaction from a
 * live Capacity Exchange server, using the network's live protocol
 * parameters (not the SDK's baked-in initial/genesis defaults).
 *
 * Usage: bun run scratch-fee-live.ts [serverUrl] [indexerUrl]
 *   defaults to the hosted preview server/indexer.
 */
import { Transaction, LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';

const serverUrl = process.argv[2] ?? 'https://capacity-exchange.preview.sundae.fi';
const indexerUrl = process.argv[3] ?? 'https://indexer.preview.midnight.network/api/v3/graphql';

async function getOfferTx(): Promise<Uint8Array> {
  const priceRes = await fetch(`${serverUrl}/api/prices?currency=DUST&amount=1000`);
  if (!priceRes.ok) {
    throw new Error(`GET /api/prices failed: ${priceRes.status} ${await priceRes.text()}`);
  }
  const priceData = (await priceRes.json()) as {
    quoteId: string;
    prices: { amount: string; currency: { id: string; type: string; rawId: string } }[];
  };
  const shieldedPrice = priceData.prices.find((p) => p.currency.type === 'midnight:shielded');
  if (!shieldedPrice) {
    throw new Error('No shielded currency offered by /api/prices');
  }

  const offerRes = await fetch(`${serverUrl}/api/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteId: priceData.quoteId,
      offerCurrency: shieldedPrice.currency.id,
    }),
  });
  if (!offerRes.ok) {
    throw new Error(`POST /api/offers failed: ${offerRes.status} ${await offerRes.text()}`);
  }
  const offerData = (await offerRes.json()) as { serializedTx: string };
  return Buffer.from(offerData.serializedTx, 'hex');
}

function deserializeTx(bytes: Uint8Array) {
  // Transaction.deserialize takes string "markers" for signature/proof/binding
  // state ('signature' | 'signature-erased', 'proof' | 'pre-proof' | 'no-proof',
  // 'binding' | 'pre-binding' | 'no-binding') — brute-force the combo that parses,
  // since a server-built offer tx's exact state isn't otherwise obvious here.
  for (const proofMarker of ['proof', 'pre-proof', 'no-proof']) {
    for (const bindingMarker of ['binding', 'pre-binding', 'no-binding']) {
      try {
        const tx = Transaction.deserialize('signature', proofMarker as never, bindingMarker as never, bytes);
        return { tx, proofMarker, bindingMarker };
      } catch {
        // try next combination
      }
    }
  }
  throw new Error('could not deserialize with any marker combination');
}

async function main() {
  console.log(`Fetching a real offer transaction from ${serverUrl} ...`);
  const bytes = await getOfferTx();
  console.log(`Got ${bytes.length} bytes.`);

  const { tx, proofMarker, bindingMarker } = deserializeTx(bytes);
  console.log(`Deserialized with markers: signature/${proofMarker}/${bindingMarker}`);

  const intents = tx.intents ? [...tx.intents.entries()] : [];
  for (const [segment, intent] of intents) {
    console.log(`  segment ${segment}: dustActions=${!!intent.dustActions}`);
  }

  console.log(`\nFetching live protocol parameters from ${indexerUrl} ...`);
  const liveParams = await getLedgerParameters(indexerUrl);
  const initParams = LedgerParameters.initialParameters();

  console.log('\n--- Fees ---');
  console.log('fees (SDK initial/genesis params):', tx.fees(initParams).toString(), 'specks');
  console.log('fees (LIVE network params):       ', tx.fees(liveParams).toString(), 'specks');

  console.log('\n--- Resource cost (live params) ---');
  console.log(tx.cost(liveParams));

  console.log('\n--- Fixed per-transaction baseline (live params) ---');
  console.log(liveParams.transactionCostModel.baselineCost);

  console.log('\n--- Fee price factors (live params) ---');
  console.log(liveParams.feePrices);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
