import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('partnerGet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls the correct URL with Authorization header', async () => {
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'test-token-xyz',
    }));

    const mockResponse = { customers: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { partnerGet } = await import('../src/api/client.js');
    const result = await partnerGet('/v3/costs/org123/customers?from=2026-05-01&to=2026-05-31&granularity=monthly');

    expect(fetch).toHaveBeenCalledWith(
      'https://cost.api.stackit.cloud/v3/costs/org123/customers?from=2026-05-01&to=2026-05-31&granularity=monthly',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-xyz',
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-OK response with status and body', async () => {
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'tok',
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response);

    const { partnerGet } = await import('../src/api/client.js');
    await expect(partnerGet('/v3/costs/org/customers')).rejects.toThrow('403');
  });
});
