import type { Deposit } from '../lib/deposits';
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
          key={d.index != null ? `${d.txHash}#${String(d.index)}` : d.txHash}
          txHash={d.txHash}
          index={d.index}
          lovelace={d.lovelace}
          coinPublicKey={d.coinPublicKey}
          unconfirmed={d.status === 'unconfirmed'}
          submittedAt={d.submittedAt}
        />
      ))}
    </ul>
  );
}
