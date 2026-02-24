import { useState, useCallback } from 'react';

export interface SubmitState {
  submitting: boolean;
  label: string | null;
  error: string | null;
}

const INITIAL_STATE: SubmitState = { submitting: false, label: null, error: null };

function startState(name: string): SubmitState {
  return { submitting: true, label: name, error: null };
}

function doneState(): SubmitState {
  return INITIAL_STATE;
}

function errorState(e: unknown): SubmitState {
  return { submitting: false, label: null, error: e instanceof Error ? e.message : String(e) };
}

async function execute<T>(operation: () => Promise<T>, onSuccess?: (data: T) => void): Promise<string | null> {
  try {
    const result = await operation();
    onSuccess?.(result);
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function useSubmit() {
  const [state, setState] = useState<SubmitState>(INITIAL_STATE);

  const run = useCallback(
    async <T>(name: string, operation: () => Promise<T>, onSuccess?: (data: T) => void): Promise<void> => {
      setState(startState(name));
      const error = await execute(operation, onSuccess);
      setState(error ? errorState(error) : doneState());
    },
    []
  );

  return { run, state };
}
