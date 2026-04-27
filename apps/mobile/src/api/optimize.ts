import type { OptimizeRequest, OptimizeResponse } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function postOptimize(
  body: OptimizeRequest,
  getToken: GetToken,
): Promise<OptimizeResponse> {
  return apiFetch<OptimizeResponse>(
    '/optimize',
    { method: 'POST', body: JSON.stringify(body) },
    getToken,
  );
}
