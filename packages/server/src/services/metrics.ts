import { UtxoService } from './utxo.js';
import { WalletService } from './wallet.js';

interface DustEvent {
  specks: bigint;
  timestamp: number;
}

interface RevenueEntry {
  currency: string;
  amount: bigint;
  timestamp: number;
}

export interface DustUsageSnapshot {
  /** Total DUST balance available in the wallet. */
  availableBalance: string;
  totalSpecksConsumed: string;
  specksLastHour: string;
  locksLastHour: number;
}

export interface RevenueSnapshot {
  byCurrency: Record<string, string>;
}

export interface ContentionSnapshot {
  lockedUtxos: number;
  totalUtxos: number;
  lockedSpecks: string;
  ratio: number;
  averageRatioLastHour: number;
}

export interface BusinessMetrics {
  dustUsage: DustUsageSnapshot;
  revenue: RevenueSnapshot;
  contention: ContentionSnapshot;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export class MetricsService {
  private readonly utxoService: UtxoService;
  private readonly walletService: WalletService;

  private totalSpecksConsumed = 0n;
  private dustEvents: DustEvent[] = [];
  private revenueByCurrency = new Map<string, bigint>();
  private revenueEvents: RevenueEntry[] = [];
  private contentionSamples: { ratio: number; timestamp: number }[] = [];

  constructor(utxoService: UtxoService, walletService: WalletService) {
    this.utxoService = utxoService;
    this.walletService = walletService;
  }

  recordDustUsage(specks: bigint): void {
    this.totalSpecksConsumed += specks;
    this.dustEvents.push({ specks, timestamp: Date.now() });
  }

  recordRevenue(currency: string, amount: bigint): void {
    const current = this.revenueByCurrency.get(currency) ?? 0n;
    this.revenueByCurrency.set(currency, current + amount);
    this.revenueEvents.push({ currency, amount, timestamp: Date.now() });
  }

  getMetrics(): BusinessMetrics {
    return {
      dustUsage: this.getDustUsage(),
      revenue: this.getRevenue(),
      contention: this.getContention(),
    };
  }

  private getDustUsage(): DustUsageSnapshot {
    const cutoff = Date.now() - ONE_HOUR_MS;

    this.dustEvents = this.dustEvents.filter((e) => e.timestamp > cutoff);

    let specksLastHour = 0n;
    for (const e of this.dustEvents) {
      specksLastHour += e.specks;
    }

    const walletState = this.walletService.state;
    const availableBalance = walletState ? walletState.balance(new Date()).toString() : '0';

    return {
      availableBalance,
      totalSpecksConsumed: this.totalSpecksConsumed.toString(),
      specksLastHour: specksLastHour.toString(),
      locksLastHour: this.dustEvents.length,
    };
  }

  private getRevenue(): RevenueSnapshot {
    const byCurrency: Record<string, string> = {};
    for (const [currency, amount] of this.revenueByCurrency) {
      byCurrency[currency] = amount.toString();
    }
    return { byCurrency };
  }

  private getContention(): ContentionSnapshot {
    const locked = this.utxoService.getLockedUtxoStats();
    const totalUtxos = this.utxoService.getTotalUtxoCount();
    const ratio = totalUtxos > 0 ? locked.count / totalUtxos : 0;

    const now = Date.now();
    const cutoff = now - ONE_HOUR_MS;
    this.contentionSamples.push({ ratio, timestamp: now });
    this.contentionSamples = this.contentionSamples.filter((s) => s.timestamp > cutoff);

    const avgRatio =
      this.contentionSamples.length > 0
        ? this.contentionSamples.reduce((sum, s) => sum + s.ratio, 0) / this.contentionSamples.length
        : 0;

    return {
      lockedUtxos: locked.count,
      totalUtxos,
      lockedSpecks: locked.totalSpecks.toString(),
      ratio,
      averageRatioLastHour: avgRatio,
    };
  }
}
