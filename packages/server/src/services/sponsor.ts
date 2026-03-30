import { FastifyBaseLogger } from 'fastify';
import {
  ContractCall,
  type ContractAction,
  type FinalizedTransaction,
  type Proofish,
  type Signaturish,
  type Bindingish,
  type Transaction,
  Intent,
} from '@midnight-ntwrk/ledger-v8';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { getLedgerParameters } from '@capacity-exchange/midnight-core';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import { MetricsService } from './metrics.js';
import type { SponsoredContract } from '../config/prices.js';

const FEE_MARGIN_BLOCKS = 2;

export type SponsorTxResult =
  | { status: 'ok'; tx: FinalizedTransaction }
  | { status: 'ineligible' }
  | WalletUnavailableResult;

export class SponsorService {
  private readonly utxoService: UtxoService;
  private readonly txService: TxService;
  private readonly metricsService: MetricsService;
  private readonly sponsorAll: boolean;
  private readonly sponsoredContracts: SponsoredContract[];
  private readonly indexerUrl: string;
  private readonly logger: FastifyBaseLogger;

  constructor(
    utxoService: UtxoService,
    txService: TxService,
    metricsService: MetricsService,
    sponsorAll: boolean,
    sponsoredContracts: SponsoredContract[],
    indexerUrl: string,
    logger: FastifyBaseLogger,
  ) {
    this.utxoService = utxoService;
    this.txService = txService;
    this.metricsService = metricsService;
    this.sponsorAll = sponsorAll;
    this.sponsoredContracts = sponsoredContracts;
    this.indexerUrl = indexerUrl;
    this.logger = logger;
  }

  async sponsorTx(userTx: UnboundTransaction): Promise<SponsorTxResult> {
    if (!this.isEligible(userTx)) {
      return { status: 'ineligible' };
    }

    const ledgerParams = await getLedgerParameters(this.indexerUrl);
    const estimatedSpecks = userTx.feesWithMargin(ledgerParams, FEE_MARGIN_BLOCKS);
    this.logger.debug(
      { estimatedSpecks: estimatedSpecks.toString() },
      'Estimated dust cost for sponsored tx',
    );

    const lockResult = this.utxoService.lockUtxo(estimatedSpecks);
    if (lockResult.status !== 'ok') {
      return lockResult;
    }

    const { spend, expiresAtMillis } = lockResult.value;
    const ttl = new Date(expiresAtMillis);

    const dustTx = await this.txService.createDustOnlyTx(spend, ttl);
    this.logger.debug('Dust-only tx proven');

    const mergedTx = dustTx.merge(userTx);
    const boundTx = mergedTx.bind();

    this.logger.debug('Merged and bound dust tx with user tx');

    this.metricsService.recordDustUsage(estimatedSpecks);

    return { status: 'ok', tx: boundTx };
  }

  /**
   * A transaction is eligible for sponsorship IFF:
   * 1. sponsorAll is true, OR
   * 2. It has at least one intent, every intent has at least one contract action,
   *    and every contract action is a ContractCall to a sponsored contract/circuit
   */
  private isEligible<S extends Signaturish, P extends Proofish, B extends Bindingish>(
    tx: Transaction<S, P, B>,
  ): boolean {
    if (this.sponsorAll) {
      return true;
    }

    const intents = tx.intents;
    if (!intents || intents.size === 0) {
      return false;
    }

    return Array.from(intents.values()).every((intent) => this.isIntentEligible(intent));
  }

  private isIntentEligible<S extends Signaturish, P extends Proofish, B extends Bindingish>(
    intent: Intent<S, P, B>,
  ): boolean {
    if (intent.actions.length === 0) {
      return false;
    }
    return intent.actions.every((action) => this.isActionEligible(action));
  }

  private isActionEligible(action: ContractAction<Proofish>): boolean {
    if (!(action instanceof ContractCall)) {
      return false;
    }

    const entryPoint =
      action.entryPoint instanceof Uint8Array
        ? new TextDecoder().decode(action.entryPoint)
        : action.entryPoint;

    return this.sponsoredContracts.some((sc) => {
      if (sc.contractAddress !== action.address) {
        return false;
      }
      if (sc.circuits.type === 'all') {
        return true;
      }
      if (sc.circuits.type === 'subset') {
        return sc.circuits.circuitNames.includes(entryPoint);
      }

      // This ensures that if we modify the circuits schema, we have a compile time error

      const _exhaustive: never = sc.circuits;

      return false;
    });
  }
}
