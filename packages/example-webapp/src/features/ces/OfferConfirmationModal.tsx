import React from 'react';
import { Button, LabelValue, LoadingSpinner, Message, Modal } from '../../shared/ui';
import { formatDust } from '../../utils/format';
import { useCountdown } from '../../lib/hooks/useCountdown';
import type { Offer, OfferConfirmationResult } from './types';

type ModalPhase = 'confirm' | 'submitting' | 'success' | 'error';

function BoxedLabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-dark-800 rounded border border-dark-600">
      <LabelValue label={label}>{children}</LabelValue>
    </div>
  );
}

function OfferSummary({ offer, dustRequired }: { offer: Offer; dustRequired: bigint }) {
  return (
    <>
      <BoxedLabelValue label="DUST Required">{formatDust(dustRequired)}</BoxedLabelValue>
      <BoxedLabelValue label="Payment Amount">
        <div className="text-lg">{offer.offerAmount}</div>
        <div className="text-dark-400 text-xs mt-1">{offer.offerCurrency}</div>
      </BoxedLabelValue>
    </>
  );
}

function ConfirmPhase({
  offer,
  dustRequired,
  onConfirm,
}: {
  offer: Offer;
  dustRequired: bigint;
  onConfirm: (result: OfferConfirmationResult) => void;
}) {
  const { timeRemaining, isExpired } = useCountdown(offer.expiresAt);

  return (
    <>
      <div className="space-y-3 mb-6">
        <OfferSummary offer={offer} dustRequired={dustRequired} />
        <BoxedLabelValue label="Offer Expires In">
          <span className={isExpired ? 'text-red-400' : ''}>{timeRemaining}</span>
        </BoxedLabelValue>
        <BoxedLabelValue label="Offer ID">{offer.offerId}</BoxedLabelValue>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1 border border-dark-600 hover:border-dark-500"
          onClick={() => onConfirm({ status: 'back' })}
        >
          Back
        </Button>
        <Button
          variant="ghost"
          className="flex-1 border border-dark-600 hover:border-dark-500"
          onClick={() => onConfirm({ status: 'cancelled' })}
        >
          Cancel
        </Button>
        <Button
          variant="green"
          className="flex-1"
          disabled={isExpired}
          onClick={() => onConfirm({ status: 'confirmed' })}
        >
          Confirm
        </Button>
      </div>
    </>
  );
}

function SubmittingPhase({ offer, dustRequired }: { offer: Offer; dustRequired: bigint }) {
  return (
    <>
      <div className="space-y-3 mb-6">
        <OfferSummary offer={offer} dustRequired={dustRequired} />
      </div>
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner message="Submitting transaction..." showElapsed />
      </div>
    </>
  );
}

function SuccessPhase({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <Message variant="success">Counter incremented successfully!</Message>
      <Button variant="blue" fullWidth className="mt-4" onClick={onDismiss}>
        Done
      </Button>
    </>
  );
}

function ErrorPhase({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  return (
    <>
      <Message variant="error">{error ?? 'Transaction failed'}</Message>
      <Button
        variant="ghost"
        fullWidth
        className="mt-4 border border-dark-600 hover:border-dark-500"
        onClick={onDismiss}
      >
        Close
      </Button>
    </>
  );
}

interface OfferConfirmationModalProps {
  offer: Offer;
  dustRequired: bigint;
  phase: ModalPhase;
  error: string | null;
  onConfirm: (result: OfferConfirmationResult) => void;
  onDismiss: () => void;
}

export function OfferConfirmationModal({
  offer,
  dustRequired,
  phase,
  error,
  onConfirm,
  onDismiss,
}: OfferConfirmationModalProps) {
  const title = phase === 'success' ? 'Transaction Complete' : 'Confirm Offer';

  return (
    <Modal title={title}>
      {phase === 'confirm' && <ConfirmPhase offer={offer} dustRequired={dustRequired} onConfirm={onConfirm} />}
      {phase === 'submitting' && <SubmittingPhase offer={offer} dustRequired={dustRequired} />}
      {phase === 'success' && <SuccessPhase onDismiss={onDismiss} />}
      {phase === 'error' && <ErrorPhase error={error} onDismiss={onDismiss} />}
    </Modal>
  );
}
