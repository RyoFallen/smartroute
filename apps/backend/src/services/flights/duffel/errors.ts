export type DuffelErrorClass = 'auth' | 'rate_limit' | 'validation' | 'network' | 'unknown';

interface DuffelErrorShape {
  meta?: { status?: number };
  errors?: Array<{ code?: string }>;
}

export function classifyDuffelError(err: unknown): DuffelErrorClass {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as DuffelErrorShape & { code?: string; name?: string };
  const status = e.meta?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 422) return 'validation';

  // Network-layer errors (node-fetch / undici) don't carry meta.status.
  const code = e.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_SOCKET' ||
    e.name === 'AbortError' ||
    e.name === 'FetchError'
  ) {
    return 'network';
  }

  return 'unknown';
}

export function isRetryable(cls: DuffelErrorClass): boolean {
  return cls === 'rate_limit' || cls === 'network';
}
