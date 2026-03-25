import React from 'react';
import { Button, Modal } from '../../../shared/ui';
import { formatDust } from '@capacity-exchange/midnight-core';
import type { ExchangePrice, CurrencySelectionResult } from '../types';

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

interface CurrencySelectionModalProps {
  prices: ExchangePrice[];
  specksRequired: bigint;
  onSelect: (result: CurrencySelectionResult) => void;
}

export function CurrencySelectionModal({ prices, specksRequired, onSelect }: CurrencySelectionModalProps) {
  return (
    <Modal title="Select Payment Currency">
      <p className="text-sm text-dark-400 mb-4">
        This transaction requires <span className="text-white font-mono">{formatDust(specksRequired)}</span> DUST.
        Select a currency to acquire capacity:
      </p>
      <div className="space-y-2 mb-6">
        {prices.map((exchangePrice, index) => (
          <CurrencyOption
            key={`${exchangePrice.price.currency}-${index}`}
            exchangePrice={exchangePrice}
            onSelect={() => onSelect({ status: 'selected', exchangePrice })}
          />
        ))}
      </div>
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
