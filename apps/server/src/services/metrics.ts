import { meterService } from '../meter.js';
import { CAPACITY_ASSETS, type CapacityAsset } from '../config/prices.js';

/** Where a chain's sellable capacity lives, as the metrics see it. Amounts are in the asset's base unit. */
export interface CapacitySource {
  available(): bigint;
  lockedUtxos(): { count: number; amount: bigint };
  totalUtxos(): number;
}

interface UsageEvent {
  amount: bigint;
  timestamp: number;
}

interface RevenueEntry {
  currency: string;
  amount: bigint;
  timestamp: number;
}

export interface ContentionSnapshot {
  lockedUtxos: number;
  totalUtxos: number;
  lockedAmount: string;
  ratio: number;
  averageRatioLastHour: number;
}

export interface CapacitySnapshot {
  asset: CapacityAsset;
  available: string;
  consumedTotal: string;
  consumedLastHour: string;
  locksLastHour: number;
  contention: ContentionSnapshot;
}

export interface RevenueSnapshot {
  byCurrency: Record<string, string>;
}

export interface BusinessMetrics {
  capacity: CapacitySnapshot[];
  revenue: RevenueSnapshot;
}

interface AssetState {
  source: CapacitySource;
  consumedTotal: bigint;
  usageEvents: UsageEvent[];
  contentionSamples: { ratio: number; timestamp: number }[];
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export class MetricsService {
  private readonly assets = new Map<CapacityAsset, AssetState>();
  private revenueByCurrency = new Map<string, bigint>();
  private revenueEvents: RevenueEntry[] = [];

  constructor(sources: Partial<Record<CapacityAsset, CapacitySource>>) {
    for (const asset of CAPACITY_ASSETS) {
      const source = sources[asset];
      if (!source) {
        continue;
      }
      this.assets.set(asset, { source, consumedTotal: 0n, usageEvents: [], contentionSamples: [] });

      const attributes = { asset };
      meterService.gauge(
        'ces.capacity.locked_utxos',
        'Currently locked UTXOs',
        () => source.lockedUtxos().count,
        attributes,
      );
      meterService.gauge(
        'ces.capacity.locked_amount',
        'Capacity locked in outstanding offers',
        () => Number(source.lockedUtxos().amount),
        attributes,
      );
      meterService.gauge(
        'ces.capacity.total_utxos',
        'Total available UTXOs',
        () => source.totalUtxos(),
        attributes,
      );
      meterService.gauge(
        'ces.capacity.available_amount',
        'Total available capacity',
        () => Number(source.available()),
        attributes,
      );
    }
  }

  recordCapacityUsage(asset: CapacityAsset, amount: bigint): void {
    const state = this.assets.get(asset);
    if (!state) {
      return;
    }
    state.consumedTotal += amount;
    state.usageEvents.push({ amount, timestamp: Date.now() });
  }

  recordRevenue(currency: string, amount: bigint): void {
    const current = this.revenueByCurrency.get(currency) ?? 0n;
    this.revenueByCurrency.set(currency, current + amount);
    this.revenueEvents.push({ currency, amount, timestamp: Date.now() });
  }

  getMetrics(): BusinessMetrics {
    const capacity = [...this.assets].map(([asset, state]) => this.getCapacity(asset, state));
    return { capacity, revenue: this.getRevenue() };
  }

  private getCapacity(asset: CapacityAsset, state: AssetState): CapacitySnapshot {
    const cutoff = Date.now() - ONE_HOUR_MS;

    state.usageEvents = state.usageEvents.filter((e) => e.timestamp > cutoff);

    let consumedLastHour = 0n;
    for (const e of state.usageEvents) {
      consumedLastHour += e.amount;
    }

    return {
      asset,
      available: state.source.available().toString(),
      consumedTotal: state.consumedTotal.toString(),
      consumedLastHour: consumedLastHour.toString(),
      locksLastHour: state.usageEvents.length,
      contention: this.getContention(state),
    };
  }

  private getRevenue(): RevenueSnapshot {
    const byCurrency: Record<string, string> = {};
    for (const [currency, amount] of this.revenueByCurrency) {
      byCurrency[currency] = amount.toString();
    }
    return { byCurrency };
  }

  private getContention(state: AssetState): ContentionSnapshot {
    const locked = state.source.lockedUtxos();
    const totalUtxos = state.source.totalUtxos();
    const ratio = totalUtxos > 0 ? locked.count / totalUtxos : 0;

    const now = Date.now();
    const cutoff = now - ONE_HOUR_MS;
    state.contentionSamples.push({ ratio, timestamp: now });
    state.contentionSamples = state.contentionSamples.filter((s) => s.timestamp > cutoff);

    const avgRatio =
      state.contentionSamples.length > 0
        ? state.contentionSamples.reduce((sum, s) => sum + s.ratio, 0) /
          state.contentionSamples.length
        : 0;

    return {
      lockedUtxos: locked.count,
      totalUtxos,
      lockedAmount: locked.amount.toString(),
      ratio,
      averageRatioLastHour: avgRatio,
    };
  }
}
