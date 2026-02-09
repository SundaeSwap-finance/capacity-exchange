import { useState, useCallback } from 'react';
import { counterApi, type CounterQueryResult } from '../api';
import { useContractOperation } from '../hooks/useContractOperation';
import { Button } from '../../../shared/ui';
import type { CounterConfig } from '../hooks/useContractsConfig';
import { ContractPanel } from './ContractPanelUI';

interface CounterContractPanelProps {
  networkId: string;
  config: CounterConfig;
}

export function CounterContractPanel({ networkId, config }: CounterContractPanelProps) {
  const [queryResult, setQueryResult] = useState<CounterQueryResult | null>(null);
  const [state, { runOperation }] = useContractOperation();

  const handleIncrement = useCallback(async () => {
    await runOperation(
      'Incrementing',
      (callbacks) => counterApi.increment(networkId, config.contractAddress, callbacks),
      () => {}
    );
  }, [networkId, config, runOperation]);

  const handleQuery = useCallback(async () => {
    await runOperation(
      'Querying',
      (callbacks) => counterApi.query(networkId, config.contractAddress, callbacks),
      setQueryResult
    );
  }, [networkId, config, runOperation]);

  return (
    <ContractPanel
      title="Counter Contract"
      isRunning={state.isRunning}
      currentOperation={state.currentOperation}
      error={state.error}
      logs={state.logs}
      fields={[{ label: 'Contract Address', value: config.contractAddress }]}
      result={queryResult ? { label: 'Counter Value', value: queryResult.round } : null}
      queryRow={
        <Button onClick={handleQuery} disabled={state.isRunning} variant="purple" size="sm">
          Query
        </Button>
      }
      modifyRow={
        <Button onClick={handleIncrement} disabled={state.isRunning} variant="blue" size="sm">
          Increment
        </Button>
      }
    />
  );
}
