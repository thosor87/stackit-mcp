// Raw SKU from pim.api.stackit.cloud/v1/skus
export interface StackitSku {
  id: string;
  sku: string;
  title: string;
  name: string;
  region: string;
  category: string;
  product: string;
  unit: string;
  unitBilling: string;
  price: string;           // price per unit (e.g. per hour)
  monthlyPrice: string;    // pre-calculated monthly price
  currency: string;
  maturityModelState: string;
  deprecated: string;
  attributes: Record<string, unknown>;
  generalProductGroup: string | null;
}

export interface PimApiResponse {
  lastUpdatedAt: string;
  services: StackitSku[];
}

export type PriceSource = 'live' | 'cache' | 'bundle';

export interface PriceMeta {
  source: PriceSource;
  date: string;
  lastUpdatedAt: string;
}

export interface PriceData {
  meta: PriceMeta;
  skus: StackitSku[];
}

export interface ServiceResult {
  service_key: string;
  name: string;
  category: string;
  description: string;
}

export interface FieldOption {
  id: string;
  label: string;
  price_month: number;
  attributes?: Record<string, unknown>;
}

export interface ServiceField {
  id: string;
  type: 'dropdown' | 'number';
  label: string;
  options?: FieldOption[];
  price_per_gb_month?: number;
  price_month?: number;
  default?: number;
  unit?: string;
  required?: boolean;
}

export interface ServiceDefinition {
  service_key: string;
  name: string;
  category: string;
  description: string;
  calculator_type: string;   // used in calculator.stackit.cloud URL
  fields: ServiceField[];
}

export interface EstimateService {
  service_key: string;
  service_name: string;
  group: string;
  config: Record<string, unknown>;
  monthly_cost_eur: number;
}

export interface Estimate {
  id: string;
  name: string;
  services: EstimateService[];
  createdAt: string;
}
