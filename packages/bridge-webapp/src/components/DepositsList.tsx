import type { Deposit } from '../lib/depositStore';
import { DepositRow } from './DepositRow';

interface DepositsListProps {
  deposits: Deposit[];
}

export function DepositsList({ deposits }: DepositsListProps) {
  if (deposits.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {deposits.map((d) => (
        <DepositRow
          key={d.txHash}
          txHash={d.txHash}
          lovelace={d.lovelace}
          coinPublicKey={d.coinPublicKey}
          unconfirmed={d.status === 'unconfirmed'}
          submittedAt={d.submittedAt}
        />
      ))}
    </ul>
  );
}
