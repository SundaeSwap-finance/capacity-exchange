import { Card, Message } from '../../shared/ui';
import { CounterIncrementInteraction, type WalletConnection } from './CounterIncrementInteraction';
import type { WalletCapabilities } from '../wallet/types';

interface ContractInteractionsSectionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

export function ContractInteractionsSection({ wallet, walletConnection }: ContractInteractionsSectionProps) {
  return (
    <Card title="Contract Interactions">
      <Message variant="info">
        These operations use <strong>your connected wallet</strong> to interact with deployed contracts.
      </Message>
      <CounterIncrementInteraction wallet={wallet} walletConnection={walletConnection} />
    </Card>
  );
}
