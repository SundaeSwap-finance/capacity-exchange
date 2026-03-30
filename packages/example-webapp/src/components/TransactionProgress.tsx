interface ProgressStep {
  label: string;
  status: 'waiting' | 'active' | 'done';
}

interface TransactionProgressProps {
  steps: ProgressStep[];
}

export function TransactionProgress({ steps }: TransactionProgressProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          {/* Vertical line connector */}
          {i < steps.length - 1 && (
            <div
              className={`absolute left-[9px] top-[22px] w-0.5 h-[calc(100%-2px)] ${
                step.status === 'done' ? 'bg-ces-accent/40' : 'bg-ces-border'
              }`}
            />
          )}

          {/* Status icon */}
          <div className="relative z-10 mt-0.5 flex-shrink-0">
            {step.status === 'done' && (
              <div className="w-[18px] h-[18px] rounded-full bg-ces-accent/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-ces-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {step.status === 'active' && (
              <div className="w-[18px] h-[18px] rounded-full border-2 border-ces-accent/30 border-t-ces-accent animate-spin" />
            )}
            {step.status === 'waiting' && <div className="w-[18px] h-[18px] rounded-full border-2 border-ces-border" />}
          </div>

          {/* Label */}
          <span
            className={`text-sm py-1 ${
              step.status === 'active'
                ? 'text-ces-text'
                : step.status === 'done'
                  ? 'text-ces-accent/60'
                  : 'text-ces-text-muted/40'
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
