import { Button, Message } from '../../../shared/ui';
import type { TokenMintConfig } from '../hooks/useContractsConfig';
import type { WalletCapabilities } from '../../wallet/types';
import type { ServerWallet } from '../../faucet';
import { ContractPanel } from './ContractPanelUI';
import { useTokenMintOperations } from './useTokenMintOperations';
import { TokenMintModifyRow } from './TokenMintModifyRow';

interface TokenMintContractPanelProps {
  config: TokenMintConfig;
  wallet: WalletCapabilities | null;
  serverWallet: ServerWallet;
}

export function TokenMintContractPanel({ config, wallet, serverWallet }: TokenMintContractPanelProps) {
  const ops = useTokenMintOperations(config, wallet, serverWallet);
  const canSend = wallet !== null && ops.serverReady && ops.sendAmount > 0;

  return (
    <ContractPanel
      title="Token Mint Contract"
      isRunning={ops.state.submitting}
      currentOperation={ops.state.label}
      error={ops.state.error}
      fields={[
        { label: 'Contract Address', value: config.contractAddress },
        { label: 'Token Color', value: config.derivedTokenColor },
      ]}
      result={ops.balance ? { label: 'Server Wallet Balance', value: ops.balance } : null}
      queryRow={
        <Button
          onClick={ops.handleVerify}
          disabled={ops.state.submitting || !ops.serverReady}
          variant="purple"
          size="sm"
        >
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
          isRunning={ops.state.submitting || !ops.serverReady}
          canSend={canSend}
        />
      }
      messages={
        <>
          {!wallet && <Message variant="warn">Connect a wallet to send tokens.</Message>}
          {ops.sendTxHash && (
            <Message variant="success">
              Sent {ops.sendAmount} tokens (tx: {ops.sendTxHash.slice(0, 8)}...)
            </Message>
          )}
        </>
      }
    />
  );
}
