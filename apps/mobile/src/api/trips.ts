import type { Trip, CreateTripRequest } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function createTrip(body: CreateTripRequest, getToken: GetToken): Promise<Trip> {
  return apiFetch<Trip>(
    '/trips',
    { method: 'POST', body: JSON.stringify(body) },
    getToken,
  );
}

export function listTrips(getToken: GetToken): Promise<Trip[]> {
  return apiFetch<Trip[]>('/trips', { method: 'GET' }, getToken);
}

export function getTrip(id: string, getToken: GetToken): Promise<Trip> {
  return apiFetch<Trip>(`/trips/${id}`, { method: 'GET' }, getToken);
}
