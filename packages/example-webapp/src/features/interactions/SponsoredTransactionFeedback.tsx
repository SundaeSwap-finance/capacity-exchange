import { LoadingSpinner } from '../../shared/ui';
import { SuccessModal, ErrorModal } from '../ces';
import type { UseSponsoredTransactionResult } from '../ces/useSponsoredTransaction';

export function SponsoredTransactionFeedback({ sponsored }: { sponsored: UseSponsoredTransactionResult }) {
  switch (sponsored.status) {
    case 'building':
      return <LoadingSpinner message="Building transaction..." />;

    case 'submitting':
      return <LoadingSpinner message="Sponsoring and submitting transaction..." />;

    case 'success':
      return <SuccessModal onDismiss={sponsored.dismiss} />;

    case 'error':
      return <ErrorModal error={sponsored.error} onDismiss={sponsored.dismiss} />;

    case 'idle':
      return null;
  }
}
