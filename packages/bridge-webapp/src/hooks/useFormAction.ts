import { useActionState } from 'react';

interface FormActionState<T> {
  result: T | null;
  error: string | null;
}

/**
 * Hook for form submissions. Wraps `useActionState` with try/catch
 * so callers get `[{ result, error }, formAction, isPending]`.
 */
export function useFormAction<T>(action: () => Promise<T>) {
  return useActionState<FormActionState<T>, FormData>(
    async () => {
      try {
        return { result: await action(), error: null };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    },
    { result: null, error: null }
  );
}
