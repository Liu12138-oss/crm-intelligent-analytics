import { httpClient } from './http-client';
import type {
  ManagementReportExportPayload,
  ManagementReportFilter,
  ManagementReportOptionsPayload,
  ManagementReportSectionKey,
  ManagementReportSectionPayload,
  ManagementReportSnapshot,
} from '@/types/management-report';

export const managementReportService = {
  getOptions(): Promise<ManagementReportOptionsPayload> {
    return httpClient.get('/management-report/options');
  },
  getSnapshot(payload: ManagementReportFilter): Promise<ManagementReportSnapshot> {
    return httpClient.post('/management-report/snapshot', payload);
  },
  getSection(
    sectionKey: ManagementReportSectionKey,
    payload: { reportId: string; filter: ManagementReportFilter },
  ): Promise<ManagementReportSectionPayload> {
    return httpClient.post(`/management-report/sections/${sectionKey}`, payload);
  },
  exportReport(payload: {
    reportId: string;
    format: 'csv';
    filter: ManagementReportFilter;
  }): Promise<ManagementReportExportPayload> {
    return httpClient.post('/management-report/export', payload);
  },
};
