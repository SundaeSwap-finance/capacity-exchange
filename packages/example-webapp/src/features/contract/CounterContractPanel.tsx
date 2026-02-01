import { useState, useCallback } from 'react';
import { counterApi, CounterDeployResult, CounterQueryResult } from './contractApi';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';

type OperationStatus = 'idle' | 'running' | 'success' | 'error';

export function CounterContractPanel() {
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

    const response = await counterApi.deploy({
      onLog: (text) => appendLog(text),
    });

    if (response.success && response.data) {
      setStatus('success');
      setDeployResult(response.data);
    } else {
      setStatus('error');
      setError(response.error || 'Deploy failed');
    }
    setCurrentOperation(null);
  }, [appendLog]);

  const handleIncrement = useCallback(async () => {
    if (!deployResult) return;

    setStatus('running');
    setCurrentOperation('Incrementing');
    setError(null);
    setLogs('');

    const response = await counterApi.increment(deployResult.contractAddress, {
      onLog: (text) => appendLog(text),
    });

    if (response.success) {
      setStatus('success');
      // Auto-query after increment
      appendLog('\n--- Querying updated value ---\n');
      const queryResponse = await counterApi.query(deployResult.contractAddress, {
        onLog: (text) => appendLog(text),
      });
      if (queryResponse.success && queryResponse.data) {
        setQueryResult(queryResponse.data);
      }
    } else {
      setStatus('error');
      setError(response.error || 'Increment failed');
    }
    setCurrentOperation(null);
  }, [deployResult, appendLog]);

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

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-dark-200">Counter Contract</h4>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDeploy}
          disabled={isRunning}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Deploy
        </button>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={isRunning || !deployResult}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Increment
        </button>

        <button
          type="button"
          onClick={handleQuery}
          disabled={isRunning || !deployResult}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Query
        </button>
      </div>

      {/* Status indicator */}
      {isRunning && currentOperation && (
        <LoadingSpinner message={`${currentOperation}...`} />
      )}

      {/* Contract Info */}
      {deployResult && (
        <div className="p-3 bg-dark-800 rounded border border-dark-600 space-y-2">
          <div className="text-xs text-dark-400">Contract Address</div>
          <div className="text-sm text-white font-mono break-all">{deployResult.contractAddress}</div>
          <div className="border-t border-dark-700 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-dark-400">Counter Value</span>
            <span className="text-lg text-white font-mono">{queryResult?.round ?? '-'}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded">
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* Live Logs */}
      {(logs || isRunning) && (
        <div className="space-y-1">
          <div className="text-xs text-dark-400">
            {isRunning ? 'Live Output:' : 'Output:'}
          </div>
          <pre className="p-2 bg-dark-900 rounded text-dark-300 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
            {logs || 'Waiting for output...'}
          </pre>
        </div>
      )}
    </div>
  );
}
