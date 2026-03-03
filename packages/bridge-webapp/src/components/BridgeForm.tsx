import { ActionButton } from './ActionButton';

interface BridgeFormProps {
  onSubmit: () => void;
  disabledReasons: string[];
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
  result?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}

export function BridgeForm({
  onSubmit,
  disabledReasons,
  loading,
  submitLabel,
  loadingLabel,
  result,
  error,
  children,
}: BridgeFormProps) {
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        {children}

        <ActionButton
          type="submit"
          label={submitLabel}
          loadingLabel={loadingLabel}
          loading={loading}
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
