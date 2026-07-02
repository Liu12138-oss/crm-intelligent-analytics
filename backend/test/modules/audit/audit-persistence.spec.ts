import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AnalysisRequestRepository } from '../../../src/modules/analysis/analysis-request.repository';
import { AuditEventRepository } from '../../../src/modules/audit/audit-event.repository';
import { SqlAuditRepository } from '../../../src/modules/audit/sql-audit.repository';

describe('审计与问数持久化仓储', () => {
  function createAppStorageStub() {
    return {
      state: createDefaultAppStorageState(),
      persist: jest.fn(),
    };
  }

  it('AnalysisRequestRepository 保存请求与结果后应立即持久化', () => {
    const appStorage = createAppStorageStub();
    const repository = new AnalysisRequestRepository(appStorage as never);

    repository.saveRequest({
      id: 'query_test_001',
      questionText: '本月各销售负责人新增商机金额排名',
      requesterId: 'user_sales_director',
      requesterRoleIds: ['role_sales_director'],
      sessionId: 'session_001',
      entryChannel: 'web-console',
      querySource: 'FREE_TEXT',
      organizationScope: ['org_north'],
      departmentScope: ['dept_sales'],
      ownerScope: [],
      intentDomain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      filters: {},
      missingConditions: [],
      status: 'RETURNED',
      createdAt: '2026-05-09T02:40:00.000Z',
    });
    repository.saveResult({
      requestId: 'query_test_001',
      title: '新增商机金额趋势分析报告',
      scopeSummary: '销售部',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      keyFindings: [],
      rowCount: 0,
      dataFreshnessAt: '2026-05-09T02:40:00.000Z',
      consistencyToken: 'consistency_001',
      report: {
        variant: 'trend',
        reportTitle: '新增商机金额趋势分析报告',
        executiveSummary: '测试摘要',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '销售部',
        appliedFilters: [],
        availableActions: [],
      },
      streamBlocks: [],
      availableActions: [],
      returnedAt: '2026-05-09T02:40:01.000Z',
    });

    expect(appStorage.persist).toHaveBeenCalledTimes(2);
  });

  it('AuditEventRepository 与 SqlAuditRepository 写入后应立即持久化', () => {
    const appStorage = createAppStorageStub();
    const auditEventRepository = new AuditEventRepository(appStorage as never);
    const sqlAuditRepository = new SqlAuditRepository(appStorage as never);

    auditEventRepository.create({
      id: 'audit_001',
      eventType: 'QUERY_SUCCEEDED',
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: [],
        scopeSummary: '销售部',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '问数成功',
      createdAt: '2026-05-09T02:40:00.000Z',
    });
    sqlAuditRepository.create({
      id: 'sql_audit_001',
      createdAt: '2026-05-09T02:40:00.000Z',
      stage: 'EXECUTED',
      status: 'SUCCEEDED',
      riskLevel: 'LOW',
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      requestId: 'query_test_001',
      moduleKey: 'analysis-workbench',
      programName: 'AnalysisWorkflowOrchestrator.run',
      databaseRole: 'CRM_READONLY',
      operationType: 'SELECT',
      tables: ['opportunities'],
      sqlText: 'SELECT 1',
      sqlSummary: 'SELECT 1',
      paramsJson: '[]',
      paramSummary: '无参数',
      normalizedSql: 'SELECT 1',
      sqlFingerprint: 'fingerprint_001',
    });

    expect(appStorage.persist).toHaveBeenCalledTimes(2);
  });
});
