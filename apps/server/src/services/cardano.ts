import { BlockFrostAPI, BlockfrostServerError } from '@blockfrost/blockfrost-js';
import { FastifyBaseLogger } from 'fastify';

const LOVELACE = 'lovelace';

export interface CardanoUtxoRef {
  txHash: string;
  // required to check from where the ADA came from
  senderAddress: string;
  // the amount of lovelace sent by the sender, in the transaction
  // (excluding network fee, which is added back for comparison since it comes out of the same output)
  sentValue: bigint;
}

type TxUtxos = Awaited<ReturnType<BlockFrostAPI['txsUtxos']>>;

export class CardanoService {
  private readonly api: BlockFrostAPI;

  constructor(
    apiKey: string,
    baseUrl: string,
    private readonly logger: FastifyBaseLogger,
    private readonly serverAddress: string,
  ) {
    this.api = new BlockFrostAPI({
      projectId: apiKey,
      customBackend: baseUrl,
      requestTimeout: 10_000,
    });
  }

  async verifyUtxoExists(ref: CardanoUtxoRef): Promise<TxUtxos | null> {
    this.logger.debug({ txHash: ref.txHash }, 'Verifying Cardano UTXO via Blockfrost');

    let data: TxUtxos;
    try {
      data = await this.api.txsUtxos(ref.txHash);
    } catch (err) {
      if (err instanceof BlockfrostServerError && err.status_code === 404) {
        return null;
      }
      throw err;
    }

    this.logger.debug({ data }, 'Blockfrost response');

    const output = data.outputs.find((o) => o.address === this.serverAddress && !o.collateral);
    if (!output) {
      this.logger.warn(
        { serverAddress: this.serverAddress },
        'No output to server address found in transaction',
      );
      return null;
    }

    const fromSender = data.inputs.some((i) => i.address === ref.senderAddress);
    if (!fromSender) {
      this.logger.warn(
        { senderAddress: ref.senderAddress },
        'No transaction input from sender address',
      );
      return null;
    }

    const entry = output.amount.find((a) => a.unit === LOVELACE);
    const received = entry ? BigInt(entry.quantity) : 0n;
    const fee = this.calcFee(data);
    if (received + fee < ref.sentValue) {
      this.logger.warn(
        { sentValue: ref.sentValue.toString(), received: received.toString(), fee: fee.toString() },
        'UTXO lovelace below expected minimum (including network fee)',
      );
      return null;
    }

    return data;
  }

  private calcFee(data: TxUtxos): bigint {
    const lovelaceSum = (entries: TxUtxos['inputs'] | TxUtxos['outputs']) =>
      entries.reduce((sum, e) => {
        const a = e.amount.find((a) => a.unit === LOVELACE);
        return sum + (a ? BigInt(a.quantity) : 0n);
      }, 0n);

    const spendingInputs = data.inputs.filter((i) => !i.reference && !i.collateral);
    const regularOutputs = data.outputs.filter((o) => !o.collateral);
    return lovelaceSum(spendingInputs) - lovelaceSum(regularOutputs);
  }
}
