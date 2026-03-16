import * as crypto from 'crypto';
import {
  transientHash,
  CompactTypeField,
  CompactTypeBytes,
  CompactTypeUnsignedInteger,
} from '@midnight-ntwrk/compact-runtime';
import { encodeCoinPublicKey } from '@midnight-ntwrk/ledger-v7';
import { AppContext, buildProviders, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { toTxResult, type TxResult } from '@capacity-exchange/midnight-core';
import { createLogger } from '@capacity-exchange/midnight-node';
import { CompiledVaultContract, VaultContract, Vault } from '../core/contract.js';
import { type KeyPair } from './schnorr.js';
import { createPrivateState } from '../core/witnesses.js';
import { vaultSignMultisig } from './vault-signing.js';

const logger = createLogger(import.meta);

// Type descriptors for the deposit message tuple [Bytes<32>, Field, Uint<64>, Bytes<32>].
// Names and values are copied from the Compact compiler output (vault/out/contract/index.js)
// so that transientHash serializes the message identically to the on-chain deposit circuit.
//   _descriptor_0  → CompactTypeBytes(32)           — recipient, domainSep
//   _descriptor_8  → CompactTypeField               — mintNonce
//   _descriptor_13 → CompactTypeUnsignedInteger(64)  — amount
const _descriptor_0 = new CompactTypeBytes(32);
const _descriptor_8 = CompactTypeField;
const _descriptor_13 = new CompactTypeUnsignedInteger(18446744073709551615n, 8);

const depositMsgDescriptor = {
  alignment() {
    return _descriptor_0
      .alignment()
      .concat(_descriptor_8.alignment().concat(_descriptor_13.alignment().concat(_descriptor_0.alignment())));
  },
  // Required by CompactType interface but unused — transientHash only calls toValue/alignment.
  fromValue(value: Uint8Array[]): [Uint8Array, bigint, bigint, Uint8Array] {
    return [
      _descriptor_0.fromValue(value),
      _descriptor_8.fromValue(value),
      _descriptor_13.fromValue(value),
      _descriptor_0.fromValue(value),
    ];
  },
  toValue(value: [Uint8Array, bigint, bigint, Uint8Array]) {
    return _descriptor_0
      .toValue(value[0])
      .concat(
        _descriptor_8.toValue(value[1]).concat(_descriptor_13.toValue(value[2]).concat(_descriptor_0.toValue(value[3])))
      );
  },
};

export interface DepositParams {
  contractAddress: string;
  keyPairs: KeyPair[];
  domainSep: string;
  amount: bigint;
}

async function queryMintNonce(
  providers: ReturnType<typeof buildProviders<VaultContract>>,
  contractAddress: string
): Promise<bigint> {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }
  const ledgerState = Vault.ledger(contractState.data);
  return ledgerState.mintNonce;
}

function getRecipient(ctx: AppContext): Uint8Array {
  const coinPublicKey = ctx.walletContext.walletProvider.getCoinPublicKey();
  return encodeCoinPublicKey(coinPublicKey);
}

function computeDepositMessage(
  recipient: Uint8Array,
  mintNonce: bigint,
  amount: bigint,
  domainSep: string
): { message: bigint; domainSepBytes: Uint8Array } {
  const domainSepBytes = Buffer.from(domainSep, 'hex');
  const message = transientHash(depositMsgDescriptor, [recipient, mintNonce, amount, domainSepBytes]);
  return { message, domainSepBytes };
}

function signDeposit(keyPairs: KeyPair[], message: bigint) {
  const signResults = vaultSignMultisig(keyPairs, message);
  return {
    signatures: signResults.map((r) => r.signature),
    challengeQuotients: signResults.map((r) => r.challengeQuotient),
    publicKeys: keyPairs.map((kp) => kp.publicKey),
  };
}

export async function deposit(ctx: AppContext, params: DepositParams): Promise<TxResult> {
  const { contractAddress, keyPairs, domainSep, amount } = params;
  logger.info(`Depositing ${amount} to vault ${contractAddress}...`);

  const providers = buildProviders<VaultContract>(ctx, './vault/out');

  const privateStateId = crypto.randomBytes(32).toString('hex');
  const publicKeys = keyPairs.map((kp) => kp.publicKey);
  await providers.privateStateProvider.set(privateStateId, createPrivateState(publicKeys));

  const mintNonce = await queryMintNonce(providers, contractAddress);
  logger.info(`Current mintNonce: ${mintNonce}`);

  const recipient = getRecipient(ctx);
  logger.info(`Recipient (coin public key): ${Buffer.from(recipient).toString('hex').slice(0, 16)}...`);

  const { message, domainSepBytes } = computeDepositMessage(recipient, mintNonce, amount, domainSep);
  logger.info(`Deposit message hash: ${message}`);

  const { signatures, challengeQuotients } = signDeposit(keyPairs, message);

  const result = await submitStatefulCallTxDirect<VaultContract, 'deposit'>(providers, {
    contractAddress,
    compiledContract: CompiledVaultContract,
    circuitId: 'deposit',
    privateStateId,
    args: [signatures, publicKeys, challengeQuotients, domainSepBytes, amount, recipient],
  });

  logger.info(`Deposit submitted in block ${result.public.blockHeight}`);
  return toTxResult(contractAddress, result.public);
}
