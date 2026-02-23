import type { PendingDeposit } from '../lib/deposits';
import { useDeposits } from '../hooks/useDeposits';
import { usePendingDeposits } from '../hooks/usePendingDeposits';
import { useFilteredDeposits } from '../hooks/useFilteredDeposits';
import { BridgeCard } from './BridgeCard';
import { FormField } from './FormField';
import { DepositsList } from './DepositsList';

export type { PendingDeposit } from '../lib/deposits';

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

interface DepositsCardProps {
  pendingDeposits: PendingDeposit[];
  onDepositConfirmed: (txHash: string) => void;
  filterAddress: string;
  onFilterAddressChange: (value: string) => void;
}

export function DepositsCard({
  pendingDeposits,
  onDepositConfirmed,
  filterAddress,
  onFilterAddressChange,
}: DepositsCardProps) {
  const { result, error, loading, refresh } = useDeposits();
  usePendingDeposits({ pendingDeposits, utxos: result?.utxos ?? [], onDepositConfirmed, refresh });
  const { filtered, visiblePending, totalAdaStr, filterError } = useFilteredDeposits({
    utxos: result?.utxos ?? [],
    pendingDeposits,
    filterAddress,
  });

  return (
    <BridgeCard title="Deposits" description="View deposits at the bridge deposit address.">
      <div className="space-y-4">
        <FormField
          id="filter-midnight-address"
          label="Filter by Midnight address (optional)"
          value={filterAddress}
          onChange={onFilterAddressChange}
          placeholder="midnight1…"
        />

        <button type="button" className="btn-primary" onClick={refresh} disabled={loading}>
          {loading ? 'Fetching…' : 'Refresh'}
        </button>

        {filterError && <div className="alert-error">{filterError}</div>}
        {error && <div className="alert-error">{error}</div>}

        {result && !error && (
          <>
            <DepositsSummary count={filtered.length} totalAdaStr={totalAdaStr} />
            <DepositsList pending={visiblePending} confirmed={filtered} />
          </>
        )}
      </div>
    </BridgeCard>
  );
}
