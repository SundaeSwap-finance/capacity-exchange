import React from 'react';
import { LabelValue } from '../../../shared/ui';
import type { Offer } from '../types';

export function BoxedLabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-dark-800 rounded border border-dark-600">
      <LabelValue label={label}>{children}</LabelValue>
    </div>
  );
}

export interface OfferSummaryProps {
  offer: Offer;
  specksRequired: bigint;
}

export function OfferSummary({ offer, specksRequired }: OfferSummaryProps) {
  return (
    <>
      <BoxedLabelValue label="specks required">{specksRequired.toLocaleString()}</BoxedLabelValue>
      <BoxedLabelValue label="Payment Amount">
        <div className="text-lg">{offer.offerAmount}</div>
        <div className="text-dark-400 text-xs mt-1">{offer.offerCurrency}</div>
      </BoxedLabelValue>
    </>
  );
}
