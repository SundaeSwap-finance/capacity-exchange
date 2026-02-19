import { useState, useCallback } from 'react';
import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import { deposit } from '@capacity-exchange/components';
import { adaToLovelace } from '@capacity-exchange/core';
import { getDepositAddress } from '../lib/blockfrost';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { BridgeCard } from './BridgeCard';
import { FormField } from './FormField';
import type { PendingDeposit } from '../lib/deposits';

interface DepositCardProps {
  blaze: Blaze<Provider, Wallet> | null;
  onDepositSuccess: (pending: PendingDeposit) => void;
  midnightAddress: string;
  onMidnightAddressChange: (value: string) => void;
}

export function DepositCard({ blaze, onDepositSuccess, midnightAddress, onMidnightAddressChange }: DepositCardProps) {
  const [depositAddress, setDepositAddress] = useState(() => {
    try {
      return getDepositAddress();
    } catch {
      return '';
    }
  });
  const [adaAmount, setAdaAmount] = useState('');

  const amount = parseFloat(adaAmount);
  const disabledReasons = [
    !blaze && 'Connect a wallet to submit',
    !depositAddress && 'Enter a deposit address',
    !midnightAddress && 'Enter a Midnight shielded address',
    !(amount > 0) && 'Enter an ADA amount greater than 0',
  ].filter(Boolean) as string[];

  const action = useCallback(async () => {
    const res = await deposit(blaze!, {
      depositAddress,
      shieldedMidnightAddress: midnightAddress,
      lovelace: adaToLovelace(amount),
    });
    onDepositSuccess({ txHash: res.txHash, lovelace: res.lovelace, coinPublicKey: res.coinPublicKey });
    return res;
  }, [blaze, midnightAddress, amount, depositAddress, onDepositSuccess]);
  const { result, error, loading, run } = useAsyncAction(action);

  return (
    <BridgeCard
      title="Deposit"
      description="Cardano → Midnight. Lock ADA on Cardano and receive mADA on the Midnight network."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="space-y-4"
      >
        <FormField
          id="deposit-address"
          label="Deposit address"
          value={depositAddress}
          onChange={setDepositAddress}
          placeholder="addr_test1..."
        />
        <FormField
          id="midnight-address"
          label="Midnight shielded address"
          value={midnightAddress}
          onChange={onMidnightAddressChange}
          placeholder="midnight1..."
        />
        <FormField
          id="ada-amount"
          label="ADA amount"
          type="number"
          value={adaAmount}
          onChange={setAdaAmount}
          placeholder="0.000000"
          min="0"
          step="any"
        />

        <button type="submit" className="btn-primary" disabled={disabledReasons.length > 0 || loading}>
          {loading ? 'Submitting…' : 'Submit Deposit'}
        </button>
        {disabledReasons.length > 0 && (
          <p className="text-muted-xs whitespace-pre-line">{disabledReasons.join('\n')}</p>
        )}
      </form>

      {result && <div className="alert-success">Transaction submitted: {result.txHash}</div>}
      {error && <div className="alert-error">{error}</div>}
    </BridgeCard>
  );
}
