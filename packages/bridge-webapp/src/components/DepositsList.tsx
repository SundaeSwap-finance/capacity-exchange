import type { PendingDeposit, ValidDeposit } from '../lib/deposits';
import { DepositRow } from './DepositRow';

interface DepositsListProps {
  pending: PendingDeposit[];
  confirmed: ValidDeposit[];
}

export function DepositsList({ pending, confirmed }: DepositsListProps) {
  if (pending.length === 0 && confirmed.length === 0) {return null;}

  return (
    <ul className="space-y-2">
      {pending.map((d) => (
        <DepositRow
          key={d.txHash}
          txHash={d.txHash}
          lovelace={d.lovelace}
          coinPublicKey={d.coinPublicKey}
          pending
        />
      ))}
      {confirmed.map((u) => (
        <DepositRow
          key={`${u.txHash}#${u.index}`}
          txHash={u.txHash}
          index={u.index}
          lovelace={u.lovelace}
          coinPublicKey={u.datum.decoded.coinPublicKey}
        />
      ))}
    </ul>
  );
}
