import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `getAccessToken` probiert vier Quellen in fester Reihenfolge: Cache, STACKIT-
 * CLI-Auth-Storage, SA-Key aus der Env, CLI-`credentials.json`. Die Reihenfolge
 * und die Ablauf-Karenz von 60 s sind das Verhalten, auf das sich die Tools
 * verlassen — beides wird hier festgehalten.
 */

const HOUR = 3_600_000;

/** fs-Mock, der nur die explizit angegebenen Pfade kennt. */
function mockFs(files: Record<string, string>) {
  vi.doMock('fs', () => ({
    readFileSync: (p: string) => {
      const hit = Object.keys(files).find((k) => String(p).endsWith(k));
      if (!hit) throw new Error('ENOENT');
      return files[hit];
    },
    existsSync: (p: string) => Object.keys(files).some((k) => String(p).endsWith(k)),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }));
}

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
    // Ein gesetzter SA-Key-Pfad in der echten Umgebung würde die Tests
    // unterlaufen lassen.
    vi.stubEnv('STACKIT_SERVICE_ACCOUNT_KEY_PATH', '');
    vi.stubEnv('STACKIT_PRIVATE_KEY_PATH', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('wirft ohne jede Token-Quelle einen Hinweis auf auth_login', async () => {
    mockFs({});
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('liefert das Access-Token aus einem gültigen Cache', async () => {
    mockFs({
      'auth.json': JSON.stringify({ access_token: 'tok123', expires_at: Date.now() + HOUR }),
    });
    const { getAccessToken } = await import('../src/auth/token.js');
    expect(await getAccessToken()).toBe('tok123');
  });

  it('verwirft einen abgelaufenen Cache-Eintrag', async () => {
    mockFs({
      'auth.json': JSON.stringify({ access_token: 'alt', expires_at: Date.now() - HOUR }),
    });
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('verwirft ein Token, das innerhalb der 60-s-Karenz abläuft', async () => {
    mockFs({
      'auth.json': JSON.stringify({ access_token: 'knapp', expires_at: Date.now() + 30_000 }),
    });
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('liest den base64-kodierten Auth-Storage der STACKIT-CLI', async () => {
    const storage = Buffer.from(
      JSON.stringify({
        access_token: 'cli-tok',
        session_expires_at_unix: Math.floor((Date.now() + HOUR) / 1000),
      }),
    ).toString('base64');
    mockFs({ 'cli-auth-storage.txt': storage });
    const { getAccessToken } = await import('../src/auth/token.js');
    expect(await getAccessToken()).toBe('cli-tok');
  });

  it('ignoriert kaputten Cache-Inhalt statt zu crashen', async () => {
    mockFs({ 'auth.json': 'kein json' });
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });
});
