import type { StackitSku, ServiceDefinition, FieldOption } from '../types.js';

export type ServiceRegistry = Map<string, ServiceDefinition>;

const SERVICE_META: Record<string, { description: string; calculator_type: string }> = {
  'server': { description: 'STACKIT Server (includes 64 GB boot volume)', calculator_type: 'server' },
  'object-storage': { description: 'S3-compatible object storage', calculator_type: 'object-storage' },
  'ske': { description: 'Managed Kubernetes Engine clusters', calculator_type: 'kubernetes-engine' },
  'database-postgres': { description: 'Managed PostgreSQL Flex instances', calculator_type: 'postgresql' },
  'database-mariadb': { description: 'Managed MariaDB instances', calculator_type: 'mariadb' },
  'database-redis': { description: 'Managed Redis instances', calculator_type: 'redis' },
  'load-balancer': { description: 'Application Load Balancer (includes 2× c2i.1 compute nodes)', calculator_type: 'load-balancer' },
  'public-ip': { description: 'Public IPv4 addresses', calculator_type: 'public-ip' },
  'block-storage': { description: 'Persistent block storage volumes', calculator_type: 'block-storage' },
};

// Default boot volume bundled with every server: 64 GB, Performance Class 0
// Two SKUs: capacity (per GB-hour) + performance tier (flat per hour)
const BOOT_VOLUME_GB = 64;

function parseMonthlyPrice(sku: StackitSku): number {
  return parseFloat(sku.monthlyPrice) || 0;
}

function bootVolumeMonthlyPrice(skus: StackitSku[]): number {
  const capacity = skus.find(s =>
    s.name === 'Block Storage for disk volumes Premium-Capacity-EU01' && s.deprecated === 'No'
  );
  const perf0 = skus.find(s =>
    s.name === 'Block Storage for disk volumes Premium-Performance 0-EU01' && s.deprecated === 'No'
  );
  const capPrice = capacity ? parseMonthlyPrice(capacity) * BOOT_VOLUME_GB : 0;
  const perfPrice = perf0 ? parseMonthlyPrice(perf0) : 0;
  return capPrice + perfPrice;
}

function buildServerDefinition(skus: StackitSku[]): ServiceDefinition {
  const bootPrice = bootVolumeMonthlyPrice(skus);

  const flavorSkus = skus.filter(s =>
    s.product === 'Server' &&
    s.deprecated === 'No' &&
    s.attributes['metro'] === false &&
    typeof s.attributes['flavor'] === 'string'
  );

  // Flavors sorted by vCPU gen (g2i/g3i first), then by price
  const GEN_ORDER = ['g3i', 'g2i', 'c3i', 'c2i', 'm3i', 'm2i', 'g1', 'c1', 'm1', 't'];
  const genRank = (id: string) => {
    const idx = GEN_ORDER.findIndex(p => id.startsWith(p));
    return idx === -1 ? 99 : idx;
  };

  const options: FieldOption[] = flavorSkus.map(s => ({
    id: s.attributes['flavor'] as string,
    label: `${s.attributes['flavor']} (${s.attributes['vCPU']} vCPU, ${s.attributes['ram']} GB RAM)`,
    // Include boot volume cost so price matches calculator 1:1
    price_month: parseMonthlyPrice(s) + bootPrice,
    attributes: s.attributes,
  })).sort((a, b) => {
    const ra = genRank(a.id), rb = genRank(b.id);
    if (ra !== rb) return ra - rb;
    return a.price_month - b.price_month;
  });

  return {
    service_key: 'server',
    name: 'STACKIT Server',
    category: 'Compute Engine',
    description: SERVICE_META['server'].description,
    calculator_type: SERVICE_META['server'].calculator_type,
    fields: [
      { id: 'flavor', type: 'dropdown', label: 'Instance Flavor', options, required: true },
      { id: 'quantity', type: 'number', label: 'Quantity', default: 1, required: true },
    ],
  };
}

function buildObjectStorageDefinition(skus: StackitSku[]): ServiceDefinition {
  const sku = skus.find(s =>
    s.product === 'Object Storage' &&
    s.deprecated === 'No' &&
    !s.name.includes('Archiving')
  );
  const pricePerGbMonth = sku ? parseFloat(sku.price) * 24 * 30 : 0;

  return {
    service_key: 'object-storage',
    name: 'Object Storage',
    category: 'Storage',
    description: SERVICE_META['object-storage'].description,
    calculator_type: SERVICE_META['object-storage'].calculator_type,
    fields: [
      { id: 'storage_gb', type: 'number', label: 'Storage (GB)', price_per_gb_month: pricePerGbMonth, default: 100, required: true },
    ],
  };
}

