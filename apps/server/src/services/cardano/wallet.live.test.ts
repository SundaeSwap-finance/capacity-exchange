import { describe, it, expect, beforeAll } from 'vitest';
import pino from 'pino';
import { blake2b } from '@noble/hashes/blake2.js';
import {
  buildOfferBody,
  bytesToHex,
  encodeEnvelope,
  enterpriseAddress,
  paymentKey,
  signSubTransaction,
  type TxInput,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { CardanoChainStateService } from '../cardano-chain-state.js';
import { CardanoWalletService } from './wallet.js';
import { CardanoOfferService } from './offers.js';

/**
 * Submits real transactions through a live UTxO RPC source such as Dolos, and is skipped
 * without one. The key must hold at least 10 ADA in ADA-only UTxOs:
 *   UTXORPC_LIVE_TEST_URL=http://127.0.0.1:50151 \
 *   CARDANO_LIVE_TEST_SKEY_FILE=<cardano-cli payment.skey> bunx vitest run wallet.live
 * Inclusion takes a few minutes on Musashi, so each test waits for its transaction on chain.
 */
const url = process.env.UTXORPC_LIVE_TEST_URL;
const skeyFile = process.env.CARDANO_LIVE_TEST_SKEY_FILE;
const INCLUSION_TIMEOUT_MS = 10 * 60_000;
const CALLER_FUNDS = 3_000_000n;
const OFFER_OUTPUT = 4_000_000n;

describe.skipIf(!url || !skeyFile)('Cardano transactions over a live UTxO RPC source', () => {
  const logger = pino({ level: 'silent' }) as never;
  let wallet: CardanoWalletService;
  let caller: ReturnType<typeof paymentKey>;
  let callerAddress: Uint8Array;
  let callerInput: TxInput;

  async function onChain(input: TxInput): Promise<boolean> {
    return (await wallet.resolve([input])).size > 0;
  }

  beforeAll(async () => {
    const chainState = new CardanoChainStateService(url!, logger);
    wallet = await CardanoWalletService.create(
      url!,
      skeyFile!,
      () => chainState.protocolParams(),
      logger,
    );
    // Derived from the server's key, so what the caller is left with stays recoverable.
    caller = paymentKey(
      blake2b(Uint8Array.from([...wallet.key.signingKey, ...Buffer.from('caller')]), { dkLen: 32 }),
    );
    callerAddress = enterpriseAddress(caller.keyHash, wallet.address[0] & 0x0f);
  });

  it(
    'pays a plain transaction',
    async () => {
      const txId = await wallet.pay([
        { address: callerAddress, value: { lovelace: CALLER_FUNDS, assets: new Map() } },
      ]);
      callerInput = { txHash: txId, index: 0 };

      await expect
        .poll(() => onChain(callerInput), { timeout: INCLUSION_TIMEOUT_MS, interval: 5_000 })
        .toBe(true);
    },
    INCLUSION_TIMEOUT_MS + 30_000,
  );

  it(
    'carries an offer that is short of ADA in a batch the server funds',
    async () => {
      expect(callerInput, 'needs the payment from the previous test').toBeDefined();
      const body = buildOfferBody(
        [callerInput],
        [{ address: callerAddress, value: { lovelace: OFFER_OUTPUT, assets: new Map() } }],
      );
      const sub = signSubTransaction(body, caller.signingKey);
      const service = new CardanoOfferService(wallet, logger);

      const { offerId } = service.submit(bytesToHex(encodeEnvelope(sub.bytes)));
      await service.idle();
      const status = service.status(offerId);
      expect(status?.reason).toBeUndefined();
      expect(status?.state).toBe('submitted');

      // The ledger stores a sub-transaction's outputs under its own TxId, which is the offer id.
      await expect
        .poll(() => onChain({ txHash: offerId, index: 0 }), {
          timeout: INCLUSION_TIMEOUT_MS,
          interval: 5_000,
        })
        .toBe(true);
      expect(await onChain(callerInput)).toBe(false);
    },
    INCLUSION_TIMEOUT_MS + 30_000,
  );
});
