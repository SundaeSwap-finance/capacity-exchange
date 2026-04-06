import { useState, useCallback } from 'react';
import { getCounterValue, type GetCounterValueResult } from '../../ces/counterContract';
import { useSubmit } from '../../../lib/hooks/useSubmit';
import { useNetworkConfig } from '../../../config';
import { Button } from '../../../shared/ui';
import type { CounterConfig } from '../hooks/useContractsConfig';
import { ContractPanel } from './ContractPanelUI';

interface CounterContractPanelProps {
  config: CounterConfig;
}

export function CounterContractPanel({ config }: CounterContractPanelProps) {
  const networkConfig = useNetworkConfig();
  const [queryResult, setQueryResult] = useState<GetCounterValueResult | null>(null);
  const { run, state } = useSubmit();

  const handleQuery = useCallback(async () => {
    await run('Querying', () => getCounterValue(config.contractAddress, networkConfig), setQueryResult);
  }, [config, networkConfig, run]);

  return (
    <ContractPanel
      title="Counter Contract"
      isRunning={state.submitting}
      currentOperation={state.label}
      error={state.error}
      fields={[{ label: 'Contract Address', value: config.contractAddress }]}
      result={queryResult ? { label: 'Counter Value', value: queryResult.round } : null}
      queryRow={
        <Button onClick={handleQuery} disabled={state.submitting} variant="purple" size="sm">
          Query
        </Button>
      }
    />
  );
}
