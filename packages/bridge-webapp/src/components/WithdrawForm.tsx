import { useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { ShieldedToken } from '../lib/vaultTokens';
import { fetchVaultTokens } from '../lib/vaultTokens';
import { requestWithdrawal } from '../lib/requestWithdrawal';
import { useAsyncDerived } from '../hooks/useAsyncDerived';
import { useFormAction } from '../hooks/useFormAction';
import { BridgeCard } from './BridgeCard';
import { BridgeForm } from './BridgeForm';
import { FormField } from './FormField';
import { ShieldedTokenSelect } from './ShieldedTokenSelect';

function getDisabledReasons(
  midnightWallet: ConnectedAPI | undefined,
  midnightAddress: string | undefined,
  cardanoAddress: string | undefined,
  selectedToken: ShieldedToken | null,
  parsedAmount: number
): string[] {
  return [
    !midnightWallet && 'Connect your Midnight wallet to submit a withdrawal',
    !midnightAddress && 'Midnight address not available',
    !cardanoAddress && 'Connect your Cardano wallet to set the withdrawal address',
    !selectedToken && 'Select a shielded token to withdraw',
    !(parsedAmount > 0) && 'Enter an amount greater than 0',
  ].filter(Boolean) as string[];
}

function TokenSelectPlaceholder({ message, loading }: { message: string; loading?: boolean }) {
  return (
    <div>
      <label className="label">Shielded tokens</label>
      <div className="input bg-dark-800/50 text-dark-400 flex items-center gap-2">
        {loading && <span className="spinner" />} {message}
      </div>
    </div>
  );
}

interface WithdrawFormProps {
  midnightWallet: ConnectedAPI | undefined;
  midnightAddress: string | undefined;
  cardanoAddress: string | undefined;
  cardanoAddressHex: string | undefined;
}

export function WithdrawForm({ midnightWallet, midnightAddress, cardanoAddress, cardanoAddressHex }: WithdrawFormProps) {
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<ShieldedToken | null>(null);

  const { data: tokens, error: tokensError } = useAsyncDerived(midnightWallet ?? null, fetchVaultTokens);

  // TODO(SUNDAE-2473): Convert from human-readable format to atomic units once token decimals are configured
  const parsedAmount = parseFloat(amount);
  const disabledReasons = getDisabledReasons(
    midnightWallet,
    midnightAddress,
    cardanoAddress,
    selectedToken,
    parsedAmount
  );

  const [{ result, error }, formAction, isPending] = useFormAction(async () => {
    const shielded = await midnightWallet!.getShieldedAddresses();
    return requestWithdrawal({
      connectedAPI: midnightWallet!,
      shieldedAddress: shielded.shieldedAddress,
      shieldedCoinPublicKey: shielded.shieldedCoinPublicKey,
      shieldedEncryptionPublicKey: shielded.shieldedEncryptionPublicKey,
      amount: BigInt(Math.floor(parsedAmount)),
      cardanoAddress: cardanoAddressHex!,
      domainSep: selectedToken!.domainSep,
    });
  });

  return (
    <BridgeCard
      title="Withdraw"
      description="Midnight → Cardano. Burn mADA on the Midnight network and reclaim ADA on Cardano."
    >
      <BridgeForm
        action={formAction}
        disabledReasons={disabledReasons}
        isPending={isPending}
        submitLabel="Submit Withdrawal"
        loadingLabel="Submitting…"
        result={result && <div className="alert-success">Withdrawal submitted: {result.txHash}</div>}
        error={error}
      >
        <FormField
          id="withdraw-midnight-address"
          label="Midnight shielded address (your Midnight address)"
          value={midnightAddress ?? ''}
          onChange={() => { }}
          placeholder="Connect your Midnight wallet to populate"
          readOnly
        />
        <FormField
          id="withdraw-cardano-address"
          label="Cardano address (your Cardano wallet)"
          value={cardanoAddress ?? ''}
          onChange={() => { }}
          placeholder="Connect your Cardano wallet to populate"
          readOnly
        />
        {!midnightWallet ? (
          <TokenSelectPlaceholder message="Connect your Midnight wallet" />
        ) : tokensError ? (
          <TokenSelectPlaceholder message={`Error: ${tokensError}`} />
        ) : !tokens ? (
          <TokenSelectPlaceholder message="Loading balances..." loading />
        ) : (
          <ShieldedTokenSelect
            tokens={tokens}
            selectedColor={selectedToken?.color ?? null}
            onSelect={setSelectedToken}
          />
        )}
        <FormField
          id="withdraw-amount"
          label="Amount"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0"
          min="0"
          step="any"
        />
      </BridgeForm>
    </BridgeCard>
  );
}
