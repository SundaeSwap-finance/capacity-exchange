// TODO: Wire this into the UI once we migrate off the SSE/CLI backend.
// This calls the contract directly from the browser, replacing the
// server/scriptRunner to contracts/cli/mint.ts roundtrip.
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { BrowserProviders } from './createBrowserProviders';
import { buildContractProviders } from './contractProviders';
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
}

type TokenMintContract = TokenMint.Contract<CircuitPrivateState>;

const witnesses: TokenMint.Witnesses<CircuitPrivateState> = {
  local_secret_key: ({ privateState }) => [privateState, privateState.secret_key],
};

const compiledTokenMintContract = CompiledContract.make<TokenMintContract>('TokenMint', TokenMint.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/midnight/token-mint')
);

function createPrivateState(): CircuitPrivateState {
  const secretKey = new Uint8Array(32);
  crypto.getRandomValues(secretKey);
  return { secret_key: secretKey };
}

function generatePrivateStateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function findAndMintTokens(
  providers: BrowserProviders,
  contractAddress: string,
  amount: bigint,
  config: NetworkConfig
): Promise<void> {
  const { contractProviders } = buildContractProviders<TokenMintCircuitId>(
    providers,
    providers.walletProvider,
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

  await submitCallTx(contractProviders, {
    compiledContract: compiledTokenMintContract,
    contractAddress,
    circuitId: 'mint_test_tokens',
    args: [amount],
    privateStateId,
  });
}
