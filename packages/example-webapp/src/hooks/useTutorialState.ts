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

const GRADUATION_KEY = 'ces-demo-graduation';

interface GraduationFlags {
  hasMintedTokens: boolean;
  hasUsedCes: boolean;
}

function loadGraduation(): GraduationFlags {
  try {
    const raw = localStorage.getItem(GRADUATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        hasMintedTokens: !!parsed.hasMintedTokens,
        hasUsedCes: !!parsed.hasUsedCes,
      };
    }
  } catch { /* ignore */ }
  return { hasMintedTokens: false, hasUsedCes: false };
}

function saveGraduation(flags: GraduationFlags) {
  try {
    localStorage.setItem(GRADUATION_KEY, JSON.stringify(flags));
  } catch { /* ignore */ }
}

const STEP_FLOW: Array<{ step: TutorialStep; substep: Substep }> = [
  { step: 0, substep: 'a' },
  { step: 1, substep: 'b' },
  { step: 2, substep: 'b' },
  { step: 3, substep: 'a' },
  { step: 3, substep: 'b' },
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

      // Mark all steps between current and target as completed so
      // sidebar tabs stay enabled regardless of jump direction.
      const completedSteps = new Set(state.completedSteps);
      const lo = Math.min(curIdx, targetIdx);
      const hi = Math.max(curIdx, targetIdx);
      for (let i = lo; i <= hi; i++) {
        completedSteps.add(STEP_FLOW[i].step);
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

    case 'MARK_MINTED': {
      const next = { ...state, hasMintedTokens: true };
      saveGraduation({ hasMintedTokens: next.hasMintedTokens, hasUsedCes: next.hasUsedCes });
      return next;
    }

    case 'MARK_CES_USED': {
      const next = { ...state, hasUsedCes: true };
      saveGraduation({ hasMintedTokens: next.hasMintedTokens, hasUsedCes: next.hasUsedCes });
      return next;
    }

    default:
      return state;
  }
}

function createInitialState(): TutorialState {
  const saved = loadGraduation();
  return {
    step: 0,
    substep: 'a',
    direction: 'forward',
    animKey: 0,
    completedSteps: new Set(),
    hasMintedTokens: saved.hasMintedTokens,
    hasUsedCes: saved.hasUsedCes,
  };
}

export function useTutorialState() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);

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
