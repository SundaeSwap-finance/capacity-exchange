import { lovelaceToAda } from '@capacity-exchange/core';

interface DepositRowProps {
  txHash: string;
  index?: bigint;
  lovelace: bigint;
  coinPublicKey: string;
  pending?: boolean;
}

export function DepositRow({ txHash, index, lovelace, coinPublicKey, pending }: DepositRowProps) {
  return (
    <li className={`card text-sm space-y-1${pending ? ' opacity-60 animate-pulse' : ''}`}>
      {pending && (
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner loading-xs" />
          <span className="text-muted">Waiting for confirmation…</span>
        </div>
      )}
      <div className="break-all">
        <span className="text-muted">Tx:</span> {txHash}
        {index != null && `#${String(index)}`}
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
