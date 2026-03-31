import { useReducer, useCallback } from 'react';

export type TutorialStep = 0 | 1 | 2 | 3;
export type Substep = 'a' | 'b';
export type Direction = 'forward' | 'back';

export interface TutorialState {
  step: TutorialStep;
  substep: Substep;
  direction: Direction;
  animKey: number;
  completedSteps: Set<TutorialStep>;
  hasMintedTokens: boolean;
  hasUsedCes: boolean;
}

type Action =
  | { type: 'ADVANCE' }
  | { type: 'GO_BACK' }
  | { type: 'JUMP_TO'; step: TutorialStep; substep?: Substep }
  | { type: 'MARK_MINTED' }
  | { type: 'MARK_CES_USED' };

const STEP_FLOW: Array<{ step: TutorialStep; substep: Substep }> = [
  { step: 0, substep: 'a' },
  { step: 1, substep: 'b' },
  { step: 2, substep: 'b' },
  { step: 3, substep: 'a' },
];

function flowIndex(step: TutorialStep, substep: Substep): number {
  return STEP_FLOW.findIndex((s) => s.step === step && s.substep === substep);
}

function defaultSubstepForStep(step: TutorialStep): Substep {
  return STEP_FLOW.find((entry) => entry.step === step)?.substep ?? 'a';
}

function reducer(state: TutorialState, action: Action): TutorialState {
  switch (action.type) {
    case 'ADVANCE': {
      const idx = flowIndex(state.step, state.substep);
      const next = STEP_FLOW[idx + 1];
      if (!next) {return state;}

      const completedSteps = new Set(state.completedSteps);
      if (next.step !== state.step) {
        completedSteps.add(state.step);
      }

      return {
        ...state,
        step: next.step,
        substep: next.substep,
        direction: 'forward',
        animKey: state.animKey + 1,
        completedSteps,
      };
    }

    case 'GO_BACK': {
      const idx = flowIndex(state.step, state.substep);
      const prev = STEP_FLOW[idx - 1];
      if (!prev) {return state;}

      return {
        ...state,
        step: prev.step,
        substep: prev.substep,
        direction: 'back',
        animKey: state.animKey + 1,
      };
    }

    case 'JUMP_TO': {
      const curIdx = flowIndex(state.step, state.substep);
      const targetSubstep = action.substep ?? defaultSubstepForStep(action.step);
      const targetIdx = flowIndex(action.step, targetSubstep);

      // When jumping backward, mark all steps up to and including
      // the current step as completed so forward tabs stay enabled.
      const completedSteps = new Set(state.completedSteps);
      if (targetIdx < curIdx) {
        for (let i = targetIdx; i <= curIdx; i++) {
          completedSteps.add(STEP_FLOW[i].step);
        }
      }

      return {
        ...state,
        step: action.step,
        substep: targetSubstep,
        direction: targetIdx >= curIdx ? 'forward' : 'back',
        animKey: state.animKey + 1,
        completedSteps,
      };
    }

    case 'MARK_MINTED':
      return { ...state, hasMintedTokens: true };

    case 'MARK_CES_USED':
      return { ...state, hasUsedCes: true };

    default:
      return state;
  }
}

const initialState: TutorialState = {
  step: 0,
  substep: 'a',
  direction: 'forward',
  animKey: 0,
  completedSteps: new Set(),
  hasMintedTokens: false,
  hasUsedCes: false,
};

export function useTutorialState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const advance = useCallback(() => dispatch({ type: 'ADVANCE' }), []);
  const goBack = useCallback(() => dispatch({ type: 'GO_BACK' }), []);
  const jumpTo = useCallback(
    (step: TutorialStep, substep?: Substep) => dispatch({ type: 'JUMP_TO', step, substep }),
    []
  );
  const markMinted = useCallback(() => dispatch({ type: 'MARK_MINTED' }), []);
  const markCesUsed = useCallback(() => dispatch({ type: 'MARK_CES_USED' }), []);

  return { state, advance, goBack, jumpTo, markMinted, markCesUsed };
}
