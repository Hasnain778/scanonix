"use client";

import { useCallback, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [state, setState] = useState<AsyncState<TResult>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(
    async (...args: TArgs) => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const data = await action(...args);
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error(String(error));
        setState({ data: null, error: normalized, isLoading: false });
        throw normalized;
      }
    },
    [action],
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}
