import { useState } from 'react';

type Submitter<T, TArgs> = (args: TArgs) => Promise<T>;

export function useSubmit<T, TArgs>(submitter: Submitter<T, TArgs>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const submit = async (args: TArgs) => {
    setSubmitting(true);
    try {
      const response = await submitter(args);
      setData(response);
      setError(null);
      return response;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, data, error };
}
