import { useState, useCallback, useRef } from 'react';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletState<T> {
  status: WalletStatus;
  data: T | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet<T>(connectFn: () => Promise<T>): WalletState<T> {
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const connect = useCallback(async () => {
    const version = ++versionRef.current;
    setStatus('connecting');
    setData(null);
    setError(null);

    try {
      const result = await connectFn();
      if (version !== versionRef.current) {
        return;
      }
      setData(result);
      setStatus('connected');
    } catch (err) {
      if (version !== versionRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [connectFn]);

  const disconnect = useCallback(() => {
    versionRef.current++;
    setData(null);
    setError(null);
    setStatus('disconnected');
  }, []);

  return { status, data, error, connect, disconnect };
}
