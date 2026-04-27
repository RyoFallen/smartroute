import { config } from '../config';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export type GetToken = () => Promise<string | null>;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  getToken: GetToken,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiClientError('UNAUTHENTICATED', 'No session token', 401);
  }
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiClientError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body.error?.details,
    );
  }
  return (await res.json()) as T;
}
