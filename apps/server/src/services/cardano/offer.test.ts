import { describe, it, expect, vi } from 'vitest';
import { Cardano } from '@cardano-sdk/core';
import { SubTransaction } from '@capacity-exchange/cardano-core';
import { CardanoOfferService } from './offer.js';

const hash28 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(28);
const hash32 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(32);

const keyCredential = (byte: number): Cardano.Credential => ({
  type: Cardano.CredentialType.KeyHash,
  hash: hash28(byte) as Cardano.Credential['hash'],
});

const ADDRESS = Cardano.PaymentAddress(
  Cardano.EnterpriseAddress.fromCredentials(Cardano.NetworkId.Testnet, keyCredential(1))
    .toAddress()
    .toBech32(),
);
const REWARD_ACCOUNT = Cardano.RewardAccount.fromCredential(
  keyCredential(2),
  Cardano.NetworkId.Testnet,
);
const POOL_ID = Cardano.PoolId.fromKeyHash(
  hash28(3) as Parameters<typeof Cardano.PoolId.fromKeyHash>[0],
);
const DREP: Cardano.DelegateRepresentative = keyCredential(4);
const ANCHOR: Cardano.Anchor = {
  url: 'https://example.com',
  dataHash: hash32(5) as Cardano.Anchor['dataHash'],
};

const TOKEN_A = Cardano.AssetId(`${hash28(10)}41`);
const TOKEN_B = Cardano.AssetId(`${hash28(11)}42`);

const txIn = (byte: number, index = 0): Cardano.TxIn => ({
  txId: Cardano.TransactionId(hash32(byte)),
  index,
});

const txOut = (coins: bigint, assets?: [Cardano.AssetId, bigint][]): Cardano.TxOut => ({
  address: ADDRESS,
  value: assets ? { coins, assets: new Map(assets) } : { coins },
});

const utxo = (
  input: Cardano.TxIn,
  coins: bigint,
  assets?: [Cardano.AssetId, bigint][],
): Cardano.Utxo => [{ ...input, address: ADDRESS }, txOut(coins, assets)];

const subTx = (
  body: Partial<Cardano.SubTransactionBody> = {},
  witness: Partial<Cardano.Witness> = {},
): Cardano.SubTransaction => ({
  body: { inputs: [], outputs: [], ...body },
  witness: { signatures: new Map(), ...witness },
});

const newService = (
  resolveInputs: (inputs: Cardano.TxIn[]) => Promise<Cardano.Utxo[]> = async () => [],
) => {
  const chainState = { resolveInputs: vi.fn(resolveInputs) };

  const service = new CardanoOfferService({} as any, chainState as any);
  return { service, chainState };
};

/** A chain state which knows about exactly these UTxOs. */
const resolvingFrom = (known: Cardano.Utxo[]) => async (inputs: Cardano.TxIn[]) =>
  known.filter(([ref]) => inputs.some((i) => i.txId === ref.txId && i.index === ref.index));

const certs = {
  stakeRegistration: {
    __typename: Cardano.CertificateType.StakeRegistration,
    stakeCredential: keyCredential(20),
  },
  stakeDeregistration: {
    __typename: Cardano.CertificateType.StakeDeregistration,
    stakeCredential: keyCredential(20),
  },
  poolRegistration: {
    __typename: Cardano.CertificateType.PoolRegistration,
    poolParameters: {
      id: POOL_ID,
      rewardAccount: REWARD_ACCOUNT,
      pledge: 1_000_000n,
      cost: 340_000_000n,
      margin: { numerator: 1, denominator: 100 },
      relays: [],
      owners: [REWARD_ACCOUNT],
      vrf: Cardano.VrfVkHex(hash32(6)),
    },
  },
  registration: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.Registration,
    stakeCredential: keyCredential(20),
    deposit,
  }),
  unregistration: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.Unregistration,
    stakeCredential: keyCredential(20),
    deposit,
  }),
  stakeRegistrationDelegation: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.StakeRegistrationDelegation,
    stakeCredential: keyCredential(20),
    poolId: POOL_ID,
    deposit,
  }),
  voteRegistrationDelegation: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.VoteRegistrationDelegation,
    stakeCredential: keyCredential(20),
    dRep: DREP,
    deposit,
  }),
  stakeVoteRegistrationDelegation: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.StakeVoteRegistrationDelegation,
    stakeCredential: keyCredential(20),
    poolId: POOL_ID,
    dRep: DREP,
    deposit,
  }),
  registerDRep: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.RegisterDelegateRepresentative,
    dRepCredential: keyCredential(21),
    deposit,
    anchor: null,
  }),
  unregisterDRep: (deposit: bigint): Cardano.Certificate => ({
    __typename: Cardano.CertificateType.UnregisterDelegateRepresentative,
    dRepCredential: keyCredential(21),
    deposit,
  }),
} satisfies Record<string, Cardano.Certificate | ((deposit: bigint) => Cardano.Certificate)>;

