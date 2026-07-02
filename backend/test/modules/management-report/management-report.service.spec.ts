import { ManagementReportService } from '../../../src/modules/management-report/management-report.service';
import type {
  ManagementReportContext,
  ManagementReportSectionPayload,
} from '../../../src/modules/management-report/management-report.types';

describe('ManagementReportService', () => {
  const context: ManagementReportContext & { expiresAt: number } = {
    reportId: 'report_timeout_boundary',
    userId: 'user_sales_director',
    roleNames: ['销售总监'],
    scopeSummary: '测试范围',
    generatedAt: '2026-05-15T06:37:05.013Z',
    filter: {
      departmentId: 'all-company',
      departmentLabel: '全公司',
      presetKey: 'q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      includedDepartmentIds: ['dept_sales'],
    },
    expiresAt: Date.now() + 60_000,
  };

  /**
   * 创建只覆盖专题加载链路的服务实例，避免把权限、审计和部门目录依赖带入单元测试。
   */
  function createService(params: {
    prepareContextData: jest.Mock<Promise<void>, [ManagementReportContext]>;
    composeSection: jest.Mock<ManagementReportSectionPayload, [ManagementReportContext, 'leads']>;
    scope?: {
      organizationIds: string[];
      departmentIds: string[];
      ownerIds: string[];
      scopeSummary: string;
      scopeSource?: 'application-super-admin';
      isFullAccess?: boolean;
    };
  }): ManagementReportService {
    return new ManagementReportService(
      {} as never,
      {} as never,
      {
        resolveScope: jest.fn(() => params.scope ?? {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: ['owner_sales_director'],
          scopeSummary: '测试范围',
        }),
      } as never,
      {} as never,
      {} as never,
      {
        prepareContextData: params.prepareContextData,
      } as never,
      {
        composeSection: params.composeSection,
      } as never,
      {} as never,
    );
  }

  it('上下文准备慢于专题超时时不应把正常专题误降级', async () => {
    const prepareContextData = jest.fn<Promise<void>, [ManagementReportContext]>(
      () => new Promise<void>((resolve) => setTimeout(resolve, 20)),
    );
    const composeSection = jest.fn<
      ManagementReportSectionPayload,
      [ManagementReportContext, 'leads']
    >(() => ({
      reportId: context.reportId,
      sectionKey: 'leads' as const,
      generatedAt: context.generatedAt,
      timeBasis: '线索专题按 leads.created_at 统计筛选期内新增线索。',
      scopeBasis: context.scopeSummary,
      section: {
        sectionKey: 'leads',
        title: '线索',
        summary: '测试专题正常返回。',
        state: 'ready' as const,
        blocks: [],
        footnotes: [],
      },
    }));
    const service = createService({ prepareContextData, composeSection });
    (service as unknown as { sectionTimeoutMs: number }).sectionTimeoutMs = 5;

    const payload = await (service as unknown as {
      loadSection: (
        nextContext: ManagementReportContext & { expiresAt?: number },
        sectionKey: 'leads',
      ) => Promise<ManagementReportSectionPayload>;
    }).loadSection(context, 'leads');

    expect(payload.section.state).toBe('ready');
    expect(prepareContextData).toHaveBeenCalledTimes(1);
    expect(composeSection).toHaveBeenCalledTimes(1);
  });

  it('应用超级管理员上下文应使用统一范围快照而不是登录 ownerIds', () => {
    const service = createService({
      prepareContextData: jest.fn(),
      composeSection: jest.fn() as never,
      scope: {
        organizationIds: ['10804'],
        departmentIds: [],
        ownerIds: [],
        scopeSource: 'application-super-admin',
        isFullAccess: true,
        scopeSummary: '当前已开通应用超级管理员授权，可查看全公司数据。',
      },
    });

    const nextContext = (service as unknown as {
      getOrCreateContext: (
        user: Record<string, unknown>,
        normalizedFilter: ManagementReportContext['filter'],
      ) => ManagementReportContext & { expiresAt: number };
    }).getOrCreateContext(
      {
        id: 'user_ceo',
        roleNames: ['经营负责人'],
        organizationIds: ['10804'],
        ownerIds: ['user_ceo'],
      },
      {
        departmentId: 'all-company',
        departmentLabel: '全公司',
        presetKey: 'q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        includedDepartmentIds: ['dept_sales'],
      },
    );

    expect(nextContext.ownerIds).toEqual([]);
    expect(nextContext.scopeSource).toBe('application-super-admin');
    expect(nextContext.isFullAccess).toBe(true);
    expect(nextContext.scopeSummary).toContain('应用超级管理员授权');
  });
});
