import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import {
  deploy,
  mintReveal,
  absorbAlone,
  mintAndAbsorbAtomic,
  queryDisclosedPreimage,
  randomBytes32,
  persistentHashBytes32,
} from '../lib/operations.js';

interface E2EOutput {
  deployed: Awaited<ReturnType<typeof deploy>>;
  testA: {
    label: string;
    mint: Awaited<ReturnType<typeof mintReveal>>;
    stateLookup: Awaited<ReturnType<typeof queryDisclosedPreimage>>;
    disclosedSMatchesInput: boolean;
  };
  testB: {
    label: string;
    attempt: Awaited<ReturnType<typeof absorbAlone>>;
    failedAsExpected: boolean;
  };
  testC: {
    label: string;
    tx: Awaited<ReturnType<typeof mintAndAbsorbAtomic>>;
    stateLookup: Awaited<ReturnType<typeof queryDisclosedPreimage>>;
    disclosedSMatchesInput: boolean;
  };
}

function userAddrRecipient(userAddressBytes: Uint8Array) {
  return {
    is_left: false,
    left: { bytes: new Uint8Array(32) },
    right: { bytes: userAddressBytes },
  };
}

function main(): Promise<E2EOutput> {
  program
    .name('midnight-mint-disclose:e2e')
    .description('Prove mint-with-disclosure + balance-check enforcement end-to-end')
    .argument('<networkId>', 'Network ID (e.g. preview, preprod)')
    .parse();

  const [networkId] = program.args;

  return withAppContext(networkId, async (ctx) => {
    // Raw 32-byte unshielded address of the signer wallet — used as the
    // recipient for minted tokens in Tests A and C.
    const unshieldedState = await ctx.walletContext.walletFacade.unshielded.waitForSyncedState();
    const userAddressBytes: Uint8Array = unshieldedState.address;
    const recipient = userAddrRecipient(userAddressBytes);

    const deployed = await deploy(ctx);

    // Test A: mint alone
    const sA = randomBytes32();
    const hA = persistentHashBytes32(sA);
    const mintA = await mintReveal(ctx, deployed.contractAddress, deployed.privateStateId, sA, recipient);
    const lookupA = await queryDisclosedPreimage(ctx, deployed.contractAddress, hA);
    const testA = {
      label: 'A: mintReveal alone; s should be observable on-chain',
      mint: mintA,
      stateLookup: lookupA,
      disclosedSMatchesInput: lookupA.present && lookupA.s === Buffer.from(sA).toString('hex'),
    };

    // Test B: absorb without prior matching mint
    const sB = randomBytes32();
    const hB = persistentHashBytes32(sB);
    const attemptB = await absorbAlone(ctx, deployed.contractAddress, deployed.privateStateId, hB);
    const testB = {
      label: 'B: absorb alone with fresh h never minted; should fail (no supply)',
      attempt: attemptB,
      failedAsExpected: !attemptB.succeeded,
    };

    // Test C: mint + absorb atomic in a single intent
    const sC = randomBytes32();
    const hC = persistentHashBytes32(sC);
    const txC = await mintAndAbsorbAtomic(ctx, deployed.contractAddress, deployed.privateStateId, sC, recipient);
    const lookupC = await queryDisclosedPreimage(ctx, deployed.contractAddress, hC);
    const testC = {
      label: 'C: mintReveal + absorb in the same intent; should succeed with s observable',
      tx: txC,
      stateLookup: lookupC,
      disclosedSMatchesInput: lookupC.present && lookupC.s === Buffer.from(sC).toString('hex'),
    };

    return { deployed, testA, testB, testC };
  });
}

runCli(main, { pretty: true });
