import { ActionButton } from './ActionButton';

interface BridgeFormProps {
  action: (formData: FormData) => void;
  disabledReasons: string[];
  isPending: boolean;
  submitLabel: string;
  loadingLabel: string;
  result?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}

export function BridgeForm({
  action,
  disabledReasons,
  isPending,
  submitLabel,
  loadingLabel,
  result,
  error,
  children,
}: BridgeFormProps) {
  return (
    <>
      <form action={action} className="space-y-4">
        {children}

        <ActionButton
          type="submit"
          label={submitLabel}
          loadingLabel={loadingLabel}
          loading={isPending}
          disabled={disabledReasons.length > 0}
        />
        {disabledReasons.length > 0 && (
          <p className="text-muted-xs whitespace-pre-line">{disabledReasons.join('\n')}</p>
        )}
      </form>

      {result}
      {error && <div className="alert-error">{error}</div>}
    </>
  );
}
