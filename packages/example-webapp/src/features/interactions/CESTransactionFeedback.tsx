import { LoadingSpinner, Message } from '../../shared/ui';
import { CurrencySelectionModal, OfferConfirmationModal } from '../ces';
import type { useCESTransaction } from '../ces';

type CESTransactionState = ReturnType<typeof useCESTransaction>;

const statusMessages: Record<string, string> = {
  idle: '',
  building: 'Building transaction...',
  'selecting-currency': 'Select payment currency',
  'fetching-offers': 'Fetching offers from CES...',
  confirming: 'Confirm offer',
  submitting: 'Submitting transaction...',
  success: 'Transaction successful!',
  error: 'Transaction failed',
};

const MODAL_STATUSES = new Set(['selecting-currency', 'fetching-offers', 'confirming', 'submitting']);

export function CESTransactionFeedback({ ces }: { ces: CESTransactionState }) {
  const isProcessing = ces.status !== 'idle' && ces.status !== 'success' && ces.status !== 'error';
  const showSpinner = isProcessing && !MODAL_STATUSES.has(ces.status);

  return (
    <>
      {showSpinner && <LoadingSpinner message={statusMessages[ces.status]} />}

      {ces.status === 'success' && !ces.offerConfirmation && (
        <Message variant="success">Counter incremented successfully!</Message>
      )}

      {ces.status === 'error' && !ces.offerConfirmation && ces.error && <Message variant="error">{ces.error}</Message>}

      {ces.currencySelection && (
        <CurrencySelectionModal
          prices={ces.currencySelection.prices}
          dustRequired={ces.currencySelection.dustRequired}
          fetchingOffers={ces.status === 'fetching-offers'}
          onSelect={ces.onCurrencySelected}
        />
      )}

      {ces.offerConfirmation && (
        <OfferConfirmationModal
          offer={ces.offerConfirmation.offer}
          dustRequired={ces.offerConfirmation.dustRequired}
          phase={
            ces.status === 'submitting'
              ? 'submitting'
              : ces.status === 'success'
                ? 'success'
                : ces.status === 'error'
                  ? 'error'
                  : 'confirm'
          }
          error={ces.error}
          onConfirm={ces.onOfferConfirmed}
          onDismiss={ces.dismissOffer}
        />
      )}
    </>
  );
}
