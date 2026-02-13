import React from 'react';
import { LoadingSpinner, Modal } from '../../../shared/ui';
import { OfferSummary } from './OfferSummary';
import type { OfferSummaryProps } from './OfferSummary';

export function SubmittingModal({ offer, specksRequired }: OfferSummaryProps) {
  return (
    <Modal title="Confirm Offer">
      <div className="space-y-3 mb-6">
        <OfferSummary offer={offer} specksRequired={specksRequired} />
      </div>
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner message="Submitting transaction..." showElapsed />
      </div>
    </Modal>
  );
}
