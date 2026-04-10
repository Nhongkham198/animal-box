import { useState, useCallback } from 'react';

export function useAsyncError() {
  const [_, setError] = useState<Error | null>(null);

  return useCallback((e: unknown) => {
    setError(() => {
      if (e instanceof Error) throw e;
      throw new Error(String(e));
    });
  }, []);
}
