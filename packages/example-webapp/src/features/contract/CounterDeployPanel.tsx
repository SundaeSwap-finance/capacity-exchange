import { useState, useCallback } from 'react';
import { counterApi, CounterDeployResult, CounterQueryResult } from './contractApi';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';
import { useContractContextOptional } from './ContractContext';

type OperationStatus = 'idle' | 'running' | 'success' | 'error';

export function CounterDeployPanel() {
  const contractContext = useContractContextOptional();
  const [deployResult, setDeployResult] = useState<CounterDeployResult | null>(null);
  const [queryResult, setQueryResult] = useState<CounterQueryResult | null>(null);
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => prev + text);
  }, []);

  const handleDeploy = useCallback(async () => {
    setStatus('running');
    setCurrentOperation('Deploying');
    setError(null);
    setLogs('');
    setQueryResult(null);
    contractContext?.setIsDeploying(true);

    try {
      const response = await counterApi.deploy({
        onLog: (text) => appendLog(text),
      });

      if (response.success && response.data) {
        setStatus('success');
        setDeployResult(response.data);
        contractContext?.setCounterContractAddress(response.data.contractAddress);
      } else {
        setStatus('error');
        setError(response.error || 'Deploy failed');
      }
    } finally {
      setCurrentOperation(null);
      contractContext?.setIsDeploying(false);
    }
  }, [appendLog, contractContext]);

  const handleQuery = useCallback(async () => {
    if (!deployResult) return;

    setStatus('running');
    setCurrentOperation('Querying');
    setError(null);
    setLogs('');

    const response = await counterApi.query(deployResult.contractAddress, {
      onLog: (text) => appendLog(text),
    });

    if (response.success && response.data) {
      setStatus('success');
      setQueryResult(response.data);
    } else {
      setStatus('error');
      setError(response.error || 'Query failed');
    }
    setCurrentOperation(null);
  }, [deployResult, appendLog]);

  const isRunning = status === 'running';
  const isAnyDeploying = contractContext?.isDeploying ?? false;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Counter Contract</h4>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDeploy}
          disabled={isRunning || isAnyDeploying}
          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Deploy
        </button>

        <button
          type="button"
          onClick={handleQuery}
          disabled={isRunning || !deployResult}
          className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Query
        </button>
      </div>

      {isRunning && currentOperation && <LoadingSpinner message={`${currentOperation}...`} />}

      {deployResult && (
        <div className="p-2 bg-dark-800 rounded border border-dark-600 space-y-2">
          <div className="text-xs text-dark-400">Contract Address</div>
          <div className="text-xs text-white font-mono break-all">{deployResult.contractAddress}</div>
          <div className="border-t border-dark-700 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-dark-400">Counter Value</span>
            <span className="text-sm text-white font-mono">{queryResult?.round ?? '-'}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-900/20 border border-red-700 rounded">
          <div className="text-xs text-red-400">{error}</div>
        </div>
      )}

      {(logs || isRunning) && (
        <div className="space-y-1">
          <div className="text-xs text-dark-400">{isRunning ? 'Live Output:' : 'Output:'}</div>
          <pre className="p-2 bg-dark-900 rounded text-dark-300 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
            {logs || 'Waiting for output...'}
          </pre>
        </div>
      )}
    </div>
  );
}
