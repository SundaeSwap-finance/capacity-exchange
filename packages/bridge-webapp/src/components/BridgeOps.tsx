import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useAsyncDerived } from '../hooks/useAsyncDerived';
import { useUserDeposits } from '../hooks/useUserDeposits';
import { useCoinPublicKey } from '../hooks/useCoinPublicKey';
import { deriveShieldedAddress } from '../lib/midnight';
import { DepositForm } from './DepositForm';
import { WithdrawForm } from './WithdrawForm';
import { DepositList } from './DepositList';

interface BridgeOpsProps {
  blaze: Blaze<Provider, Wallet> | undefined;
  midnightWallet: ConnectedAPI | undefined;
}

export function BridgeOps({ blaze, midnightWallet }: BridgeOpsProps) {
  const midnightAddress = useAsyncDerived(midnightWallet ?? null, deriveShieldedAddress).data ?? undefined;
  const cardanoAddrs = useAsyncDerived(blaze ?? null, async (b) => {
    const addr = await b.wallet.getChangeAddress();
    return { bech32: addr.toBech32(), hex: addr.toBytes() };
  }).data;
  const coinPublicKey = useCoinPublicKey(midnightAddress);
  const deposits = useUserDeposits({ coinPublicKey });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DepositForm blaze={blaze} midnightAddress={midnightAddress} />
        <WithdrawForm
          midnightWallet={midnightWallet}
          midnightAddress={midnightAddress}
          cardanoAddress={cardanoAddrs?.bech32}
          cardanoAddressHex={cardanoAddrs?.hex}
        />
      </div>

      <DepositList deposits={deposits} />
    </>
  );
}