/** Certificates which neither consume nor produce ADA. */
const adaNeutralCerts: [string, Cardano.Certificate][] = [
  [
    'StakeDelegation',
    {
      __typename: Cardano.CertificateType.StakeDelegation,
      stakeCredential: keyCredential(20),
      poolId: POOL_ID,
    },
  ],
  [
    'VoteDelegation',
    {
      __typename: Cardano.CertificateType.VoteDelegation,
      stakeCredential: keyCredential(20),
      dRep: DREP,
    },
  ],
  [
    'StakeVoteDelegation',
    {
      __typename: Cardano.CertificateType.StakeVoteDelegation,
      stakeCredential: keyCredential(20),
      poolId: POOL_ID,
      dRep: DREP,
    },
  ],
  [
    'UpdateDelegateRepresentative',
    {
      __typename: Cardano.CertificateType.UpdateDelegateRepresentative,
      dRepCredential: keyCredential(21),
      anchor: null,
    },
  ],
  [
    'AuthorizeCommitteeHot',
    {
      __typename: Cardano.CertificateType.AuthorizeCommitteeHot,
      coldCredential: keyCredential(22),
      hotCredential: keyCredential(23),
    },
  ],
  [
    'ResignCommitteeCold',
    {
      __typename: Cardano.CertificateType.ResignCommitteeCold,
      coldCredential: keyCredential(22),
      anchor: null,
    },
  ],
  // The pool deposit is refunded at the epoch boundary, not by the transaction.
  [
    'PoolRetirement',
    {
      __typename: Cardano.CertificateType.PoolRetirement,
      poolId: POOL_ID,
      epoch: Cardano.EpochNo(500),
    },
  ],
];

const proposal = (deposit: bigint): Cardano.ProposalProcedure => ({
  deposit,
  rewardAccount: REWARD_ACCOUNT,
  governanceAction: { __typename: Cardano.GovernanceActionType.info_action },
  anchor: ANCHOR,
});

const redeemer: Cardano.Redeemer = {
  index: 0,
  purpose: Cardano.RedeemerPurpose.spend,
  data: 0n,
  executionUnits: { memory: 1000, steps: 1000 },
};

