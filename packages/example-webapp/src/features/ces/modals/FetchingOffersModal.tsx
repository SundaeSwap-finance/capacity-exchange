import React from 'react';
import { LoadingSpinner, Modal } from '../../../shared/ui';

interface FetchingOffersModalProps {
  specksRequired: bigint;
}

export function FetchingOffersModal({ specksRequired }: FetchingOffersModalProps) {
  return (
    <Modal title="Select Payment Currency">
      <p className="text-sm text-dark-400 mb-4">
        This transaction requires <span className="text-white font-mono">{specksRequired.toLocaleString()}</span>{' '}
        specks. Fetching offers...
      </p>
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner message="Fetching offers from CES..." showElapsed />
      </div>
    </Modal>
  );
}
