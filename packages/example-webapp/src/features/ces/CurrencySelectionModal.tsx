import React from 'react';
import type { ExchangePrice, CurrencySelectionResult } from './types';

interface CurrencySelectionModalProps {
  prices: ExchangePrice[];
  dustRequired: bigint;
  onSelect: (result: CurrencySelectionResult) => void;
}

function formatDust(amount: bigint): string {
  const decimals = 9;
  const str = amount.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, -decimals) || '0';
  const decPart = str.slice(-decimals).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

export function CurrencySelectionModal({
  prices,
  dustRequired,
  onSelect,
}: CurrencySelectionModalProps) {
  const handleSelect = (exchangePrice: ExchangePrice) => {
    onSelect({ status: 'selected', exchangePrice });
  };

  const handleCancel = () => {
    onSelect({ status: 'cancelled' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-900 border border-dark-700 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">Select Payment Currency</h3>
        <p className="text-sm text-dark-400 mb-4">
          This transaction requires <span className="text-white font-mono">{formatDust(dustRequired)}</span> DUST.
          Select a currency to acquire capacity:
        </p>

        <div className="space-y-2 mb-6">
          {prices.map((exchangePrice, index) => (
            <button
              key={`${exchangePrice.price.currency}-${index}`}
              onClick={() => handleSelect(exchangePrice)}
              className="w-full p-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-left transition-colors"
            >
              <div className="flex justify-between items-center gap-4">
                <span
                  className="text-white font-mono text-sm break-all"
                  title={exchangePrice.price.currency}
                >
                  {exchangePrice.price.currency}
                </span>
                <span className="text-dark-300 font-mono whitespace-nowrap">{exchangePrice.price.amount}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleCancel}
          className="w-full py-2 text-dark-400 hover:text-white border border-dark-600 hover:border-dark-500 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
