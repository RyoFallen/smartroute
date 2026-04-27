jest.mock('../../src/config', () => ({
  config: { apiUrl: 'http://test', clerkPublishableKey: 'pk_test' },
}));

import { apiFetch, ApiClientError } from '../../src/api/client';

const getToken = async () => 'tok_abc';

describe('apiFetch', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('attaches bearer token and parses JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    const out = await apiFetch<{ hello: string }>('/x', {}, getToken);
    expect(out).toEqual({ hello: 'world' });
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer tok_abc');
  });

  it('throws ApiClientError with envelope code on non-2xx', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'INVALID_INPUT', message: 'bad' } }),
    });
    await expect(apiFetch('/x', {}, getToken)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      status: 400,
    });
  });

  it('throws UNKNOWN on missing token', async () => {
    await expect(apiFetch('/x', {}, async () => null)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
