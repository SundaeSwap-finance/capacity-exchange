import type { ReactNode } from 'react';
import { StepIndicator } from './StepIndicator';
import type { TutorialStep } from '../hooks/useTutorialState';

interface TutorialShellProps {
  currentStep: TutorialStep;
  completedSteps: Set<TutorialStep>;
  networkId: string;
  onStepClick?: (step: TutorialStep) => void;
  children: ReactNode;
}

export function TutorialShell({ currentStep, completedSteps, networkId, onStepClick, children }: TutorialShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-lg text-ces-text">Capacity Exchange</h1>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-ces-surface-raised text-ces-text-muted border border-ces-border">
            {networkId}
          </span>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="px-6 pb-6">
        <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={onStepClick} />
      </div>

      {/* Content */}
      <main className="flex-1 flex justify-center px-4 pb-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
