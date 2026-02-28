import type { UseUserDepositsResult } from '../hooks/useUserDeposits';
import { ActionButton } from './ActionButton';
import { BridgeCard } from './BridgeCard';
import { DepositsList } from './DepositsList';

interface DepositsSummaryProps {
  count: number;
  totalAdaStr: string;
}

function DepositsSummary({ count, totalAdaStr }: DepositsSummaryProps) {
  return (
    <p className="text-muted">
      {count} deposit{count !== 1 ? 's' : ''} · {totalAdaStr} ADA
    </p>
  );
}

interface DepositListProps {
  deposits: UseUserDepositsResult | undefined;
}

export function DepositList({ deposits }: DepositListProps) {
  if (!deposits) {
    return (
      <BridgeCard title="Deposits" description="View your deposits at the Bridge deposit address.">
        <p className="text-muted">Connect your Midnight wallet to view deposits.</p>
      </BridgeCard>
    );
  }

  const { deposits: depositList, totalAdaStr, fetchError, loading, refresh } = deposits;
  const confirmedCount = depositList.filter((d) => d.status === 'confirmed').length;
  const hasResult = depositList.length > 0 || (!fetchError && !loading);

  return (
    <BridgeCard title="Deposits" description="View your deposits at the Bridge deposit address.">
      <div className="space-y-4">
        <ActionButton label="Refresh" loadingLabel="Fetching…" loading={loading} onClick={refresh} />

        {fetchError && <div className="alert-error">{fetchError}</div>}

        {hasResult && !fetchError && (
          <>
            <DepositsSummary count={confirmedCount} totalAdaStr={totalAdaStr} />
            <DepositsList deposits={depositList} />
          </>
        )}
      </div>
    </BridgeCard>
  );
}
