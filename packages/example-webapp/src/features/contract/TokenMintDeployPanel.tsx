import { useState, useCallback, useMemo } from 'react';
import { tokenMintApi, TokenMintDeployResult } from './contractApi';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';
import { useContractContextOptional } from './ContractContext';
import { deriveTokenColor } from './deriveTokenColor';

type OperationStatus = 'idle' | 'running' | 'success' | 'error';

export function TokenMintDeployPanel() {
  const contractContext = useContractContextOptional();
  const [deployResult, setDeployResult] = useState<TokenMintDeployResult | null>(null);
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
    contractContext?.setIsDeploying(true);

    try {
      const response = await tokenMintApi.deploy(undefined, {
        onLog: (text) => appendLog(text),
      });

      if (response.success && response.data) {
        setStatus('success');
        setDeployResult(response.data);
        const derived = deriveTokenColor(response.data.tokenColor, response.data.contractAddress);
        contractContext?.setTokenMintContract({
          contractAddress: response.data.contractAddress,
          tokenColor: response.data.tokenColor,
          derivedTokenColor: derived,
          privateStateId: response.data.privateStateId,
        });
      } else {
        setStatus('error');
        setError(response.error || 'Deploy failed');
      }
    } finally {
      setCurrentOperation(null);
      contractContext?.setIsDeploying(false);
    }
  }, [appendLog, contractContext]);

  const isRunning = status === 'running';
  const isAnyDeploying = contractContext?.isDeploying ?? false;

  const derivedTokenColor = useMemo(() => {
    if (!deployResult) return null;
    return deriveTokenColor(deployResult.tokenColor, deployResult.contractAddress);
  }, [deployResult]);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Token Mint Contract</h4>

      <button
        type="button"
        onClick={handleDeploy}
        disabled={isRunning || isAnyDeploying}
        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        Deploy
      </button>

      {isRunning && currentOperation && <LoadingSpinner message={`${currentOperation}...`} />}

      {deployResult && (
        <div className="p-2 bg-dark-800 rounded border border-dark-600 space-y-2 text-xs">
          <div>
            <div className="text-dark-400">Contract Address</div>
            <div className="text-white font-mono break-all">{deployResult.contractAddress}</div>
          </div>
          <div>
            <div className="text-dark-400">Token Color (base)</div>
            <div className="text-white font-mono break-all">{deployResult.tokenColor}</div>
          </div>
          {derivedTokenColor && (
            <div>
              <div className="text-dark-400">Derived Token Color <span className="text-yellow-500">(use for CES)</span></div>
              <div className="text-white font-mono break-all">{derivedTokenColor}</div>
            </div>
          )}
          <div>
            <div className="text-dark-400">Private State ID</div>
            <div className="text-white font-mono break-all">{deployResult.privateStateId}</div>
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
