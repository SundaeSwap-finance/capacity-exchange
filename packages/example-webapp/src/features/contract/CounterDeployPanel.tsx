import { useState, useCallback } from 'react';
import { counterApi, type CounterDeployResult, type CounterQueryResult } from './api';
import { useContractContext } from './ContractContext';
import { useContractOperation } from './hooks/useContractOperation';
import { DeployButton, DeployResultBox } from './DeployComponents';
import { LogOutput } from './components/LogOutput';
import { LabelValue, LoadingSpinner, Message } from '../../shared/ui';
import { Button } from '../../shared/ui/Button';

export function CounterDeployPanel({ networkId }: { networkId: string }) {
  const contractContext = useContractContext();
  const [deployResult, setDeployResult] = useState<CounterDeployResult | null>(null);
  const [queryResult, setQueryResult] = useState<CounterQueryResult | null>(null);
  const [state, { runOperation }] = useContractOperation();

  const handleDeploy = useCallback(async () => {
    setQueryResult(null);
    contractContext.setIsDeploying(true);
    try {
      await runOperation(
        'Deploying',
        (cb) => counterApi.deploy(networkId, cb),
        (data) => {
          setDeployResult(data);
          contractContext.setCounterContract({ contractAddress: data.contractAddress });
        }
      );
    } finally {
      contractContext.setIsDeploying(false);
    }
  }, [networkId, contractContext, runOperation]);

  const handleQuery = useCallback(async () => {
    if (!deployResult) {
      return;
    }

    await runOperation(
      'Querying',
      (cb) => counterApi.query(networkId, deployResult.contractAddress, cb),
      setQueryResult
    );
  }, [networkId, deployResult, runOperation]);

  const isAnyDeploying = contractContext.isDeploying;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Counter Contract</h4>

      <div className="flex flex-wrap gap-2">
        <DeployButton onClick={handleDeploy} disabled={state.isRunning || isAnyDeploying} />

        <Button variant="purple" size="sm" onClick={handleQuery} disabled={state.isRunning || !deployResult}>
          Query
        </Button>
      </div>

      {state.isRunning && state.currentOperation && <LoadingSpinner message={`${state.currentOperation}...`} />}

      {deployResult && (
        <DeployResultBox>
          <LabelValue label="Contract Address">{deployResult.contractAddress}</LabelValue>
          <div className="border-t border-dark-700 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-dark-400">Counter Value</span>
            <span className="text-sm text-white font-mono">{queryResult?.round ?? '-'}</span>
          </div>
        </DeployResultBox>
      )}

      {state.error && <Message variant="error">{state.error}</Message>}

      <LogOutput logs={state.logs} isRunning={state.isRunning} />
    </div>
  );
}
