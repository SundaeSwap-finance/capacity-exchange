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
} from '@midnight-ntwrk/ledger-v7';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { getLedgerParameters } from '@capacity-exchange/midnight-core';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import type { FundedContract } from '../models/config.js';

const FEE_MARGIN_BLOCKS = 2;

export type FundTxResult =
  | { status: 'ok'; tx: FinalizedTransaction }
  | { status: 'ineligible' }
  | WalletUnavailableResult;

export class FundService {
  private readonly utxoService: UtxoService;
  private readonly txService: TxService;
  private readonly fundedContracts: FundedContract[];
  private readonly indexerUrl: string;
  private readonly logger: FastifyBaseLogger;

  constructor(
    utxoService: UtxoService,
    txService: TxService,
    fundedContracts: FundedContract[],
    indexerUrl: string,
    logger: FastifyBaseLogger,
  ) {
    this.utxoService = utxoService;
    this.txService = txService;
    this.fundedContracts = fundedContracts;
    this.indexerUrl = indexerUrl;
    this.logger = logger;
  }

  async fundTx(userTx: UnboundTransaction): Promise<FundTxResult> {
    if (!this.isEligible(userTx)) {
      return { status: 'ineligible' };
    }

    const ledgerParams = await getLedgerParameters(this.indexerUrl);
    const estimatedSpecks = userTx.feesWithMargin(ledgerParams, FEE_MARGIN_BLOCKS);
    this.logger.debug(
      { estimatedSpecks: estimatedSpecks.toString() },
      'Estimated dust cost for funded tx',
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

    return { status: 'ok', tx: boundTx };
  }

  /**
   * A transaction is eligible IFF:
   * 1. It has at least one intent
   * 2. Every intent has at least one contract action
   * 3. Every contract action is a ContractCall to a funded contract/circuit
   */
  private isEligible<S extends Signaturish, P extends Proofish, B extends Bindingish>(
    tx: Transaction<S, P, B>,
  ): boolean {
    const intents = tx.intents;
    if (!intents || intents.size === 0) {
      return false;
    }

    return Array.from(intents.values()).every(this.isIntentEligible);
  }

  private isIntentEligible<S extends Signaturish, P extends Proofish, B extends Bindingish>(
    intent: Intent<S, P, B>,
  ): boolean {
    if (intent.actions.length === 0) {
      return false;
    }
    return intent.actions.every(this.isActionEligible);
  }

  private isActionEligible(action: ContractAction<Proofish>): boolean {
    if (!(action instanceof ContractCall)) {
      return false;
    }

    const entryPoint =
      action.entryPoint instanceof Uint8Array
        ? new TextDecoder().decode(action.entryPoint)
        : action.entryPoint;

    return this.fundedContracts.some((fc) => {
      if (fc.contractAddress !== action.address) {
        return false;
      }
      if (fc.circuits.type === 'all') {
        return true;
      }
      if (fc.circuits.type === 'subset') {
        return fc.circuits.circuitNames.includes(entryPoint);
      }

      // This ensures that if we modify the circuits schema, we have a compile time error

      const _exhaustive: never = fc.circuits;

      return false;
    });
  }
}
