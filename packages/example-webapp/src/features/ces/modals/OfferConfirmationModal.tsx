import React from 'react';
import { Button, Modal } from '../../../shared/ui';
import { useCountdown } from '../../../lib/hooks/useCountdown';
import type { OfferConfirmationResult } from '../types';
import { BoxedLabelValue, OfferSummary } from './OfferSummary';
import type { OfferSummaryProps } from './OfferSummary';

interface OfferConfirmationModalProps extends OfferSummaryProps {
  onConfirm: (result: OfferConfirmationResult) => void;
}

export function OfferConfirmationModal({ offer, specksRequired, onConfirm }: OfferConfirmationModalProps) {
  const { timeRemaining, isExpired } = useCountdown(offer.expiresAt);

  return (
    <Modal title="Confirm Offer">
      <div className="space-y-3 mb-6">
        <OfferSummary offer={offer} specksRequired={specksRequired} />
        <BoxedLabelValue label="Offer Expires In">
          <span className={isExpired ? 'text-red-400' : ''}>{timeRemaining}</span>
        </BoxedLabelValue>
        <BoxedLabelValue label="Offer ID">{offer.offerId}</BoxedLabelValue>
      </div>
      <div className="flex min-w-0 gap-2">
        <Button
          variant="ghost"
          className="min-w-0 flex-1 border border-dark-600 hover:border-dark-500"
          onClick={() => onConfirm({ status: 'back' })}
        >
          Back
        </Button>
        <Button
          variant="ghost"
          className="min-w-0 flex-1 border border-dark-600 hover:border-dark-500"
          onClick={() => onConfirm({ status: 'cancelled' })}
        >
          Cancel
        </Button>
        <Button
          variant="green"
          className="min-w-0 flex-1"
          disabled={isExpired}
          onClick={() => onConfirm({ status: 'confirmed' })}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  );
}