function buildSkeDefinition(skus: StackitSku[]): ServiceDefinition {
  const clusterSku = skus.find(s =>
    s.product === 'Kubernetes Engine' &&
    s.name.includes('Cluster Management') &&
    s.deprecated === 'No'
  );
  const clusterPrice = clusterSku ? parseMonthlyPrice(clusterSku) : 0;

  return {
    service_key: 'ske',
    name: 'STACKIT Kubernetes Engine',
    category: 'Developer Platform',
    description: SERVICE_META['ske'].description,
    calculator_type: SERVICE_META['ske'].calculator_type,
    fields: [
      { id: 'clusters', type: 'number', label: 'Number of Clusters', default: 1, price_month: clusterPrice, required: true },
    ],
  };
}

function buildDatabaseDefinition(serviceKey: string, product: string, skus: StackitSku[]): ServiceDefinition {
  const dbSkus = skus.filter(s => s.product === product && s.deprecated === 'No');
  const options: FieldOption[] = dbSkus.map(s => ({
    id: s.name,
    label: s.name.replace(/-EU01$/, '').replace(`${product}-`, ''),
    price_month: parseMonthlyPrice(s),
  })).sort((a, b) => a.price_month - b.price_month).slice(0, 8);

  const meta = SERVICE_META[serviceKey];
  return {
    service_key: serviceKey,
    name: product,
    category: 'Database',
    description: meta?.description ?? product,
    calculator_type: meta?.calculator_type ?? serviceKey,
    fields: [
      { id: 'plan', type: 'dropdown', label: 'Plan', options, required: true },
      { id: 'quantity', type: 'number', label: 'Instances', default: 1, required: true },
    ],
  };
}

function buildAlbDefinition(skus: StackitSku[]): ServiceDefinition {
  const albSku = skus.find(s => s.product === 'Application Load Balancer' && s.deprecated === 'No');
  const albPrice = albSku ? parseMonthlyPrice(albSku) : 0;

  // ALB requires 2× c2i.1 compute nodes (mandatory, shown in calculator)
  const nodeSku = skus.find(s =>
    s.attributes?.['flavor'] === 'c2i.1' &&
    s.deprecated === 'No' &&
    s.attributes?.['metro'] === false
  );
  const nodePrice = nodeSku ? parseMonthlyPrice(nodeSku) * 2 : 0;

  return {
    service_key: 'load-balancer',
    name: 'Application Load Balancer',
    category: 'Networking',
    description: SERVICE_META['load-balancer'].description,
    calculator_type: SERVICE_META['load-balancer'].calculator_type,
    fields: [
      { id: 'quantity', type: 'number', label: 'Quantity', default: 1, price_month: albPrice + nodePrice, required: true },
    ],
  };
}

function buildSimpleDefinition(serviceKey: string, product: string, skus: StackitSku[]): ServiceDefinition {
  const sku = skus.find(s => s.product === product && s.deprecated === 'No');
  const price = sku ? parseMonthlyPrice(sku) : 0;
  const meta = SERVICE_META[serviceKey];

  return {
    service_key: serviceKey,
    name: product,
    category: sku?.category ?? 'Other',
    description: meta?.description ?? product,
    calculator_type: meta?.calculator_type ?? serviceKey,
    fields: [
      { id: 'quantity', type: 'number', label: 'Quantity', default: 1, price_month: price, required: true },
    ],
  };
}

function buildBlockStorageDefinition(skus: StackitSku[]): ServiceDefinition {
  const sku = skus.find(s =>
    s.product === 'Block Storage' &&
    s.deprecated === 'No' &&
    s.name === 'Block Storage for disk volumes Premium-Capacity-EU01'
  );
  const pricePerGbMonth = sku ? parseMonthlyPrice(sku) : 0;
  const meta = SERVICE_META['block-storage'];

  return {
    service_key: 'block-storage',
    name: 'Block Storage',
    category: 'Storage',
    description: meta.description,
    calculator_type: meta.calculator_type,
    fields: [
      { id: 'storage_gb', type: 'number', label: 'Storage (GB)', price_per_gb_month: pricePerGbMonth, default: 100, required: true },
    ],
  };
}

export function buildRegistry(skus: StackitSku[]): ServiceRegistry {
  const registry = new Map<string, ServiceDefinition>();
  registry.set('server', buildServerDefinition(skus));
  registry.set('object-storage', buildObjectStorageDefinition(skus));
  registry.set('ske', buildSkeDefinition(skus));
  registry.set('database-postgres', buildDatabaseDefinition('database-postgres', 'PostgreSQL Flex', skus));
  registry.set('database-mariadb', buildDatabaseDefinition('database-mariadb', 'MariaDB', skus));
  registry.set('database-redis', buildDatabaseDefinition('database-redis', 'Redis', skus));
  registry.set('load-balancer', buildAlbDefinition(skus));
  registry.set('public-ip', buildSimpleDefinition('public-ip', 'Public IP Address', skus));
  registry.set('block-storage', buildBlockStorageDefinition(skus));
  return registry;
}

export function searchServices(registry: ServiceRegistry, query: string): ServiceDefinition[] {
  const q = query.toLowerCase();
  return [...registry.values()].filter(s =>
    s.service_key.includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  );
}

export function getServiceDefinition(registry: ServiceRegistry, serviceKey: string): ServiceDefinition | null {
  return registry.get(serviceKey) ?? null;
}
