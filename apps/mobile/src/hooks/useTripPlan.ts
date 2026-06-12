import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { TripPlanResponse } from '@smartroute/shared';
import { getTripPlan } from '../api/plan';

export function useTripPlan(id: string) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTripPlan(id, () => getTokenRef.current())
      .then((p) => active && setPlan(p))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id]);

  return { plan, error };
}
