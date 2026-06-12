import type { TripPlanResponse } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function getTripPlan(id: string, getToken: GetToken): Promise<TripPlanResponse> {
  return apiFetch<TripPlanResponse>(`/trips/${id}/plan`, { method: 'GET' }, getToken);
}
