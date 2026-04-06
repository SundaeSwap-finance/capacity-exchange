import React from 'react';
import { LoadingSpinner, Modal } from '../../../shared/ui';

export function SubmittingModal() {
  return (
    <Modal title="Submitting">
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner message="Submitting transaction..." showElapsed />
      </div>
    </Modal>
  );
}
