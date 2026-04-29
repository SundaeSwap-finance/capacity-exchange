import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import {
  deploy,
  mintReveal,
  absorbAlone,
  mintAndAbsorbAttempt,
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
    attempt: Awaited<ReturnType<typeof mintAndAbsorbAttempt>>;
    stateLookup: Awaited<ReturnType<typeof queryDisclosedPreimage>>;
    succeededAsExpected: boolean;
    disclosedSMatchesInput: boolean;
  };
  testCPrime: {
    label: string;
    attempt: Awaited<ReturnType<typeof mintAndAbsorbAttempt>>;
    failedAsExpected: boolean;
  };
}

function main(): Promise<E2EOutput> {
  program
    .name('midnight-mint-disclose:e2e')
    .description('Prove mint-with-disclosure + balance-check enforcement (two-secret form) end-to-end')
    .argument('<networkId>', 'Network ID (e.g. preview, preprod)')
    .parse();

  const [networkId] = program.args;

  return withAppContext(networkId, async (ctx) => {
    // The user's private witness secret. Stays in private state for the
    // lifetime of this contract instance; never disclosed on chain.
    const sPrime = randomBytes32();
    const hPrimeMatching = persistentHashBytes32(sPrime);

    const deployed = await deploy(ctx, sPrime);

    // Test A: mint alone. Mint color depends on the witness s', but we only
    // verify s lands on chain (via disclosedPreimages, keyed by hash(s)).
    const sA = randomBytes32();
    const hsA = persistentHashBytes32(sA);
    const mintA = await mintReveal(ctx, deployed.contractAddress, deployed.privateStateId, sA);
    const lookupA = await queryDisclosedPreimage(ctx, deployed.contractAddress, hsA);
    const testA = {
      label: 'A: mintReveal alone; s should be observable on-chain',
      mint: mintA,
      stateLookup: lookupA,
      disclosedSMatchesInput: lookupA.present && lookupA.s === Buffer.from(sA).toString('hex'),
    };

    // Test B: absorb alone with random (h, h'). Should fail — no matching mint.
    const hsB = persistentHashBytes32(randomBytes32());
    const hPrimeRandomB = randomBytes32();
    const attemptB = await absorbAlone(ctx, deployed.contractAddress, deployed.privateStateId, hsB, hPrimeRandomB);
    const testB = {
      label: "B: absorb alone with random (h, h'); should fail (no supply)",
      attempt: attemptB,
      failedAsExpected: !attemptB.succeeded,
    };

    // Test C: mint + absorb with the *correct* h' (= hash(s')). Should succeed.
    const sC = randomBytes32();
    const hsC = persistentHashBytes32(sC);
    const attemptC = await mintAndAbsorbAttempt(
      ctx,
      deployed.contractAddress,
      deployed.privateStateId,
      sC,
      hPrimeMatching
    );
    const lookupC = await queryDisclosedPreimage(ctx, deployed.contractAddress, hsC);
    const testC = {
      label: "C: mintReveal + absorb(h, h') with h' matching the witness; should succeed",
      attempt: attemptC,
      stateLookup: lookupC,
      succeededAsExpected: attemptC.succeeded,
      disclosedSMatchesInput: lookupC.present && lookupC.s === Buffer.from(sC).toString('hex'),
    };

    // Test C': mint + absorb with a *wrong* h'. Should fail on the ledger
    // balance check — the mint color is hash(hash(s) || hash(s')), the absorb
    // color is hash(hash(s) || h'_wrong); colors do not match, transaction
    // does not balance. This is the front-run defense: an LP that has only s
    // (from mempool) cannot pick a working h'_wrong without the user's s'.
    const sCp = randomBytes32();
    const hPrimeWrong = randomBytes32();
    const attemptCp = await mintAndAbsorbAttempt(
      ctx,
      deployed.contractAddress,
      deployed.privateStateId,
      sCp,
      hPrimeWrong
    );
    const testCPrime = {
      label: "C': mintReveal + absorb(h, h') with a wrong h'; should fail (balance mismatch)",
      attempt: attemptCp,
      failedAsExpected: !attemptCp.succeeded,
    };

    return { deployed, testA, testB, testC, testCPrime };
  });
}

runCli(main, { pretty: true });
