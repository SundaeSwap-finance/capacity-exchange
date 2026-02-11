import { Button, Input } from '../../../shared/ui';

interface TokenMintModifyRowProps {
  mintAmount: number;
  onMintAmountChange: (value: number) => void;
  onMint: () => void;
  sendAmount: number;
  onSendAmountChange: (value: number) => void;
  onSend: () => void;
  isRunning: boolean;
  canSend: boolean;
}

export function TokenMintModifyRow({
  mintAmount,
  onMintAmountChange,
  onMint,
  sendAmount,
  onSendAmountChange,
  onSend,
  isRunning,
  canSend,
}: TokenMintModifyRowProps) {
  return (
    <>
      <Input
        type="number"
        value={mintAmount}
        onChange={(e) => onMintAmountChange(Math.max(1, parseInt(e.target.value) || 1))}
        min={1}
        disabled={isRunning}
        scale="sm"
        className="w-20"
      />
      <Button onClick={onMint} disabled={isRunning || mintAmount <= 0} variant="blue" size="sm">
        Mint
      </Button>
      <Input
        type="number"
        value={sendAmount}
        onChange={(e) => onSendAmountChange(Math.max(1, parseInt(e.target.value) || 1))}
        min={1}
        disabled={isRunning || !canSend}
        scale="sm"
        className="w-20"
        placeholder="Amount"
      />
      <Button
        onClick={onSend}
        disabled={isRunning || !canSend}
        variant="green"
        size="sm"
        title={!canSend ? 'Connect a wallet to send tokens' : undefined}
      >
        Send
      </Button>
    </>
  );
}
