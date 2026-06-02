import { stackitGet } from '../api/client.js';

interface Bucket {
  bucket?: string;
  name?: string;
  region?: string;
  urlPathStyle?: string;
}

export async function listObjectStorage(projectId: string) {
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
}
