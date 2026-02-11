import type { ReactNode } from 'react';
import { Button, Message } from '../../shared/ui';

export function DeploymentInfoBox() {
  return (
    <Message variant="info">
      Contracts are deployed from the server wallet configured via the{' '}
      <code className="bg-blue-900/40 px-1 rounded">WALLET_SEED_FILE</code> environment variable.
    </Message>
  );
}

export function DeployButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="green" size="sm" onClick={onClick} disabled={disabled}>
      Deploy
    </Button>
  );
}

export function DeployResultBox({ children }: { children: ReactNode }) {
  return <div className="p-2 bg-dark-800 rounded border border-dark-600 space-y-2 text-xs">{children}</div>;
}
