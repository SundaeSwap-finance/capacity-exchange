import type { TutorialStep } from '../hooks/useTutorialState';

const STEPS: TutorialStep[] = [0, 1, 2, 3];
const LABELS = ['WALLET', 'SPONSOR', 'REGISTER', 'PLAYGROUND'];

interface StepIndicatorProps {
  currentStep: TutorialStep;
  completedSteps: Set<TutorialStep>;
  onStepClick?: (step: TutorialStep) => void;
}

export function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {STEPS.map((step) => {
        const isCurrent = step === currentStep;
        const isCompleted = completedSteps.has(step);
        const isClickable = isCompleted && onStepClick;

        return (
          <button
            key={step}
            onClick={isClickable ? () => onStepClick(step) : undefined}
            disabled={!isClickable}
            className={`group inline-flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors disabled:cursor-default ${
              isClickable ? 'hover:bg-ces-accent' : ''
            }`}
          >
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.26em] transition-colors ${
                isCurrent
                  ? 'text-ces-text'
                  : isCompleted
                    ? 'text-ces-text group-hover:text-white'
                    : 'text-ces-text-muted/40'
              }`}
            >
              {LABELS[step]}
            </span>
            <span
              className={`font-mono text-[9px] leading-none tracking-[0.2em] transition-colors ${
                isCurrent
                  ? 'text-ces-text'
                  : isCompleted
                    ? 'text-ces-text-muted group-hover:text-white'
                    : 'text-ces-text-muted/25'
              }`}
            >
              [0{step + 1}]
            </span>
          </button>
        );
      })}
    </div>
  );
}
