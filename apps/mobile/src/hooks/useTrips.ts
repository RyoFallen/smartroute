import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { Trip, CreateTripRequest } from '@smartroute/shared';
import { createTrip, getTrip, listTrips } from '../api/trips';

export function useTripsList() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await listTrips(() => getTokenRef.current()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trips, error, loading, refresh };
}

export function useTrip(id: string) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTrip(id, () => getTokenRef.current())
      .then((t) => active && setTrip(t))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id]);

  return { trip, error };
}

export function useCreateTrip() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  return useCallback(
    (body: CreateTripRequest) => createTrip(body, () => getTokenRef.current()),
    [],
  );
}
