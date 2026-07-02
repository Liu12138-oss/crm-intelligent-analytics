import { httpClient } from '@/services/http-client';

export interface IntegrationStepResult {
  name: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  durationMs?: number;
}

export interface IntegrationTestResult {
  success: boolean;
  checkedAt: string;
  durationMs: number;
  message: string;
  steps: IntegrationStepResult[];
  config?: Record<string, unknown>;
}

export interface IntegrationAuditList {
  items: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  total: number;
}

export const integrationsService = {
  getStatus(): Promise<Record<string, any>> {
    return httpClient.get('/governance/integrations/status');
  },
  getWecomConfig(): Promise<Record<string, any>> {
    return httpClient.get('/governance/integrations/wecom');
  },
  updateWecomConfig(payload: Record<string, unknown>): Promise<Record<string, any>> {
    return httpClient.put('/governance/integrations/wecom', payload);
  },
  testWecomConfig(payload?: Record<string, unknown>): Promise<IntegrationTestResult> {
    return httpClient.post('/governance/integrations/wecom/test', payload ?? {});
  },
  getCrmOpenApiConfig(): Promise<Record<string, any>> {
    return httpClient.get('/governance/integrations/crm-openapi');
  },
  updateCrmOpenApiConfig(payload: Record<string, unknown>): Promise<Record<string, any>> {
    return httpClient.put('/governance/integrations/crm-openapi', payload);
  },
  testCrmOpenApiConfig(payload?: Record<string, unknown>): Promise<IntegrationTestResult> {
    return httpClient.post('/governance/integrations/crm-openapi/test', payload ?? {}, {
      timeoutMs: 60000,
    });
  },
  getCrmOpenApiDiagnostics(): Promise<Record<string, any>> {
    return httpClient.get('/governance/integrations/crm-openapi/diagnostics', {
      timeoutMs: 60000,
    });
  },
  listIdentityMappings(params?: { wecomUserId?: string }): Promise<Record<string, any>> {
    const search = new URLSearchParams();
    if (params?.wecomUserId) {
      search.set('wecomUserId', params.wecomUserId);
    }
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return httpClient.get(`/governance/integrations/identity-mappings${suffix}`);
  },
  upsertIdentityMapping(payload: Record<string, unknown>): Promise<Record<string, any>> {
    return httpClient.post('/governance/integrations/identity-mappings', payload);
  },
  getPilotPolicy(): Promise<Record<string, any>> {
    return httpClient.get('/governance/integrations/pilot-policy');
  },
  updatePilotPolicy(payload: Record<string, unknown>): Promise<Record<string, any>> {
    return httpClient.put('/governance/integrations/pilot-policy', payload);
  },
  listAuditEvents(params?: {
    eventType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<IntegrationAuditList> {
    const search = new URLSearchParams();
    if (params?.eventType) {
      search.set('eventType', params.eventType);
    }
    search.set('page', String(params?.page ?? 1));
    search.set('pageSize', String(params?.pageSize ?? 10));
    return httpClient.get(`/governance/integrations/audit-events?${search.toString()}`);
  },
};
