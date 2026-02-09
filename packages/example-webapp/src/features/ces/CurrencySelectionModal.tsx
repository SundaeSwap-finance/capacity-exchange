import React from 'react';
import { Button, LoadingSpinner, Modal } from '../../shared/ui';
import { formatDust } from '../../utils/format';
import type { ExchangePrice, CurrencySelectionResult } from './types';

function DustRequirementText({ dustRequired, detail }: { dustRequired: bigint; detail: string }) {
  return (
    <p className="text-sm text-dark-400 mb-4">
      This transaction requires <span className="text-white font-mono">{formatDust(dustRequired)}</span> DUST. {detail}
    </p>
  );
}

function CurrencyOption({ exchangePrice, onSelect }: { exchangePrice: ExchangePrice; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full p-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-left transition-colors"
    >
      <div className="flex justify-between items-center">
        <span className="text-white font-medium font-mono text-sm break-all">{exchangePrice.price.currency}</span>
        <span className="text-dark-300 font-mono">{exchangePrice.price.amount}</span>
      </div>
    </button>
  );
}

function CurrencyOptionList({
  prices,
  onSelect,
}: {
  prices: ExchangePrice[];
  onSelect: (exchangePrice: ExchangePrice) => void;
}) {
  return (
    <div className="space-y-2 mb-6">
      {prices.map((exchangePrice, index) => (
        <CurrencyOption
          key={`${exchangePrice.price.currency}-${index}`}
          exchangePrice={exchangePrice}
          onSelect={() => onSelect(exchangePrice)}
        />
      ))}
    </div>
  );
}

interface CurrencySelectionModalProps {
  prices: ExchangePrice[];
  dustRequired: bigint;
  fetchingOffers: boolean;
  onSelect: (result: CurrencySelectionResult) => void;
}

export function CurrencySelectionModal({
  prices,
  dustRequired,
  fetchingOffers,
  onSelect,
}: CurrencySelectionModalProps) {
  if (fetchingOffers) {
    return (
      <Modal title="Select Payment Currency">
        <DustRequirementText dustRequired={dustRequired} detail="Fetching offers..." />
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner message="Fetching offers from CES..." showElapsed />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Select Payment Currency">
      <DustRequirementText dustRequired={dustRequired} detail="Select a currency to acquire capacity:" />
      <CurrencyOptionList prices={prices} onSelect={(ep) => onSelect({ status: 'selected', exchangePrice: ep })} />
      <Button
        variant="ghost"
        fullWidth
        onClick={() => onSelect({ status: 'cancelled' })}
        className="border border-dark-600 hover:border-dark-500"
      >
        Cancel
      </Button>
    </Modal>
  );
}
