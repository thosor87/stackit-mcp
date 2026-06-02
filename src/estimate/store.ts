import { randomUUID } from 'node:crypto';
import type { Estimate, EstimateService } from '../types.js';

const estimates = new Map<string, Estimate>();

export function createEstimate(name: string = 'My Estimate'): Estimate {
  const estimate: Estimate = {
    id: randomUUID(),
    name,
    services: [],
    createdAt: new Date().toISOString(),
  };
  estimates.set(estimate.id, estimate);
  return estimate;
}

export function getEstimate(id: string): Estimate | undefined {
  return estimates.get(id);
}

export function addServiceToEstimate(id: string, service: EstimateService): Estimate {
  const estimate = estimates.get(id);
  if (!estimate) throw new Error(`Estimate ${id} not found`);
  estimate.services.push(service);
  return estimate;
}

export function resetStore(): void {
  estimates.clear();
}
