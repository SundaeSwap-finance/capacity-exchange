import { Button, Message } from '../../../shared/ui';
import type { TokenMintConfig } from '../hooks/useContractsConfig';
import type { WalletCapabilities } from '../../wallet/types';
import { ContractPanel } from './ContractPanelUI';
import { useTokenMintOperations } from './useTokenMintOperations';
import { TokenMintModifyRow } from './TokenMintModifyRow';

interface TokenMintContractPanelProps {
  networkId: string;
  config: TokenMintConfig;
  wallet: WalletCapabilities | null;
}

export function TokenMintContractPanel({ networkId, config, wallet }: TokenMintContractPanelProps) {
  const ops = useTokenMintOperations(networkId, config, wallet);
  const canSend = wallet !== null && ops.sendAmount > 0;

  return (
    <ContractPanel
      title="Token Mint Contract"
      isRunning={ops.state.isRunning}
      currentOperation={ops.state.currentOperation}
      error={ops.state.error}
      logs={ops.state.logs}
      fields={[
        { label: 'Contract Address', value: config.contractAddress },
        { label: 'Token Color', value: config.derivedTokenColor },
      ]}
      result={ops.verifyResult ? { label: 'Server Wallet Balance', value: ops.verifyResult.balance } : null}
      queryRow={
        <Button onClick={ops.handleVerify} disabled={ops.state.isRunning} variant="purple" size="sm">
          Get Balance
        </Button>
      }
      modifyRow={
        <TokenMintModifyRow
          mintAmount={ops.mintAmount}
          onMintAmountChange={ops.setMintAmount}
          onMint={ops.handleMint}
          sendAmount={ops.sendAmount}
          onSendAmountChange={ops.setSendAmount}
          onSend={ops.handleSend}
          isRunning={ops.state.isRunning}
          canSend={canSend}
        />
      }
      messages={
        <>
          {!wallet && <Message variant="warn">Connect a wallet to send tokens.</Message>}
          {ops.sendResult && (
            <Message variant="success">
              Sent {ops.sendResult.amount} tokens (tx: {ops.sendResult.txHash.slice(0, 8)}...)
            </Message>
          )}
        </>
      }
    />
  );
}
