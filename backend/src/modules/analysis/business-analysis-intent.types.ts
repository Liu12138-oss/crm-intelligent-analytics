import type { QueryConfidence, TemporalSlot } from '../../shared/types/domain';
import type { LianruanCrmOpenApiResource } from '../crm-standard-api/lianruan-crm-openapi.types';

export type BusinessObjectType =
  | 'opportunity'
  | 'registration'
  | 'quote'
  | 'order'
  | 'partner'
  | 'customer'
  | 'contract'
  | 'payment';

export type BusinessMetric =
  | 'count'
  | 'amount'
  | 'total_amount'
  | 'opportunity_count'
  | 'opportunity_amount'
  | 'registration_count'
  | 'quote_count'
  | 'quote_amount'
  | 'order_count'
  | 'order_amount'
  | 'contract_amount'
  | 'payment_amount'
  | 'conversion_rate'
  | 'win_rate'
  | 'partner_count'
  | 'technical_partner_count'
  | 'concentration_ratio'
  | 'unlinked_customer_count'
  | 'customer_age_days'
  | 'stale_opportunity_count'
  | 'inactive_customer_count';

export type BusinessDimension =
  | 'region'
  | 'big_region'
  | 'department'
  | 'owner'
  | 'partner'
  | 'customer'
  | 'month'
  | 'quarter'
  | 'year'
  | 'stage'
  | 'status'
  | 'partner_level'
  | 'is_technical_service_provider'
  | 'customer_category'
  | 'customer_age_bucket';

export type BusinessAnalysisMode =
  | 'single_metric'
  | 'ranking'
  | 'trend'
  | 'distribution'
  | 'detail'
  | 'comparison'
  | 'summary_report'
  | 'dashboard'
  | 'risk_analysis';

export type BusinessOutputPreference =
  | 'text_summary'
  | 'table'
  | 'chart'
  | 'wecom_image'
  | 'html_report'
  | 'export_file';

export interface BusinessFilter {
  field: BusinessDimension | 'keyword' | 'time';
  operator: 'eq' | 'contains' | 'in' | 'between';
  value: string | string[];
  label: string;
}

export interface BusinessEntity {
  type: BusinessObjectType | BusinessDimension | 'keyword';
  value: string;
  normalizedValue?: string;
}

export interface BusinessUnsupportedHint {
  resource: LianruanCrmOpenApiResource;
  field: string;
  label: string;
  reason: string;
}

export interface BusinessAnalysisIntent {
  objectTypes: BusinessObjectType[];
  metrics: BusinessMetric[];
  dimensions: BusinessDimension[];
  filters: BusinessFilter[];
  timeRange?: TemporalSlot;
  analysisMode: BusinessAnalysisMode;
  outputPreference: BusinessOutputPreference[];
  comparison: Array<'top_n' | 'year_over_year' | 'month_over_month' | 'period_over_period' | 'concentration' | 'funnel'>;
  sort?: {
    by: BusinessMetric | BusinessDimension;
    direction: 'ASC' | 'DESC';
  };
  limit?: number;
  entities: BusinessEntity[];
  confidence: QueryConfidence;
  missingConditions: string[];
  unsupportedHints: BusinessUnsupportedHint[];
  requestedAction: 'READONLY_ANALYSIS' | 'BLOCK';
  blockReason: string;
  normalizedQuestion: string;
}

export interface BusinessIntentMappingResult {
  intent: import('../../shared/types/domain').AnalysisIntent;
  sourceResource: LianruanCrmOpenApiResource;
  unsupportedHints: BusinessUnsupportedHint[];
}
