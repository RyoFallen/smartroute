import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { OptimizeRequest, OptimizeResponse } from '@smartroute/shared';
import { postOptimize } from '../api/optimize';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: OptimizeResponse }
  | { status: 'error'; message: string };

export function useOptimize() {
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = useCallback(
    async (req: OptimizeRequest) => {
      setState({ status: 'loading' });
      try {
        const data = await postOptimize(req, () => getToken());
        setState({ status: 'success', data });
      } catch (e) {
        setState({ status: 'error', message: (e as Error).message });
      }
    },
    [getToken],
  );

  return { state, run };
}
