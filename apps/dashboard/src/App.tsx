import { useMetrics, type CapacityMetrics } from './useMetrics';

// Base units per whole unit of each capacity asset (specks per DUST, lovelace per ADA).
const BASE_UNITS: Record<string, bigint> = {
  DUST: 1_000_000_000_000_000n,
  ADA: 1_000_000n,
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) {
    parts.push(`${d}d`);
  }
  if (h) {
    parts.push(`${h}h`);
  }
  if (m) {
    parts.push(`${m}m`);
  }
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatAmount(asset: string, amount: string): string {
  const perUnit = BASE_UNITS[asset] ?? 1n;
  return `${(BigInt(amount) / perUnit).toLocaleString()} ${asset}`;
}

function formatContention(data: CapacityMetrics['contention']): string {
  return `${(data.ratio * 100).toFixed(1)}%`;
}

function formatRevenue(byCurrency: Record<string, string>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) {
    return '—';
  }
  return entries
    .map(([currency, amount]) => {
      const label = currency.length > 16 ? `${currency.slice(0, 8)}...${currency.slice(-6)}` : currency;
      return `${BigInt(amount).toLocaleString()} ${label}`;
    })
    .join(', ');
}

const statusColor: Record<string, string> = {
  ok: 'bg-green-500',
  syncing: 'bg-yellow-500',
  ko: 'bg-red-500',
};

export default function App() {
  const { data, error, secondsUntilRefresh } = useMetrics();

  const readiness = data?.readiness ?? 'unknown';
  const dotColor = error ? 'bg-red-500' : (statusColor[readiness] ?? 'bg-gray-500');
  const statusLabel = error ? 'disconnected' : data ? readiness : 'connecting';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">
          Capacity <span className="text-indigo-400">Exchange</span>
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{data?.networks.join(', ') || '—'}</span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
            {statusLabel}
            {data && <span className="text-gray-600 tabular-nums">({secondsUntilRefresh}s)</span>}
          </span>
        </div>
      </header>

      <main className="px-12 py-6">
        <Section title="Server">
          <Card label="Uptime" value={data ? formatUptime(data.server.uptime) : '—'} />
          <Card label="Readiness" value={readiness} />
        </Section>

        {data?.capacity.map((capacity) => (
          <CapacitySections key={capacity.asset} capacity={capacity} />
        ))}

        <Section title="Revenue">
          <Card label="Total" value={data ? formatRevenue(data.revenue.byCurrency) : '—'} />
        </Section>
      </main>
    </div>
  );
}

function CapacitySections({ capacity }: { capacity: CapacityMetrics }) {
  const { asset, contention } = capacity;
  return (
    <>
      <Section title={`${asset} Usage`}>
        <Card label="Available Balance" value={formatAmount(asset, capacity.available)} />
        <Card label="Total Consumed" value={formatAmount(asset, capacity.consumedTotal)} />
        <Card label="Last Hour" value={formatAmount(asset, capacity.consumedLastHour)} />
        <Card label="Locks (Last Hour)" value={capacity.locksLastHour.toString()} />
      </Section>

      <Section title={`${asset} Contention`}>
        <Card label="Locked / Total UTxOs" value={`${contention.lockedUtxos} / ${contention.totalUtxos}`} />
        <Card label="Locked Amount" value={formatAmount(asset, contention.lockedAmount)} />
        <Card label="Contention Ratio" value={formatContention(contention)} />
        <Card label="Avg Contention (1h)" value={`${(contention.averageRatioLastHour * 100).toFixed(1)}%`} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Card({ label, value, placeholder }: { label: string; value?: string; placeholder?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 overflow-hidden">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      {placeholder ? (
        <div className="flex h-10 items-center text-sm italic text-gray-600">coming soon</div>
      ) : (
        <div className="text-2xl font-bold tabular-nums text-white break-all">{value}</div>
      )}
    </div>
  );
}
