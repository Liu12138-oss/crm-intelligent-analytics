import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装验收进度专题。
 */
export function buildAcceptanceReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const contracts = queryService.listContractsInPeriod(context);
  const pendingContracts = queryService.listPendingAcceptanceContracts(context);
  const ownerRows = [...new Set(contracts.map((item) => item.ownerName))].map((ownerName) => {
    const ownerContracts = contracts.filter((item) => item.ownerName === ownerName);
    return {
      ownerName,
      contractCount: String(ownerContracts.length),
      acceptedCount: String(ownerContracts.filter((item) => item.acceptedAt).length),
      pendingCount: String(ownerContracts.filter((item) => !item.acceptedAt).length),
    };
  });

  return {
    sectionKey: 'acceptance',
    title: '验收进度',
    summary: '验收专题聚焦摘要、负责人进度和待验收合同清单。',
    metricKeys: ['contractAmount', 'acceptancePendingAmount'],
    blocks: [
      {
        blockId: 'acceptance-summary',
        blockType: 'metric-strip',
        title: '验收进度摘要',
        size: 'full',
        items: [
          { label: '合同数', value: String(contracts.length), tone: 'primary' },
          { label: '已验收合同', value: String(contracts.filter((item) => item.acceptedAt).length), tone: 'success' },
          { label: '未验收合同', value: String(pendingContracts.length), tone: 'warning' },
          { label: '验收率', value: queryService.formatPercent(contracts.filter((item) => item.acceptedAt).length, contracts.length), tone: 'danger' },
        ],
      },
      {
        blockId: 'acceptance-owner',
        blockType: 'detail-table',
        title: '负责人验收进度',
        size: 'wide',
        columns: [
          { key: 'ownerName', label: '负责人' },
          { key: 'contractCount', label: '合同数' },
          { key: 'acceptedCount', label: '已验收' },
          { key: 'pendingCount', label: '未验收' },
        ],
        rows: ownerRows,
      },
      pendingContracts.length > 0
        ? {
            blockId: 'acceptance-pending-contracts',
            blockType: 'record-preview',
            title: '未验收合同清单',
            size: 'wide',
            columns: [
              { key: 'customerName', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'amount', label: '有效收入' },
              { key: 'expectedAcceptanceDate', label: '预计验收' },
            ],
            rows: pendingContracts.map((item) => ({
              customerName: item.customerName,
              ownerName: item.ownerName,
              amount: queryService.formatCurrency(item.amount),
              expectedAcceptanceDate: item.expectedAcceptanceDate ?? '--',
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'acceptance-pending-contracts',
            title: '未验收合同清单',
          }),
    ],
    footnotes: ['验收专题重点关注未验收合同和负责人推进节奏。'],
  };
}
