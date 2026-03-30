import type { TutorialStep } from '../hooks/useTutorialState';

const STEPS: TutorialStep[] = [0, 1, 2, 3];
const LABELS = ['Connect', 'Sponsor', 'Exchange', 'Explore'];

interface StepIndicatorProps {
  currentStep: TutorialStep;
  completedSteps: Set<TutorialStep>;
  onStepClick?: (step: TutorialStep) => void;
}

export function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 justify-center">
      {STEPS.map((step) => {
        const isCurrent = step === currentStep;
        const isCompleted = completedSteps.has(step);
        const isClickable = isCompleted && onStepClick;

        return (
          <button
            key={step}
            onClick={isClickable ? () => onStepClick(step) : undefined}
            disabled={!isClickable}
            className="flex items-center gap-1.5 group disabled:cursor-default"
          >
            <div className={isCurrent ? 'ces-dot-active' : isCompleted ? 'ces-dot-completed' : 'ces-dot'} />
            <span
              className={`text-xs font-medium transition-colors ${
                isCurrent
                  ? 'text-ces-accent'
                  : isCompleted
                    ? 'text-ces-accent/40 group-hover:text-ces-accent/60'
                    : 'text-ces-text-muted/40'
              }`}
            >
              {LABELS[step]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
