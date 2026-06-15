import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws when no token is cached', async () => {
    vi.doMock('fs', () => ({
      readFileSync: () => { throw new Error('ENOENT'); },
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      existsSync: () => false,
    }));
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('returns access_token from valid cached token', async () => {
    const futureExpiry = Date.now() + 3_600_000;
    vi.doMock('fs', () => ({
      readFileSync: () => JSON.stringify({ access_token: 'tok123', expires_at: futureExpiry }),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      existsSync: () => true,
    }));
    const { getAccessToken } = await import('../src/auth/token.js');
    expect(await getAccessToken()).toBe('tok123');
  });
});
