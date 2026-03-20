export interface TxResult {
  txId: string;
  txHash: string;
  contractAddress: string;
  blockHeight: string;
  blockHash: string;
}

export function toTxResult(
  contractAddress: string,
  publicData: { txId: string; txHash: string; blockHeight: number; blockHash: string }
): TxResult {
  return {
    txId: publicData.txId,
    txHash: publicData.txHash,
    contractAddress,
    blockHeight: publicData.blockHeight.toString(),
    blockHash: publicData.blockHash,
  };
}
