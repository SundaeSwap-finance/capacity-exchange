import { useEffect, useMemo } from 'react';
import { setNetworkId as setMidnightNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { resolveNetworkConfig, NetworkConfigProvider, requireEnvOneOf } from './config';
import { useSeedWallet, useExtensionWallet } from './features/wallet';
import { useActiveWallet } from './features/wallet';
import { useContractsConfig } from './features/contract/hooks/useContractsConfig';
import { useWalletProviders } from './features/interactions/useWalletProviders';
import { useCesTransaction } from './features/ces/useCesTransaction';
import { useSponsoredTransaction } from './features/ces/useSponsoredTransaction';
import { useTutorialState } from './hooks/useTutorialState';
import { useSponsoredMint } from './hooks/useSponsoredMint';
import { useCounterValue } from './hooks/useCounterValue';
import { useDemoDebugLog } from './hooks/useDemoDebugLog';
import { useWalletStore } from './hooks/useWalletStore';
import { TutorialShell } from './components/TutorialShell';
import { PagePixelReveal } from './components/PagePixelReveal';
import { StepTransition } from './components/StepTransition';
import { WalletStep } from './steps/WalletStep';
import { SponsoredStep } from './steps/SponsoredStep';
import { PaidExchangeStep } from './steps/PaidExchangeStep';
import { PlaygroundStep } from './steps/PlaygroundStep';
import { DevAccessStep } from './steps/DevAccessStep';
import { useMockDemoState } from './mock/useMockDemoState';
import { getDemoRailContent } from './demoNarrative';
import type { NetworkConfig } from './config';
import type { SeedWalletState } from './features/wallet/seed/types';
import type { ExtensionWalletState } from './features/wallet/extension/useExtensionWallet';

function isMockDemoEnabled() {
  if (import.meta.env.VITE_MOCK_DEMO_MODE === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('mockDemo') === '1';
}

function App() {
  const mockDemoEnabled = isMockDemoEnabled();
  const networkId = requireEnvOneOf('VITE_NETWORK_ID', ['undeployed', 'preview', 'preprod', 'mainnet']);
  useEffect(() => {
    setMidnightNetworkId(networkId);
  }, [networkId]);

  const currentConfig = useMemo(() => resolveNetworkConfig(networkId), [networkId]);

  return (
    <NetworkConfigProvider config={currentConfig}>
      <PagePixelReveal />
      {mockDemoEnabled ? (
        <MockTutorialInner networkId={networkId} config={currentConfig} />
      ) : (
        <RealTutorialInner networkId={networkId} config={currentConfig} />
      )}
    </NetworkConfigProvider>
  );
}

interface TutorialInnerProps {
  networkId: string;
  config: NetworkConfig;
}

function RealTutorialInner({ networkId, config }: TutorialInnerProps) {
  const seedWallet = useSeedWallet(config);
  const extensionWallet = useExtensionWallet(networkId);

  return (
    <TutorialInner
      networkId={networkId}
      config={config}
      seedWallet={seedWallet}
      extensionWallet={extensionWallet}
      mockDemoEnabled={false}
    />
  );
}

function MockTutorialInner({ networkId, config }: TutorialInnerProps) {
  const mock = useMockDemoState(networkId, config);

  return (
    <TutorialInner
      networkId={networkId}
      config={config}
      seedWallet={mock.seedWallet}
      extensionWallet={mock.extensionWallet}
      mockDemoEnabled
      mockState={mock}
    />
  );
}

interface TutorialFlowProps extends TutorialInnerProps {
  seedWallet: SeedWalletState;
  extensionWallet: ExtensionWalletState;
  mockDemoEnabled: boolean;
  mockState?: ReturnType<typeof useMockDemoState>;
}

function TutorialInner({
  networkId,
  config,
  seedWallet,
  extensionWallet,
  mockDemoEnabled,
  mockState,
}: TutorialFlowProps) {
  const contractsConfig = useContractsConfig(networkId);
  const { createWallet } = useWalletStore();

  const walletMode =
    seedWallet.status === 'connected'
      ? ('seed' as const)
      : extensionWallet.status === 'connected'
        ? ('extension' as const)
        : null;

  const { wallet, walletConnection } = useActiveWallet(walletMode, seedWallet, extensionWallet);
  const { providers, walletInfo: realWalletInfo } = useWalletProviders(wallet, walletConnection);

  const counterAddress = contractsConfig.status === 'loaded' ? contractsConfig.config.counter.contractAddress : null;
  const _tokenMintAddress =
    contractsConfig.status === 'loaded' ? contractsConfig.config.tokenMint.contractAddress : null;
  const _mintedTokenColor =
    contractsConfig.status === 'loaded' ? contractsConfig.config.tokenMint.derivedTokenColor : null;

  const realSponsoredMint = useSponsoredMint(providers);
  const realCesTransaction = useCesTransaction(
    providers?.walletProvider ?? null,
    providers?.midnightProvider ?? null,
    providers?.balanceUnsealedTransaction ?? null,
    providers?.balanceSealedTransaction ?? null,
    counterAddress
  );
  const realSponsoredTransaction = useSponsoredTransaction(providers, counterAddress);
  const realCounter = useCounterValue(counterAddress, config);

  const { state, advance, jumpTo, markMinted, markCesUsed } = useTutorialState();

  const activeContractsConfig =
    mockDemoEnabled && mockState
      ? mockState.contractsConfig
      : contractsConfig.status === 'loaded'
        ? contractsConfig.config
        : null;
  const activeWalletInfo = mockDemoEnabled && mockState ? mockState.walletInfo : realWalletInfo;
  const activeWalletData =
    mockDemoEnabled && mockState
      ? mockState.walletData
      : activeWalletInfo.status === 'ready'
        ? activeWalletInfo.data
        : null;
  const activeSponsoredMint = mockDemoEnabled && mockState ? mockState.sponsoredMint : realSponsoredMint;
  const activeCesTransaction = mockDemoEnabled && mockState ? mockState.cesTransaction : realCesTransaction;
  const activeSponsoredTransaction =
    mockDemoEnabled && mockState ? mockState.sponsoredTransaction : realSponsoredTransaction;
  const activeCounterValue = mockDemoEnabled && mockState ? mockState.counterValue : realCounter.value;
  const totalShieldedBalance = activeWalletData
    ? Object.values(activeWalletData.shieldedBalances).reduce((sum, value) => sum + value, 0n)
    : 0n;

  useEffect(() => {
    if (activeSponsoredMint.status === 'success' && state.step === 1 && state.substep === 'b') {
      markMinted();
    }
  }, [activeSponsoredMint.status, markMinted, state.step, state.substep]);

  useEffect(() => {
    if (activeCesTransaction.status === 'success' && state.step === 2 && state.substep === 'b') {
      markCesUsed();
    }
  }, [activeCesTransaction.status, markCesUsed, state.step, state.substep]);

  useEffect(() => {
    if (
      mockDemoEnabled ||
      (activeCesTransaction.status !== 'success' && activeSponsoredTransaction.status !== 'success')
    ) {
      return;
    }

    realCounter.refresh();
  }, [activeCesTransaction.status, activeSponsoredTransaction.status, mockDemoEnabled, realCounter]);

  const isWalletConnected =
    mockDemoEnabled && mockState
      ? mockState.isWalletConnected
      : seedWallet.status === 'connected' || extensionWallet.status === 'connected';
  const isWalletConnecting =
    mockDemoEnabled && mockState
      ? mockState.isWalletConnecting
      : seedWallet.status === 'connecting' || extensionWallet.status === 'connecting';
  const sidebarContent = useMemo(() => getDemoRailContent(state.step), [state.step]);

  const debugEntries = useDemoDebugLog({
    step: state.step,
    substep: state.substep,
    networkId,
    modeLabel: mockDemoEnabled ? 'MOCK' : 'DEMO',
    walletConnecting: isWalletConnecting,
    walletConnected: isWalletConnected,
    walletInfoState: activeWalletInfo,
    sponsoredMintStatus: activeSponsoredMint.status,
    sponsoredMintError: activeSponsoredMint.error,
    cesStatus: activeCesTransaction.status,
    cesError: activeCesTransaction.error,
    currencySelection: activeCesTransaction.currencySelection,
    offerConfirmation: null,
    sponsoredTransactionStatus: activeSponsoredTransaction.status,
    sponsoredTransactionError: activeSponsoredTransaction.error,
    tokenBalance: totalShieldedBalance,
    counterValue: activeCounterValue,
    pendingLogEvents: mockState?.pendingLogEvents,
    consumeLogEvents: mockState?.consumeLogEvents,
  });

  const handleWalletConnect = async () => {
    if (isWalletConnected || isWalletConnecting) {
      return;
    }

    if (extensionWallet.status !== 'unavailable') {
      extensionWallet.connect();
      return;
    }

    const { secrets } = await createWallet();
    seedWallet.connect(secrets.seedHex, { isNewWallet: true });
  };

  return (
    <TutorialShell
      currentStep={state.step}
      completedSteps={state.completedSteps}
      walletConnected={isWalletConnected}
      walletConnecting={isWalletConnecting}
      onWalletConnect={handleWalletConnect}
      onStepClick={jumpTo}
      modeLabel={mockDemoEnabled ? 'MOCK' : 'DEMO'}
      sidebarContent={sidebarContent}
      debugEntries={debugEntries}
    >
      <StepTransition animKey={state.animKey} direction={state.direction}>
        {state.step === 0 && (
          <WalletStep
            seedWallet={seedWallet}
            extensionWallet={extensionWallet}
            walletInfoState={activeWalletInfo}
            onConnected={state.hasMintedTokens && state.hasUsedCes ? () => jumpTo(3, 'b') : advance}
          />
        )}

        {state.step === 1 && (
          <SponsoredStep
            walletData={activeWalletData}
            sponsoredMint={activeSponsoredMint}
            tokenMintAddress={activeContractsConfig?.tokenMint.contractAddress ?? null}
            mintedTokenColor={activeContractsConfig?.tokenMint.derivedTokenColor ?? null}
            allowMockMintWithoutContractAddress={mockDemoEnabled}
            autoAdvanceOnSuccess={false}
            successAutoAdvanceDelayMs={mockDemoEnabled ? 2200 : 900}
            onMintSuccess={advance}
            hasGraduated={state.hasUsedCes}
            onSkipToPlayground={() => jumpTo(3, 'b')}
          />
        )}

        {state.step === 2 && (
          <PaidExchangeStep
            walletData={activeWalletData}
            cesTransaction={activeCesTransaction}
            counterValue={activeCounterValue}
            mintedTokenColor={activeContractsConfig?.tokenMint.derivedTokenColor ?? null}
            onCesSuccess={advance}
            hasGraduated={state.hasUsedCes}
            onSkipToPlayground={() => jumpTo(3, 'b')}
          />
        )}

        {state.step === 3 && state.substep === 'a' && <DevAccessStep onContinue={advance} />}

        {state.step === 3 && state.substep === 'b' && activeContractsConfig && (
          <PlaygroundStep
            walletData={activeWalletData}
            sponsoredMint={activeSponsoredMint}
            cesTransaction={activeCesTransaction}
            sponsoredTransaction={activeSponsoredTransaction}
            tokenMintAddress={activeContractsConfig.tokenMint.contractAddress}
            mintedTokenColor={activeContractsConfig.tokenMint.derivedTokenColor}
            counterValue={activeCounterValue}
            allowMockMintWithoutContractAddress={mockDemoEnabled}
          />
        )}
      </StepTransition>
    </TutorialShell>
  );
}

export default App;
