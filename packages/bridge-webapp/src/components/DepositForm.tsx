import { useState, useCallback } from 'react';
import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import { deposit } from '@capacity-exchange/components';
import { adaToLovelace } from '@capacity-exchange/core';
import { getBridgeDepositAddress } from '../lib/blockfrost';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { BridgeCard } from './BridgeCard';
import { BridgeForm } from './BridgeForm';
import { FormField } from './FormField';
import type { Deposit } from '../lib/deposits';

interface DepositFormProps {
  blaze: Blaze<Provider, Wallet> | undefined;
  midnightAddress: string | undefined;
  addDeposit: (deposit: Deposit) => void;
}

export function DepositForm({ blaze, midnightAddress, addDeposit }: DepositFormProps) {
  const [depositAddress] = useState(() => getBridgeDepositAddress());
  const [adaAmount, setAdaAmount] = useState('');

  const amount = parseFloat(adaAmount);
  const disabledReasons = [
    !blaze && 'Connect your Cardano wallet to submit a deposit',
    !depositAddress && 'Missing deposit address',
    !midnightAddress && 'Connect your Midnight wallet to receive the wrapped deposit',
    !(amount > 0) && 'Enter an ADA amount greater than 0',
  ].filter(Boolean) as string[];

  const action = useCallback(async () => {
    const res = await deposit(blaze!, {
      depositAddress,
      shieldedMidnightAddress: midnightAddress!,
      lovelace: adaToLovelace(amount),
    });
    addDeposit({
      txHash: res.txHash,
      lovelace: res.lovelace,
      coinPublicKey: res.coinPublicKey,
      submittedAt: Date.now(),
      status: 'unconfirmed',
    });
    return res;
  }, [blaze, midnightAddress, amount, depositAddress, addDeposit]);
  const { result, error, loading, run } = useAsyncAction(action);

  return (
    <BridgeCard
      title="Deposit"
      description="Cardano → Midnight. Lock ADA on Cardano and receive mADA on the Midnight network."
    >
      <BridgeForm
        onSubmit={run}
        disabledReasons={disabledReasons}
        loading={loading}
        submitLabel="Submit Deposit"
        loadingLabel="Submitting…"
        result={result && <div className="alert-success">Transaction submitted: {result.txHash}</div>}
        error={error}
      >
        <FormField
          id="deposit-address"
          label="Deposit address (The Bridge)"
          value={depositAddress}
          onChange={() => {}}
          placeholder="addr_test1..."
          readOnly
        />
        <FormField
          id="midnight-address"
          label="Midnight shielded address (your Midnight address)"
          value={midnightAddress ?? ''}
          onChange={() => {}}
          placeholder="Connect your Midnight wallet to populate"
          readOnly
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
      </BridgeForm>
    </BridgeCard>
  );
}
