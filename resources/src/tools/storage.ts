import { stackitGet } from '../api/client.js';

interface Bucket {
  bucket?: string;
  name?: string;
  region?: string;
  urlPathStyle?: string;
}

export async function listObjectStorage(projectId: string) {
  try {
    const data = await stackitGet<{ buckets?: Bucket[] }>(
      'objectStorage', `/v1/project/${projectId}/buckets`
    );
    return {
      buckets: (data.buckets ?? []).map(b => ({
        name: b.bucket ?? b.name,
        region: b.region,
        url: b.urlPathStyle,
      })),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('404') || msg.includes('not_found') || msg.includes('not enabled')) {
      return { buckets: [], note: 'Object Storage not enabled in this project.' };
    }
    throw e;
  }
}
