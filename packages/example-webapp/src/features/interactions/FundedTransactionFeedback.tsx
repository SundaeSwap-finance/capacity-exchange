import { LoadingSpinner } from '../../shared/ui';
import { SuccessModal, ErrorModal } from '../ces';
import type { UseFundedTransactionResult } from '../ces/useFundedTransaction';

export function FundedTransactionFeedback({ funded }: { funded: UseFundedTransactionResult }) {
  switch (funded.status) {
    case 'building':
      return <LoadingSpinner message="Building transaction..." />;

    case 'submitting':
      return <LoadingSpinner message="Funding and submitting transaction..." />;

    case 'success':
      return <SuccessModal onDismiss={funded.dismiss} />;

    case 'error':
      return <ErrorModal error={funded.error} onDismiss={funded.dismiss} />;

    case 'idle':
      return null;
  }
}
