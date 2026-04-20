// Offline decoder for the unproven `mintReveal` extrinsic.
//
// Goal: confirm that with `s` as a public circuit argument (rather than a
// witness), the value of `s` lands at a deterministic byte offset inside
// the serialized Midnight transaction — the payload that rides as
// `send_mn_transaction(midnight_tx: Vec<u8>)` on the Substrate side and
// is committed to via `extrinsics_root` in the block header.
//
// No chain access, no wallet, no DUST. Builds the unproven tx from initial
// states + on-disk ZK config, then dumps:
//   1. structural walk: tx → intent → ContractCall → transcript → push(s)
//   2. raw hex dump of the serialized tx
//   3. byte offset(s) at which the known `s` pattern (0xaa repeated) appears

import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  createConstructorContext,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { createUnprovenCallTxFromInitialStates } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { Contract } from '../../out/contract/index.js';
import { CompiledMintDiscloseContract } from '../lib/contract.js';
import { persistentHashBytes32 } from '../lib/operations.js';

const DUMMY_COIN_PK = '0'.repeat(64);
const DUMMY_ENC_PK = '0'.repeat(64);

// Distinctive pattern so we can grep for `s` in the hex dump.
// Byte value can be overridden via CLI arg (hex, single byte) for stability tests.
const sFillArg = process.argv[2] ?? '0xaa';
const sFill = parseInt(sFillArg, 16);
if (Number.isNaN(sFill) || sFill < 0 || sFill > 0xff) {
  console.error(`Invalid s-fill byte: ${sFillArg}. Pass a hex byte like 0xcc.`);
  process.exit(1);
}
const S = new Uint8Array(32).fill(sFill);
const H = persistentHashBytes32(S);
console.log(`Using s = 0x${sFill.toString(16)} × 32`);

// Recipient: UserAddress (Right side of Either) with a distinctive 0xbb pattern.
const RECIPIENT = {
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32).fill(0xbb) },
};

function hexDump(bytes: Uint8Array, label: string): void {
  console.log(`\n=== ${label} (${bytes.length} bytes) ===`);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 32) {
    const slice = bytes.slice(i, i + 32);
    const hex = Buffer.from(slice).toString('hex').match(/.{1,2}/g)!.join(' ');
    lines.push(`${i.toString(16).padStart(6, '0')}  ${hex}`);
  }
  console.log(lines.join('\n'));
}

function findOffsets(haystack: Uint8Array, needle: Uint8Array): number[] {
  const offsets: number[] = [];
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    offsets.push(i);
  }
  return offsets;
}

async function main(): Promise<void> {
  // 0. Network ID is required by the SDK even for offline tx construction.
  setNetworkId('undeployed');

  // 1. Spin up a fresh contract instance offline.
  const contract = new Contract({});
  const init = contract.initialState(createConstructorContext({}, DUMMY_COIN_PK));
  const initialContractState = init.currentContractState;

  // 2. ZK config from disk (out/keys/, out/zkir/).
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '../../out');
  const zkConfigProvider = new NodeZkConfigProvider<'mintReveal' | 'absorb'>(outDir);

  // 3. Build the unproven call tx for mintReveal(s, h, recipient).
  const unsubmitted = await createUnprovenCallTxFromInitialStates(
    zkConfigProvider,
    {
      compiledContract: CompiledMintDiscloseContract,
      circuitId: 'mintReveal',
      contractAddress: dummyContractAddress(),
      args: [S, H, RECIPIENT],
      coinPublicKey: DUMMY_COIN_PK,
      initialContractState,
      initialZswapChainState: new ZswapChainState(),
      ledgerParameters: LedgerParameters.initialParameters(),
    },
    DUMMY_ENC_PK,
  );

  const tx = unsubmitted.private.unprovenTx;

  // 4. Structural walk: tx → intent → actions → ContractCall → transcripts.
  console.log('=== Structural walk ===');
  console.log(`Transaction class:       ${tx.constructor.name}`);
  // intent is keyed by segment id; pull all segments.
  // The .intents getter (or equivalent) varies between SDK versions; introspect.
  const txAny = tx as any;
  console.log(`Transaction props:       ${Object.getOwnPropertyNames(Object.getPrototypeOf(tx)).join(', ')}`);
  if (txAny.intents) {
    const segments = [...txAny.intents.entries()] as Array<[number, any]>;
    console.log(`Intent segments:         ${segments.map(([id]) => id).join(', ')}`);
    for (const [segId, intent] of segments) {
      console.log(`\n  segment ${segId}:`);
      console.log(`    actions: ${intent.actions.length}`);
      intent.actions.forEach((a: any, i: number) => {
        console.log(`    action[${i}]: ${a.constructor.name}`);
        if (a.constructor.name.includes('ContractCall')) {
          console.log(`      address:    ${Buffer.from(a.address).toString('hex')}`);
          console.log(`      entryPoint: ${a.entryPoint}`);
          if (a.guaranteedTranscript) {
            const ops: any[] = a.guaranteedTranscript.program ?? a.guaranteedTranscript.ops ?? [];
            console.log(`      guaranteedTranscript ops: ${ops.length}`);
          }
        }
      });
    }
  } else {
    console.log('  (no .intents getter; SDK shape differs — falling back to raw bytes only)');
  }

  // 5. Raw serialization + offset search.
  const raw = tx.serialize();
  hexDump(raw, 'tx.serialize()');

  console.log('\n=== Pattern search ===');
  const sOffsets = findOffsets(raw, S);
  const hOffsets = findOffsets(raw, H);
  const rOffsets = findOffsets(raw, new Uint8Array(32).fill(0xbb));
  console.log(`s (0x${sFill.toString(16).padStart(2, '0')} × 32)        offsets: ${JSON.stringify(sOffsets)}`);
  console.log(`h = hash(s) (${Buffer.from(H).toString('hex').slice(0, 8)}…) offsets: ${JSON.stringify(hOffsets)}`);
  console.log(`recipient (0xbb × 32) offsets: ${JSON.stringify(rOffsets)}`);
  console.log(`tx total size: ${raw.length} bytes`);

  // 6. Distance between s and h gives a hint at the input AlignedValue layout.
  if (sOffsets.length > 0 && hOffsets.length > 0) {
    console.log(`\nDelta s→h: ${hOffsets[0] - sOffsets[0]} bytes`);
  }
}

main().catch((err) => {
  console.error('decode-extrinsic failed:');
  console.error(err);
  process.exit(1);
});
