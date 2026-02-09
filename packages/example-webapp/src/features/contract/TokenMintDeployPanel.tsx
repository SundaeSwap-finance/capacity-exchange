import { useState, useCallback } from 'react';
import { tokenMintApi, type TokenMintDeployResult } from './api';
import { useContractContext } from './ContractContext';
import { useContractOperation } from './hooks/useContractOperation';
import { DeployButton, DeployResultBox } from './DeployComponents';
import { LogOutput } from './components/LogOutput';
import { LabelValue, LoadingSpinner, Message } from '../../shared/ui';

export function TokenMintDeployPanel({ networkId }: { networkId: string }) {
  const contractContext = useContractContext();
  const [deployResult, setDeployResult] = useState<TokenMintDeployResult | null>(null);
  const [state, { runOperation }] = useContractOperation();

  const handleDeploy = useCallback(async () => {
    contractContext.setIsDeploying(true);
    try {
      await runOperation(
        'Deploying',
        (cb) => tokenMintApi.deploy(networkId, cb),
        (data) => {
          setDeployResult(data);
          contractContext.setTokenMintContract({
            contractAddress: data.contractAddress,
            tokenColor: data.tokenColor,
            derivedTokenColor: data.derivedTokenColor,
            privateStateId: data.privateStateId,
          });
        }
      );
    } finally {
      contractContext.setIsDeploying(false);
    }
  }, [networkId, contractContext, runOperation]);

  const isAnyDeploying = contractContext.isDeploying;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Token Mint Contract</h4>

      <DeployButton onClick={handleDeploy} disabled={state.isRunning || isAnyDeploying} />

      {state.isRunning && state.currentOperation && <LoadingSpinner message={`${state.currentOperation}...`} />}

      {deployResult && (
        <DeployResultBox>
          <LabelValue label="Contract Address">{deployResult.contractAddress}</LabelValue>
          <LabelValue label="Token Color (base)">{deployResult.tokenColor}</LabelValue>
          <LabelValue
            label={
              <>
                Derived Token Color <span className="text-yellow-500">(use for CES)</span>
              </>
            }
          >
            {deployResult.derivedTokenColor}
          </LabelValue>
          <LabelValue label="Private State ID">{deployResult.privateStateId}</LabelValue>
        </DeployResultBox>
      )}

      {state.error && <Message variant="error">{state.error}</Message>}

      <LogOutput logs={state.logs} isRunning={state.isRunning} />
    </div>
  );
}
