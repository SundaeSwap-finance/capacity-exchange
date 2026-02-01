import { Collapsible } from '../../shared/ui/Collapsible';
import { InteractionInfoBox } from './InteractionInfoBox';
import { TokenMintInteraction } from './TokenMintInteraction';
import { CounterIncrementInteraction, type WalletConnection } from './CounterIncrementInteraction';
import type { WalletCapabilities } from '../wallet/types';

interface ContractInteractionsSectionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

export function ContractInteractionsSection({
  wallet,
  walletConnection,
}: ContractInteractionsSectionProps) {
  return (
    <Collapsible title="Contract Interactions" defaultOpen>
      <div className="space-y-4">
        <InteractionInfoBox />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TokenMintInteraction wallet={wallet} walletConnection={walletConnection} />
          <CounterIncrementInteraction wallet={wallet} walletConnection={walletConnection} />
        </div>
      </div>
    </Collapsible>
  );
}
