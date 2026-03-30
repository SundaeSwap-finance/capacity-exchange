import { useMemo, useEffect } from 'react';
import { setNetworkId as setMidnightNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { resolveNetworkConfig, NetworkConfigProvider, requireEnvOneOf } from './config';
import { useSeedWallet, useExtensionWallet, useActiveWallet } from './features/wallet';
import { useContractsConfig } from './features/contract/hooks/useContractsConfig';
import { useWalletProviders } from './features/interactions/useWalletProviders';
import { useCesTransaction } from './features/ces/useCesTransaction';
import { useSponsoredTransaction } from './features/ces/useSponsoredTransaction';
import { useTutorialState } from './hooks/useTutorialState';
import { useSponsoredMint } from './hooks/useSponsoredMint';
import { useCounterValue } from './hooks/useCounterValue';
import { TutorialShell } from './components/TutorialShell';
import { StepTransition } from './components/StepTransition';
import { WalletStep } from './steps/WalletStep';
import { SponsoredStep } from './steps/SponsoredStep';
import { PaidExchangeStep } from './steps/PaidExchangeStep';
import { PlaygroundStep } from './steps/PlaygroundStep';
import type { NetworkConfig } from './config';
import type { SeedWalletState } from './features/wallet/seed/types';
import type { ExtensionWalletState } from './features/wallet/extension/useExtensionWallet';

function App() {
  const networkId = requireEnvOneOf('VITE_NETWORK_ID', ['undeployed', 'preview', 'preprod']);
  useEffect(() => {
    setMidnightNetworkId(networkId);
  }, [networkId]);

  const currentConfig = useMemo(() => resolveNetworkConfig(networkId), [networkId]);
  const seedWallet = useSeedWallet(currentConfig);
  const extensionWallet = useExtensionWallet(networkId);

  return (
    <NetworkConfigProvider config={currentConfig}>
      <TutorialInner
        networkId={networkId}
        config={currentConfig}
        seedWallet={seedWallet}
        extensionWallet={extensionWallet}
      />
    </NetworkConfigProvider>
  );
}

interface TutorialInnerProps {
  networkId: string;
  config: NetworkConfig;
  seedWallet: SeedWalletState;
  extensionWallet: ExtensionWalletState;
}

function TutorialInner({ networkId, config, seedWallet, extensionWallet }: TutorialInnerProps) {
  const contractsConfig = useContractsConfig(networkId);

  const walletMode = seedWallet.status === 'connected'
    ? 'seed' as const
    : extensionWallet.status === 'connected'
      ? 'extension' as const
      : null;

  const { wallet, walletConnection } = useActiveWallet(walletMode, seedWallet, extensionWallet);
  const { providers, walletInfo } = useWalletProviders(wallet, walletConnection);

  const counterAddress = contractsConfig.status === 'loaded' ? contractsConfig.config.counter.contractAddress : null;
  const tokenMintAddress = contractsConfig.status === 'loaded' ? contractsConfig.config.tokenMint.contractAddress : null;
  const mintedTokenColor = contractsConfig.status === 'loaded' ? contractsConfig.config.tokenMint.derivedTokenColor : null;

  const sponsoredMint = useSponsoredMint(providers);
  const cesTransaction = useCesTransaction(
    providers?.walletProvider ?? null,
    providers?.midnightProvider ?? null,
    providers?.balanceSealedTx ?? null,
    counterAddress
  );
  const sponsoredTransaction = useSponsoredTransaction(providers, counterAddress);
  const counter = useCounterValue(counterAddress, config);

  const { state, advance, goBack, jumpTo, markMinted, markCesUsed } = useTutorialState();

  useEffect(() => {
    if (sponsoredMint.status === 'success' && state.step === 1 && state.substep === 'b') {
      markMinted();
    }
  }, [sponsoredMint.status, state.step, state.substep, markMinted]);

  useEffect(() => {
    if (cesTransaction.status === 'success' && state.step === 2 && state.substep === 'b') {
      markCesUsed();
    }
  }, [cesTransaction.status, state.step, state.substep, markCesUsed]);

  // Refresh counter after any counter-incrementing transaction succeeds
  useEffect(() => {
    if (cesTransaction.status === 'success' || sponsoredTransaction.status === 'success') {
      counter.refresh();
    }
  }, [cesTransaction.status, sponsoredTransaction.status, counter.refresh]);

  const walletData = walletInfo.status === 'ready' ? walletInfo.data : null;

  return (
    <TutorialShell
      currentStep={state.step}
      completedSteps={state.completedSteps}
      networkId={networkId}
      onStepClick={jumpTo}
    >
      <StepTransition animKey={state.animKey} direction={state.direction}>
        {state.step === 0 && (
          <WalletStep
            seedWallet={seedWallet}
            extensionWallet={extensionWallet}
            walletInfoState={walletInfo}
            onConnected={advance}
          />
        )}

        {state.step === 1 && (
          <SponsoredStep
            substep={state.substep}
            walletData={walletData}
            sponsoredMint={sponsoredMint}
            tokenMintAddress={tokenMintAddress}
            mintedTokenColor={mintedTokenColor}
            onAdvance={advance}
            onMintSuccess={advance}
          />
        )}

        {state.step === 2 && (
          <PaidExchangeStep
            substep={state.substep}
            walletData={walletData}
            cesTransaction={cesTransaction}
            counterValue={counter.value}
            onAdvance={advance}
            onCesSuccess={advance}
          />
        )}

        {state.step === 3 && (
          <PlaygroundStep
            walletData={walletData}
            sponsoredMint={sponsoredMint}
            cesTransaction={cesTransaction}
            sponsoredTransaction={sponsoredTransaction}
            tokenMintAddress={tokenMintAddress}
            counterAddress={counterAddress}
            counterValue={counter.value}
            config={config}
          />
        )}
      </StepTransition>
    </TutorialShell>
  );
}

export default App;
