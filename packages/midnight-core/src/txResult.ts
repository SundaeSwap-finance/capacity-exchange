export interface TxResult {
  txHash: string;
  contractAddress: string;
  blockHeight: string;
  blockHash: string;
}

export function toTxResult(
  contractAddress: string,
  publicData: { txHash: string; blockHeight: number; blockHash: string }
): TxResult {
  return {
    txHash: publicData.txHash,
    contractAddress,
    blockHeight: publicData.blockHeight.toString(),
    blockHash: publicData.blockHash,
  };
}
