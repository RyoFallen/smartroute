import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { Trip, CreateTripRequest } from '@smartroute/shared';
import { createTrip, getTrip, listTrips } from '../api/trips';

export function useTripsList() {
  const { getToken } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await listTrips(() => getToken()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trips, error, loading, refresh };
}

export function useTrip(id: string) {
  const { getToken } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTrip(id, () => getToken())
      .then((t) => active && setTrip(t))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id, getToken]);

  return { trip, error };
}

export function useCreateTrip() {
  const { getToken } = useAuth();
  return useCallback(
    (body: CreateTripRequest) => createTrip(body, () => getToken()),
    [getToken],
  );
}