describe('CardanoOfferService.validateSubTx', () => {
  it('resolves the inputs of a simple sub-tx', async () => {
    const known = [utxo(txIn(1), 5_000_000n), utxo(txIn(2, 3), 2_000_000n)];
    const { service, chainState } = newService(resolvingFrom(known));
    const core = subTx({ inputs: [txIn(1), txIn(2, 3)], outputs: [txOut(6_000_000n)] });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.response.resolvedInputs).toEqual(known);
    expect(chainState.resolveInputs).toHaveBeenCalledTimes(1);
  });

  it('resolves reference inputs alongside spent inputs', async () => {
    const known = [utxo(txIn(1), 5_000_000n), utxo(txIn(2), 2_000_000n)];
    const { service, chainState } = newService(resolvingFrom(known));
    const core = subTx({
      inputs: [txIn(1)],
      referenceInputs: [txIn(2)],
      outputs: [txOut(5_000_000n)],
    });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result.status).toBe('ok');
    const requested = chainState.resolveInputs.mock.calls[0][0];
    expect(requested).toHaveLength(2);
    expect(requested).toEqual(expect.arrayContaining([txIn(1), txIn(2)]));
    if (result.status !== 'ok') {
      return;
    }
    expect(result.response.resolvedInputs).toHaveLength(2);
  });

  it('rejects a sub-tx when a spent input cannot be resolved', async () => {
    const { service } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const core = subTx({ inputs: [txIn(1), txIn(2)], outputs: [txOut(5_000_000n)] });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result).toEqual({ status: 'malformed', reason: 'some inputs could not be resolved' });
  });

  it('rejects a sub-tx when a reference input cannot be resolved', async () => {
    const { service } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const core = subTx({
      inputs: [txIn(1)],
      referenceInputs: [txIn(2)],
      outputs: [txOut(5_000_000n)],
    });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result).toEqual({ status: 'malformed', reason: 'some inputs could not be resolved' });
  });

  it.each([
    ['StakeRegistration', certs.stakeRegistration],
    ['StakeDeregistration', certs.stakeDeregistration],
    ['PoolRegistration', certs.poolRegistration],
  ] as [string, Cardano.Certificate][])(
    'rejects a %s certificate without querying the chain',
    async (_name, cert) => {
      const { service, chainState } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
      const core = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)], certificates: [cert] });

      const result = await service.validateSubTx(SubTransaction.fromCore(core));

      expect(result).toEqual({
        status: 'malformed',
        reason: 'sub-tx contains unsupported cert types',
      });
      expect(chainState.resolveInputs).not.toHaveBeenCalled();
    },
  );

  it('rejects an unsupported certificate even alongside supported ones', async () => {
    const { service } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const core = subTx({
      inputs: [txIn(1)],
      outputs: [txOut(3_000_000n)],
      certificates: [certs.registration(2_000_000n), certs.stakeDeregistration],
    });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result).toEqual({
      status: 'malformed',
      reason: 'sub-tx contains unsupported cert types',
    });
  });

  it.each([
    ['Registration', certs.registration(2_000_000n)],
    ['Unregistration', certs.unregistration(2_000_000n)],
    ['StakeRegistrationDelegation', certs.stakeRegistrationDelegation(2_000_000n)],
    ['VoteRegistrationDelegation', certs.voteRegistrationDelegation(2_000_000n)],
    ['StakeVoteRegistrationDelegation', certs.stakeVoteRegistrationDelegation(2_000_000n)],
    ['RegisterDelegateRepresentative', certs.registerDRep(500_000_000n)],
    ['UnregisterDelegateRepresentative', certs.unregisterDRep(500_000_000n)],
    ...adaNeutralCerts,
  ] as [string, Cardano.Certificate][])('accepts a %s certificate', async (_name, cert) => {
    const { service } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const core = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)], certificates: [cert] });

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result.status).toBe('ok');
  });

  it('rejects a sub-tx which runs plutus scripts without querying the chain', async () => {
    const { service, chainState } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const core = subTx(
      { inputs: [txIn(1)], outputs: [txOut(5_000_000n)] },
      { redeemers: [redeemer] },
    );

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result).toEqual({ status: 'malformed', reason: 'plutus scripts are not yet supported' });
    expect(chainState.resolveInputs).not.toHaveBeenCalled();
  });

  it('accepts a sub-tx with native scripts', async () => {
    const { service } = newService(resolvingFrom([utxo(txIn(1), 5_000_000n)]));
    const nativeScript: Cardano.NativeScript = {
      __type: Cardano.ScriptType.Native,
      kind: Cardano.NativeScriptKind.RequireAllOf,
      scripts: [],
    };
    const core = subTx(
      { inputs: [txIn(1)], outputs: [txOut(5_000_000n)] },
      { scripts: [nativeScript] },
    );

    const result = await service.validateSubTx(SubTransaction.fromCore(core));

    expect(result.status).toBe('ok');
  });
});

