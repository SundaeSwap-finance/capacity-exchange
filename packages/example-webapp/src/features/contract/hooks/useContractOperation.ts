import { useState, useCallback } from 'react';
import type { ApiResult, StreamCallbacks } from '../api';

type OperationStatus = 'idle' | 'running' | 'success' | 'error';

export interface ContractOperationState {
  status: OperationStatus;
  currentOperation: string | null;
  error: string | null;
  logs: string;
  isRunning: boolean;
}

export interface ContractOperationActions {
  runOperation: <T>(
    name: string,
    operation: (callbacks: StreamCallbacks) => Promise<ApiResult<T>>,
    onSuccess?: (data: T) => void
  ) => Promise<void>;
  appendLog: (text: string) => void;
  clearLogs: () => void;
}

export function useContractOperation(): [ContractOperationState, ContractOperationActions] {
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => prev + text);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs('');
  }, []);

  const runOperation = useCallback(
    async <T>(
      name: string,
      operation: (callbacks: StreamCallbacks) => Promise<ApiResult<T>>,
      onSuccess?: (data: T) => void
    ) => {
      setStatus('running');
      setCurrentOperation(name);
      setError(null);
      setLogs('');

      const response = await operation({
        onLog: (text) => setLogs((prev) => prev + text),
      });

      if (response.success && response.data) {
        setStatus('success');
        onSuccess?.(response.data);
      } else {
        setStatus('error');
        setError(response.error || `${name} failed`);
      }
      setCurrentOperation(null);
    },
    []
  );

  const state: ContractOperationState = {
    status,
    currentOperation,
    error,
    logs,
    isRunning: status === 'running',
  };

  const actions: ContractOperationActions = {
    runOperation,
    appendLog,
    clearLogs,
  };

  return [state, actions];
}
