import type { UseUserDepositsResult } from '../hooks/useUserDeposits';
import { BridgeCard } from './BridgeCard';
import { DepositsList } from './DepositsList';

interface DepositListProps {
  deposits: UseUserDepositsResult | undefined;
}

export function DepositList({ deposits }: DepositListProps) {
  const { deposits: depositList, loading } = deposits ?? { deposits: [], loading: false };

  return (
    <BridgeCard title="Recent Deposit Transactions" description="Showing deposits made from this browser.">
      <div className="space-y-4">
        {!deposits && <p className="text-muted">Connect your Midnight wallet to view deposits.</p>}

        {loading && <p className="text-muted text-sm">Checking confirmations…</p>}

        {deposits && depositList.length === 0 && !loading && <p className="text-muted">No deposits yet.</p>}

        <DepositsList deposits={depositList} />
      </div>
    </BridgeCard>
  );
}
