import React, { useState, useEffect } from 'react';
import type { Offer, OfferConfirmationResult } from './types';

interface OfferConfirmationModalProps {
  offer: Offer;
  dustRequired: bigint;
  onConfirm: (result: OfferConfirmationResult) => void;
}

function formatDust(amount: bigint): string {
  const decimals = 9;
  const str = amount.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, -decimals) || '0';
  const decPart = str.slice(-decimals).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

function formatTimeRemaining(expiresAt: Date): string {
  const now = Date.now();
  const remaining = expiresAt.getTime() - now;

  if (remaining <= 0) {
    return 'Expired';
  }

  const seconds = Math.floor(remaining / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function OfferConfirmationModal({
  offer,
  dustRequired,
  onConfirm,
}: OfferConfirmationModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(offer.expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(offer.expiresAt);
      setTimeRemaining(remaining);

      if (remaining === 'Expired') {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [offer.expiresAt]);

  const isExpired = timeRemaining === 'Expired';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-900 border border-dark-700 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Confirm Offer</h3>

        <div className="space-y-3 mb-6">
          <div className="p-3 bg-dark-800 rounded border border-dark-600">
            <div className="text-xs text-dark-400 mb-1">DUST Required</div>
            <div className="text-white font-mono">{formatDust(dustRequired)}</div>
          </div>

          <div className="p-3 bg-dark-800 rounded border border-dark-600">
            <div className="text-xs text-dark-400 mb-1">Payment Amount</div>
            <div className="text-white font-mono">{offer.offerAmount}</div>
          </div>

          <div className="p-3 bg-dark-800 rounded border border-dark-600">
            <div className="text-xs text-dark-400 mb-1">Payment Currency</div>
            <div className="text-white font-mono text-sm break-all">{offer.offerCurrency}</div>
          </div>

          <div className="p-3 bg-dark-800 rounded border border-dark-600">
            <div className="text-xs text-dark-400 mb-1">Offer Expires In</div>
            <div className={`font-mono ${isExpired ? 'text-red-400' : 'text-white'}`}>
              {timeRemaining}
            </div>
          </div>

          <div className="p-3 bg-dark-800 rounded border border-dark-600">
            <div className="text-xs text-dark-400 mb-1">Offer ID</div>
            <div className="text-white font-mono text-xs break-all">{offer.offerId}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onConfirm({ status: 'back' })}
            className="flex-1 py-2 text-dark-400 hover:text-white border border-dark-600 hover:border-dark-500 rounded transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => onConfirm({ status: 'cancelled' })}
            className="flex-1 py-2 text-dark-400 hover:text-white border border-dark-600 hover:border-dark-500 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ status: 'confirmed' })}
            disabled={isExpired}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
