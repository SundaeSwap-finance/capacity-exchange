import React from 'react';
import { Button, Message, Modal } from '../../../shared/ui';

interface ErrorModalProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorModal({ error, onDismiss }: ErrorModalProps) {
  return (
    <Modal title="Confirm Offer">
      <Message variant="error">{error ?? 'Transaction failed'}</Message>
      <Button
        variant="ghost"
        fullWidth
        className="mt-4 border border-dark-600 hover:border-dark-500"
        onClick={onDismiss}
      >
        Close
      </Button>
    </Modal>
  );
}