describe('CardanoOfferService.findImbalance', () => {
  const { service } = newService();

  it('reports nothing for a balanced sub-tx', () => {
    const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)] });

    const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
  });

  it('reports nothing for an empty sub-tx', () => {
    expect(service.findImbalance(subTx(), [])).toEqual({
      offers: { coins: 0n },
      needs: { coins: 0n },
    });
  });

  it('offers surplus ADA', () => {
    const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(3_000_000n)] });

    const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

    expect(result).toEqual({ offers: { coins: 2_000_000n }, needs: { coins: 0n } });
  });

  it('needs missing ADA', () => {
    const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(8_000_000n)] });

    const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 3_000_000n } });
  });

  it('needs the full value of a sub-tx with no inputs', () => {
    const sub = subTx({ outputs: [txOut(2_000_000n, [[TOKEN_A, 10n]])] });

    const result = service.findImbalance(sub, []);

    expect(result).toEqual({
      offers: { coins: 0n },
      needs: { coins: 2_000_000n, assets: new Map([[TOKEN_A, 10n]]) },
    });
  });

  it('sums across multiple inputs and outputs', () => {
    const sub = subTx({
      inputs: [txIn(1), txIn(2), txIn(3)],
      outputs: [txOut(4_000_000n), txOut(2_500_000n)],
    });

    const result = service.findImbalance(sub, [
      utxo(txIn(1), 1_000_000n),
      utxo(txIn(2), 2_000_000n),
      utxo(txIn(3), 3_000_000n),
    ]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 500_000n } });
  });

  it('ignores resolved UTxOs the sub-tx does not spend', () => {
    const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)] });

    const result = service.findImbalance(sub, [
      utxo(txIn(1), 5_000_000n),
      utxo(txIn(2), 100_000_000n, [[TOKEN_A, 1000n]]),
    ]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
  });

  it('matches inputs on both transaction id and index', () => {
    const sub = subTx({ inputs: [txIn(1, 1)], outputs: [txOut(5_000_000n)] });

    const result = service.findImbalance(sub, [
      utxo(txIn(1, 0), 100_000_000n),
      utxo(txIn(1, 1), 5_000_000n),
    ]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
  });

  it('does not need reference inputs to be resolved', () => {
    const sub = subTx({
      inputs: [txIn(1)],
      referenceInputs: [txIn(2)],
      outputs: [txOut(5_000_000n)],
    });

    const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
  });

  it('does not count the value of reference inputs', () => {
    const sub = subTx({
      inputs: [txIn(1)],
      referenceInputs: [txIn(2)],
      outputs: [txOut(5_000_000n)],
    });

    const result = service.findImbalance(sub, [
      utxo(txIn(1), 5_000_000n),
      utxo(txIn(2), 10_000_000n, [[TOKEN_A, 5n]]),
    ]);

    expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
  });

  describe('native assets', () => {
    it('reports nothing for balanced assets', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n, [[TOKEN_A, 10n]])] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n, [[TOKEN_A, 10n]])]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });

    it('offers surplus assets', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n, [[TOKEN_A, 3n]])] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n, [[TOKEN_A, 10n]])]);

      expect(result).toEqual({
        offers: { coins: 0n, assets: new Map([[TOKEN_A, 7n]]) },
        needs: { coins: 0n },
      });
    });

    it('needs missing assets', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n, [[TOKEN_A, 10n]])] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n, [[TOKEN_A, 4n]])]);

      expect(result).toEqual({
        offers: { coins: 0n },
        needs: { coins: 0n, assets: new Map([[TOKEN_A, 6n]]) },
      });
    });

    it('sums each asset across inputs and outputs', () => {
      const sub = subTx({
        inputs: [txIn(1), txIn(2)],
        outputs: [
          txOut(2_000_000n, [[TOKEN_A, 5n]]),
          txOut(3_000_000n, [
            [TOKEN_A, 6n],
            [TOKEN_B, 1n],
          ]),
        ],
      });

      const result = service.findImbalance(sub, [
        utxo(txIn(1), 2_000_000n, [
          [TOKEN_A, 4n],
          [TOKEN_B, 2n],
        ]),
        utxo(txIn(2), 3_000_000n, [[TOKEN_A, 4n]]),
      ]);

      expect(result).toEqual({
        offers: { coins: 0n, assets: new Map([[TOKEN_B, 1n]]) },
        needs: { coins: 0n, assets: new Map([[TOKEN_A, 3n]]) },
      });
    });

    it('can offer ADA while needing assets', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(2_000_000n, [[TOKEN_A, 10n]])] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 50_000_000n)]);

      expect(result).toEqual({
        offers: { coins: 48_000_000n },
        needs: { coins: 0n, assets: new Map([[TOKEN_A, 10n]]) },
      });
    });

    it('can offer assets while needing ADA', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(10_000_000n)] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 2_000_000n, [[TOKEN_A, 10n]])]);

      expect(result).toEqual({
        offers: { coins: 0n, assets: new Map([[TOKEN_A, 10n]]) },
        needs: { coins: 8_000_000n },
      });
    });
  });

  describe('minting', () => {
    it('offers minted tokens which are not sent anywhere', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        mint: new Map([[TOKEN_A, 100n]]),
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({
        offers: { coins: 0n, assets: new Map([[TOKEN_A, 100n]]) },
        needs: { coins: 0n },
      });
    });

    it('balances minted tokens against outputs', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n, [[TOKEN_A, 100n]])],
        mint: new Map([[TOKEN_A, 100n]]),
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });

    it('balances burned tokens against inputs', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        mint: new Map([[TOKEN_A, -10n]]),
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n, [[TOKEN_A, 10n]])]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });

    it('needs tokens which are burned but not spent', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        mint: new Map([[TOKEN_A, -10n]]),
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({
        offers: { coins: 0n },
        needs: { coins: 0n, assets: new Map([[TOKEN_A, 10n]]) },
      });
    });

    it('handles minting one asset while burning another', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n, [[TOKEN_A, 40n]])],
        mint: new Map([
          [TOKEN_A, 50n],
          [TOKEN_B, -5n],
        ]),
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n, [[TOKEN_B, 5n]])]);

      expect(result).toEqual({
        offers: { coins: 0n, assets: new Map([[TOKEN_A, 10n]]) },
        needs: { coins: 0n },
      });
    });
  });

  describe('withdrawals', () => {
    it('counts withdrawn rewards as ADA produced', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        withdrawals: [{ stakeAddress: REWARD_ACCOUNT, quantity: 1_500_000n }],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 1_500_000n }, needs: { coins: 0n } });
    });

    it('sums multiple withdrawals', () => {
      const other = Cardano.RewardAccount.fromCredential(
        keyCredential(30),
        Cardano.NetworkId.Testnet,
      );
      const sub = subTx({
        outputs: [txOut(5_000_000n)],
        withdrawals: [
          { stakeAddress: REWARD_ACCOUNT, quantity: 2_000_000n },
          { stakeAddress: other, quantity: 3_000_000n },
        ],
      });

      const result = service.findImbalance(sub, []);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });
  });

  describe('certificates', () => {
    it.each([
      ['Registration', certs.registration],
      ['StakeRegistrationDelegation', certs.stakeRegistrationDelegation],
      ['VoteRegistrationDelegation', certs.voteRegistrationDelegation],
      ['StakeVoteRegistrationDelegation', certs.stakeVoteRegistrationDelegation],
      ['RegisterDelegateRepresentative', certs.registerDRep],
    ])('counts the deposit of a %s certificate as ADA consumed', (_name, cert) => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        certificates: [cert(2_000_000n)],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 2_000_000n } });
    });

    it.each([
      ['Unregistration', certs.unregistration],
      ['UnregisterDelegateRepresentative', certs.unregisterDRep],
    ])('counts the refund of a %s certificate as ADA produced', (_name, cert) => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        certificates: [cert(2_000_000n)],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 2_000_000n }, needs: { coins: 0n } });
    });

    it.each(adaNeutralCerts)('ignores a %s certificate', (_name, cert) => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)], certificates: [cert] });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });

    it('nets deposits against refunds', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        certificates: [certs.unregistration(2_000_000n), certs.registerDRep(500_000_000n)],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 498_000_000n } });
    });
  });

  describe('other ADA sinks', () => {
    it('counts proposal deposits as ADA consumed', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        proposalProcedures: [proposal(100_000_000_000n), proposal(50_000_000_000n)],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 150_000_000_000n } });
    });

    it('counts donations as ADA consumed', () => {
      const sub = subTx({ inputs: [txIn(1)], outputs: [txOut(5_000_000n)], donation: 1_000_000n });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 1_000_000n } });
    });

    it('counts direct deposits as ADA consumed', () => {
      const other = Cardano.RewardAccount.fromCredential(
        keyCredential(30),
        Cardano.NetworkId.Testnet,
      );
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        directDeposits: [
          { stakeAddress: REWARD_ACCOUNT, quantity: 1_000_000n },
          { stakeAddress: other, quantity: 2_000_000n },
        ],
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 3_000_000n } });
    });

    it('does not treat an asserted treasury value as ADA moved', () => {
      const sub = subTx({
        inputs: [txIn(1)],
        outputs: [txOut(5_000_000n)],
        treasuryValue: 1_000_000_000n,
      });

      const result = service.findImbalance(sub, [utxo(txIn(1), 5_000_000n)]);

      expect(result).toEqual({ offers: { coins: 0n }, needs: { coins: 0n } });
    });
  });

  it('combines every source and sink of value', () => {
    const sub = subTx({
      inputs: [txIn(1), txIn(2)],
      outputs: [txOut(20_000_000n, [[TOKEN_A, 30n]]), txOut(1_000_000n, [[TOKEN_B, 7n]])],
      withdrawals: [{ stakeAddress: REWARD_ACCOUNT, quantity: 4_000_000n }],
      certificates: [certs.registration(2_000_000n), certs.unregisterDRep(500_000_000n)],
      mint: new Map([[TOKEN_A, 20n]]),
      proposalProcedures: [proposal(100_000_000n)],
      donation: 3_000_000n,
      directDeposits: [{ stakeAddress: REWARD_ACCOUNT, quantity: 5_000_000n }],
    });

    const result = service.findImbalance(sub, [
      utxo(txIn(1), 10_000_000n, [[TOKEN_A, 15n]]),
      utxo(txIn(2), 6_000_000n, [[TOKEN_B, 2n]]),
    ]);

    // coins: 16 in + 4 withdrawn + 500 refunded - 21 out - 2 deposited - 100 proposed - 3 donated - 5 deposited
    // TOKEN_A: 15 in + 20 minted - 30 out; TOKEN_B: 2 in - 7 out
    expect(result).toEqual({
      offers: { coins: 389_000_000n, assets: new Map([[TOKEN_A, 5n]]) },
      needs: { coins: 0n, assets: new Map([[TOKEN_B, 5n]]) },
    });
  });
});
