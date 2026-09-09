import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `stackitGet`/`stackitPost` mappen einen Service-Key auf den passenden
 * STACKIT-API-Host. Ein falscher Host schickt das Bearer-Token an den falschen
 * Endpoint — deshalb ist die Zuordnung hier festgenagelt.
 */
describe('stackitGet', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'test-token-xyz',
    }));
  });

  it('ruft den Service-Host mit Authorization-Header auf', async () => {
    const payload = { items: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const { stackitGet } = await import('../src/api/client.js');
    const result = await stackitGet('resourceManager', '/v2/projects?offset=0');

    expect(fetch).toHaveBeenCalledWith(
      'https://resource-manager.api.stackit.cloud/v2/projects?offset=0',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-xyz',
          Accept: 'application/json',
        }),
      }),
    );
    expect(result).toEqual(payload);
  });

  it.each([
    ['resourceManager', 'https://resource-manager.api.stackit.cloud'],
    ['iaas', 'https://iaas.api.eu01.stackit.cloud'],
    ['postgresFlex', 'https://postgres-flex.api.eu01.stackit.cloud'],
    ['mariadb', 'https://mariadb.api.eu01.stackit.cloud'],
    ['redis', 'https://redis.api.eu01.stackit.cloud'],
    ['ske', 'https://ske.api.eu01.stackit.cloud'],
    ['objectStorage', 'https://object-storage.api.stackit.cloud'],
  ] as const)('nutzt für %s den Host %s', async (service, base) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { stackitGet } = await import('../src/api/client.js');
    await stackitGet(service, '/ping');

    expect(fetch).toHaveBeenCalledWith(`${base}/ping`, expect.anything());
  });

  it('wirft bei non-OK mit Status und URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response);

    const { stackitGet } = await import('../src/api/client.js');
    await expect(stackitGet('iaas', '/v1/servers')).rejects.toThrow(
      /403.*iaas\.api\.eu01\.stackit\.cloud\/v1\/servers/s,
    );
  });

  it('wirft auch, wenn der Fehler-Body nicht lesbar ist', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => { throw new Error('stream kaputt'); },
    } as unknown as Response);

    const { stackitGet } = await import('../src/api/client.js');
    await expect(stackitGet('ske', '/v1/clusters')).rejects.toThrow('500');
  });
});

describe('stackitPost', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'tok',
    }));
  });

  it('schickt den Body als JSON mit Content-Type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    const { stackitPost } = await import('../src/api/client.js');
    await stackitPost('iaas', '/v1/servers/abc/start', { force: true });

    expect(fetch).toHaveBeenCalledWith(
      'https://iaas.api.eu01.stackit.cloud/v1/servers/abc/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ force: true }),
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('wirft bei non-OK mit Status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'Conflict',
    } as unknown as Response);

    const { stackitPost } = await import('../src/api/client.js');
    await expect(stackitPost('iaas', '/v1/servers/abc/stop', {})).rejects.toThrow('409');
  });
});
