import { LoadingSpinner } from '../../shared/ui';
import {
  FetchingOffersModal,
  CurrencySelectionModal,
  OfferConfirmationModal,
  SubmittingModal,
  SuccessModal,
  ErrorModal,
} from '../ces';
import type { UseCesTransactionResult } from '../ces';

export function CesTransactionFeedback({ ces }: { ces: UseCesTransactionResult }) {
  switch (ces.status) {
    case 'building':
      return <LoadingSpinner message="Building transaction..." />;

    case 'fetching-offers':
      if (!ces.currencySelection) {
        return null;
      }
      return <FetchingOffersModal specksRequired={ces.currencySelection.specksRequired} />;

    case 'selecting-currency':
      if (!ces.currencySelection) {
        return null;
      }
      return (
        <CurrencySelectionModal
          prices={ces.currencySelection.prices}
          specksRequired={ces.currencySelection.specksRequired}
          onSelect={ces.onCurrencySelected}
        />
      );

    case 'confirming':
      if (!ces.offerConfirmation) {
        return null;
      }
      return (
        <OfferConfirmationModal
          offer={ces.offerConfirmation.offer}
          specksRequired={ces.offerConfirmation.specksRequired}
          onConfirm={ces.onOfferConfirmed}
        />
      );

    case 'submitting':
      if (!ces.offerConfirmation) {
        return null;
      }
      return (
        <SubmittingModal offer={ces.offerConfirmation.offer} specksRequired={ces.offerConfirmation.specksRequired} />
      );

    case 'success':
      return <SuccessModal onDismiss={ces.dismissOffer} />;

    case 'error':
      return <ErrorModal error={ces.error} onDismiss={ces.dismissOffer} />;

    case 'idle':
      return null;
  }
}
