import { FastifyBaseLogger } from 'fastify';

export interface CardanoUtxoRef {
  txHash: string;
  outputIndex: number;
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
  ) {}

  /**
   * Returns the full Blockfrost tx/utxos response if the given output index exists.
   * Returns null if the transaction is not found (404) or the output index is absent.
   * Throws on unexpected Blockfrost errors.
   */
  async verifyUtxoExists(ref: CardanoUtxoRef): Promise<BlockfrostTxUtxosResponse | null> {
    const url = `${this.baseUrl}/txs/${ref.txHash}/utxos`;
    this.logger.debug(
      { txHash: ref.txHash, outputIndex: ref.outputIndex },
      'Verifying Cardano UTXO via Blockfrost',
    );

    const res = await fetch(url, { headers: { project_id: this.apiKey } });
    
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Blockfrost request failed with status ${res.status}`);
    }

    const data = (await res.json()) as BlockfrostTxUtxosResponse;
    this.logger.debug({ response: data }, 'Blockfrost response');

    const found = data.outputs.some((o) => o.output_index === ref.outputIndex);
    return found ? data : null;
  }
}
