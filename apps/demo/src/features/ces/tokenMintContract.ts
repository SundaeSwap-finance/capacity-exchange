import { findDeployedContract, createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js-types';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { buildMidnightProviders } from '@sundaeswap/capacity-exchange-core';
import type { NetworkConfig } from '../../config';
import * as TokenMint from '../../../contracts/token-mint/out/contract/index.js';

type TokenMintCircuitId =
  | 'mint_test_tokens'
  | 'own_balance'
  | 'total_held'
  | 'get_token_color'
  | 'first_deposit'
  | 'deposit'
  | 'withdraw';

interface CircuitPrivateState {
  secret_key: Uint8Array;
  admin_key: Uint8Array;
}

type TokenMintContract = TokenMint.Contract<CircuitPrivateState>;

const witnesses: TokenMint.Witnesses<CircuitPrivateState> = {
  local_secret_key: ({ privateState }) => [privateState, privateState.secret_key],
  admin_secret_key: ({ privateState }) => [privateState, privateState.admin_key],
};

const compiledTokenMintContract = CompiledContract.make<TokenMintContract>('TokenMint', TokenMint.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/midnight/token-mint')
);

function createPrivateState(): CircuitPrivateState {
  const secretKey = new Uint8Array(32);
  crypto.getRandomValues(secretKey);
  return { secret_key: secretKey, admin_key: new Uint8Array(32) };
}

function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function generatePrivateStateId(): string {
  return uint8ArrayToHex(generateRandomBytes(32));
}

export async function findAndMintTokens(
  midnightProvider: MidnightProvider,
  walletProvider: WalletProvider,
  contractAddress: string,
  amount: bigint,
  config: NetworkConfig
): Promise<void> {
  const contractProviders = buildMidnightProviders<TokenMintCircuitId>(
    walletProvider,
    midnightProvider,
    '/midnight/token-mint',
    config
  );

  const privateStateId = generatePrivateStateId();
  const initialPrivateState = createPrivateState();

  await findDeployedContract(contractProviders, {
    compiledContract: compiledTokenMintContract,
    contractAddress,
    privateStateId,
    initialPrivateState,
  });

  const callTxData = await createUnprovenCallTx(contractProviders, {
    compiledContract: compiledTokenMintContract,
    contractAddress,
    circuitId: 'mint_test_tokens' as const,
    args: [amount] as [bigint],
    privateStateId,
  });

  const provenTx = await contractProviders.proofProvider.proveTx(callTxData.private.unprovenTx);
  const balancedTx = await contractProviders.walletProvider.balanceTx(provenTx);
  const txId = await contractProviders.midnightProvider.submitTx(balancedTx);
  const result = await contractProviders.publicDataProvider.watchForTxData(txId);

  if (result.status !== SucceedEntirely) {
    throw new Error(`Mint transaction failed with status: ${result.status}`);
  }
}
