import { createEstimate } from '../estimate/store.js';

interface CreateEstimateInput {
  name?: string;
}

export async function handleCreateEstimate(input: CreateEstimateInput) {
  const estimate = createEstimate(input.name ?? 'My Estimate');
  return {
    estimate_id: estimate.id,
    name: estimate.name,
  };
}
