import { useState, useEffect } from 'react';
import { lovelaceToAda } from '@capacity-exchange/core';

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s ago`;
}

function ElapsedTime({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <>{formatElapsed(now - since)}</>;
}

interface DepositRowProps {
  txHash: string;
  lovelace: bigint;
  coinPublicKey: string;
  unconfirmed?: boolean;
  submittedAt: number;
}

export function DepositRow({ txHash, lovelace, coinPublicKey, unconfirmed, submittedAt }: DepositRowProps) {
  return (
    <li className={`card text-sm space-y-1${unconfirmed ? ' opacity-60 animate-pulse' : ''}`}>
      {unconfirmed && (
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner loading-xs" />
          <span className="text-muted">
            Waiting for confirmation… <ElapsedTime since={submittedAt} />
          </span>
        </div>
      )}
      <div className="break-all">
        <span className="text-muted">Tx:</span> {txHash}
      </div>
      <div>
        <span className="text-muted">ADA:</span> {lovelaceToAda(lovelace)}
      </div>
      <div className="break-all">
        <span className="text-muted">coinPublicKey:</span> {coinPublicKey}
      </div>
    </li>
  );
}
