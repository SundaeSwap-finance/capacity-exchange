interface ActionButtonProps {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}

export function ActionButton({ label, loadingLabel, loading, disabled, type = 'button', onClick }: ActionButtonProps) {
  return (
    <button type={type} className="btn-primary" disabled={disabled || loading} onClick={onClick}>
      {loading ? loadingLabel : label}
    </button>
  );
}
