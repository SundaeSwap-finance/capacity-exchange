import { useState, useCallback } from 'react';
import { tokenMintApi, type TokenMintVerifyResult } from '../api';
import { useContractOperation } from '../hooks/useContractOperation';
import { Button } from '../../../shared/ui';
import type { TokenMintConfig } from '../hooks/useContractsConfig';
import { ContractPanel } from './ContractPanelUI';

interface TokenMintContractPanelProps {
  networkId: string;
  config: TokenMintConfig;
}

export function TokenMintContractPanel({ networkId, config }: TokenMintContractPanelProps) {
  const [verifyResult, setVerifyResult] = useState<TokenMintVerifyResult | null>(null);
  const [mintAmount, setMintAmount] = useState(1000);
  const [state, { runOperation }] = useContractOperation();

  const handleMint = useCallback(async () => {
    if (mintAmount <= 0) {
      return;
    }

    await runOperation(
      'Minting',
      (callbacks) => tokenMintApi.mint(networkId, config.contractAddress, config.privateStateId, mintAmount, callbacks),
      () => {}
    );
  }, [networkId, config, mintAmount, runOperation]);

  const handleVerify = useCallback(async () => {
    await runOperation(
      'Verifying',
      (callbacks) => tokenMintApi.verify(networkId, config.contractAddress, config.tokenColor, callbacks),
      setVerifyResult
    );
  }, [networkId, config, runOperation]);

  return (
    <ContractPanel
      title="Token Mint Contract"
      isRunning={state.isRunning}
      currentOperation={state.currentOperation}
      error={state.error}
      logs={state.logs}
      fields={[
        { label: 'Contract Address', value: config.contractAddress },
        { label: 'Token Color', value: config.tokenColor },
      ]}
      result={verifyResult ? { label: 'Server Wallet Balance', value: verifyResult.balance } : null}
      actions={
        <>
          <input
            type="number"
            value={mintAmount}
            onChange={(e) => setMintAmount(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            disabled={state.isRunning}
            className="w-24 px-2 py-2 bg-dark-800 border border-dark-600 rounded text-white text-sm disabled:opacity-50"
          />
          <Button onClick={handleMint} disabled={state.isRunning || mintAmount <= 0} variant="blue">
            Mint
          </Button>
          <Button onClick={handleVerify} disabled={state.isRunning} variant="purple">
            Verify Balance
          </Button>
        </>
      }
    />
  );
}
