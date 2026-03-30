import type { ReactNode } from 'react';
import type { Direction } from '../hooks/useTutorialState';

interface StepTransitionProps {
  animKey: number;
  direction: Direction;
  children: ReactNode;
}

export function StepTransition({ animKey, direction, children }: StepTransitionProps) {
  return (
    <div key={animKey} className={direction === 'forward' ? 'ces-step-forward' : 'ces-step-back'}>
      {children}
    </div>
  );
}
