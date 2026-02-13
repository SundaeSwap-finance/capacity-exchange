import React from 'react';
import { Button, Message, Modal } from '../../../shared/ui';

interface SuccessModalProps {
  onDismiss: () => void;
}

export function SuccessModal({ onDismiss }: SuccessModalProps) {
  return (
    <Modal title="Transaction Complete">
      <Message variant="success">Counter incremented successfully!</Message>
      <Button variant="blue" fullWidth className="mt-4" onClick={onDismiss}>
        Done
      </Button>
    </Modal>
  );
}
