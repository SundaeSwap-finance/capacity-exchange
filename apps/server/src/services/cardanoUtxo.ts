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

export interface BlockfrostAmount {
  unit: string;
  quantity: string;
}

export interface BlockfrostUtxoEntry {
  address: string;
  amount: BlockfrostAmount[];
  tx_hash: string;
  output_index: number;
  data_hash: string | null;
  inline_datum: string | null;
  reference_script_hash: string | null;
  collateral: boolean;
}

export interface BlockfrostTxUtxosResponse {
  hash: string;
  inputs: (BlockfrostUtxoEntry & { reference: boolean })[];
  outputs: BlockfrostUtxoEntry[];
}

/**
 * Verifies Cardano UTXOs via the Blockfrost API.
 */
export class CardanoUtxoService {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly logger: FastifyBaseLogger,
    private readonly serverAddress: string,
  ) {}

  async verifyUtxoExists(ref: CardanoUtxoRef): Promise<BlockfrostTxUtxosResponse | null> {
    const url = `${this.baseUrl}/txs/${ref.txHash}/utxos`;
    this.logger.debug({ txHash: ref.txHash }, 'Verifying Cardano UTXO via Blockfrost');

    const res = await fetch(url, { headers: { project_id: this.apiKey } });

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Blockfrost request failed with status ${res.status}`);
    }

    const data = (await res.json()) as BlockfrostTxUtxosResponse;
    this.logger.debug('Blockfrost response:');
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');

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

  private calcFee(data: BlockfrostTxUtxosResponse): bigint {
    const lovelaceSum = (entries: BlockfrostUtxoEntry[]) =>
      entries.reduce((sum, e) => {
        const a = e.amount.find((a) => a.unit === LOVELACE);
        return sum + (a ? BigInt(a.quantity) : 0n);
      }, 0n);

    const spendingInputs = data.inputs.filter((i) => !i.reference && !i.collateral);
    const regularOutputs = data.outputs.filter((o) => !o.collateral);
    return lovelaceSum(spendingInputs) - lovelaceSum(regularOutputs);
  }
}
