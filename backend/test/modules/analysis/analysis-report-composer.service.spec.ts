import { AnalysisReportComposerService } from '../../../src/modules/analysis/analysis-report-composer.service';

describe('AnalysisReportComposerService', () => {
  const service = new AnalysisReportComposerService();

  it('组合经营模板结果不应被合同域标题覆盖为合同转化分析报告', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_composite',
        channel: 'wecom-bot',
        questionText:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
        normalizedQuestion:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_composite',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_composite',
            taskId: 'analysis-warehouse-composite-operations',
            taskTitle: '联软 CRM 组合经营分析',
            resultKind: 'metric-summary',
            purpose: 'primary-summary',
            sql: '-- SQLite/MySQL 固定组合模板',
            executionMode: 'GUARDED_DIRECT_QUERY',
            executionSource: 'ANALYSIS_WAREHOUSE',
            matchedAdapter: 'analysis-warehouse.fixed-composite-operations',
            gapReason: '',
            summary: '已按三个区块完成经营分析。',
            appliedFilters: [],
            metricCards: [
              { name: '合作伙伴数', value: 12 },
              { name: '客户商机报备数', value: 150 },
              { name: '有效订单金额', value: '45.45 万元' },
            ],
            primaryView: {
              viewType: 'METRIC_CARDS',
              title: '组合经营概览',
              rows: [
                { metric_name: '合作伙伴数', metric_value: 12 },
                { metric_name: '客户商机报备数', metric_value: 150 },
              ],
              columns: [
                { key: 'metric_name', label: '指标' },
                { key: 'metric_value', label: '数值' },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { metric_name: '合作伙伴数', metric_value: 12 },
              { metric_name: '客户商机报备数', metric_value: 150 },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [
          { metric_name: '合作伙伴数', metric_value: 12 },
          { metric_name: '客户商机报备数', metric_value: 150 },
        ],
        totalRowCount: 2,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('合作伙伴开拓、客户报备与订单经营分析报告');
    expect(report.reportTitle).not.toBe('合同转化分析报告');
  });

  it('只问渠道商商机订单时报告标题不应额外带客户报备', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_partner_opp_order',
        channel: 'wecom-bot',
        questionText: '北京区域的渠道商商机订单分析',
        normalizedQuestion: '北京区域的渠道商商机订单分析',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_partner_opp_order',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_partner_opp_order',
            taskId: 'crm-openapi-business-chain-snapshot',
            taskTitle: '渠道商、商机与订单经营分析',
            resultKind: 'partner-contribution',
            purpose: 'primary-summary',
            sql: '-- 本地 OpenAPI Markdown 快照业务链分析',
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            matchedAdapter: 'openapi-markdown-snapshot.business-chain',
            gapReason: '',
            summary: '已基于本地 OpenAPI Markdown 快照完成渠道商、商机、订单组合经营分析。',
            appliedFilters: [],
            metricCards: [
              { name: '合作伙伴数', value: 1 },
              { name: '商机数', value: 1 },
              { name: '订单数', value: 1 },
            ],
            primaryView: {
              viewType: 'BAR_CHART',
              title: '经营区块数据覆盖',
              rows: [
                { businessSection: '合作伙伴开拓情况', count: 1 },
                { businessSection: '商机情况', count: 1 },
                { businessSection: '订单情况', count: 1 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { businessSection: '合作伙伴开拓情况', count: 1 },
              { businessSection: '商机情况', count: 1 },
              { businessSection: '订单情况', count: 1 },
            ],
            rowCount: 3,
          },
        ],
        mergedRows: [
          { businessSection: '合作伙伴开拓情况', count: 1 },
          { businessSection: '商机情况', count: 1 },
          { businessSection: '订单情况', count: 1 },
        ],
        totalRowCount: 3,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('渠道商商机与订单分析报告');
    expect(report.reportTitle).not.toContain('客户报备');
  });

  it('订单问题使用内部合同域时展示标题和摘要应保留订单口径', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_order_title',
        channel: 'wecom-bot',
        questionText: '帮我分析一下最近三个月订单情况',
        normalizedQuestion: '帮我分析一下最近三个月订单情况',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_order_title',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_order_title',
            taskId: 'task_order_title',
            taskTitle: '订单金额总览',
            resultKind: 'metric-summary',
            purpose: 'primary-summary',
            sql: '-- 本地 OpenAPI Markdown 快照 orders',
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            matchedAdapter: 'openapi-markdown-snapshot.orders',
            gapReason: '',
            summary: '已按订单生成总览。',
            appliedFilters: [],
            metricCards: [
              { name: '订单数', value: 3 },
              { name: '订单金额', value: '98 万元' },
            ],
            primaryView: {
              viewType: 'METRIC_CARDS',
              title: '订单金额总览',
            },
            secondaryViews: [],
            tableRows: [
              {
                ownerName: '订单总览',
                count: 3,
                amount: 980000,
              },
            ],
            rowCount: 1,
          },
        ],
        mergedRows: [
          {
            ownerName: '订单总览',
            count: 3,
            amount: 980000,
          },
        ],
        totalRowCount: 1,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toMatch(/订单|下单/u);
    expect(report.reportTitle).not.toBe('合同转化分析报告');
    expect(report.executiveSummary).toMatch(/订单|下单/u);
    expect(report.executiveSummary).not.toContain('合同转化');
  });

  it('OpenAPI 组合经营多切片不应被合同域标题和首个服务商指标带偏', () => {
    const createSlice = (
      taskTitle: string,
      metricCards: Array<{ name: string; value: string | number }>,
      tableRows: Array<Record<string, unknown>>,
    ) => ({
      datasetId: `dataset_${taskTitle}`,
      taskId: `task_${taskTitle}`,
      taskTitle,
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: `-- 联软标准 OpenAPI ${taskTitle}`,
      executionMode: 'CRM_OFFICIAL_API',
      executionSource: 'CRM_OFFICIAL_API',
      matchedAdapter: 'crm-official-api.partner-profile',
      gapReason: '',
      summary: `${taskTitle} 已通过联软标准 OpenAPI 生成。`,
      appliedFilters: [],
      metricCards,
      primaryView: {
        viewType: 'DETAIL_TABLE',
        title: `${taskTitle}明细`,
        rows: tableRows,
      },
      secondaryViews: [],
      tableRows,
      rowCount: tableRows.length,
    });
    const report = service.compose(
      {
        workflowId: 'workflow_openapi_composite',
        channel: 'wecom-bot',
        questionText:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
        normalizedQuestion:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [
          { title: '合作伙伴开拓情况' },
          { title: '客户报备情况' },
          { title: '客户商机及渠道商维度' },
          { title: '订单情况及渠道商贡献' },
        ],
      } as never,
      {
        workflowId: 'workflow_openapi_composite',
        scopeSummary: '全部数据范围',
        slices: [
          createSlice('合作伙伴开拓情况', [
            { name: '服务商数量', value: 173 },
            { name: '合作等级数', value: 4 },
          ], [{ partner_name: '广州渠道商', count: 173 }]),
          createSlice('客户报备情况', [
            { name: '命中报备数', value: 152 },
          ], [{ status_name: '已通过', count: 120 }]),
          createSlice('客户商机及渠道商维度', [
            { name: '累计商机金额', value: '420 万元' },
            { name: '命中商机数', value: 44 },
          ], [{ partnerName: '广州渠道商', amount: 4200000, count: 44 }]),
          createSlice('订单情况及渠道商贡献', [
            { name: '累计订单金额', value: '98 万元' },
            { name: '命中订单数', value: 3 },
          ], [{ partnerName: '广州渠道商', amount: 980000, count: 3 }]),
        ],
        mergedRows: [],
        totalRowCount: 6,
        appliedFilters: [],
      } as never,
    );

    expect(report.variant).toBe('summary');
    expect(report.reportTitle).toBe('合作伙伴开拓、客户报备与订单经营分析报告');
    expect(report.reportTitle).not.toBe('合同转化分析报告');
    expect(report.metricCards.slice(0, 4)).toEqual([
      { name: '服务商数量', value: 173 },
      { name: '命中报备数', value: 152 },
      { name: '命中商机数', value: 44 },
      { name: '累计商机金额', value: '420 万元' },
    ]);
    expect(report.executiveSummary).toContain('合作伙伴开拓情况');
    expect(report.executiveSummary).toContain('联软标准 OpenAPI 真实数据');
    expect(report.sections.find((item) => item.sectionType === 'actions')?.items?.join(' ')).toContain(
      '客户报备、商机和订单',
    );
  });

  it('报告应把用户指定的呈现方式转成中文口径说明', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_output_preference',
        channel: 'wecom-bot',
        questionText: '帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现',
        normalizedQuestion: '帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        outputPreference: ['text_summary', 'table', 'chart', 'html_report'],
        tasks: [],
      } as never,
      {
        workflowId: 'workflow_output_preference',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_output_preference',
            taskId: 'task_output_preference',
            taskTitle: '商机整体总览',
            resultKind: 'metric-summary',
            purpose: 'primary-summary',
            sql: '-- 联软标准 OpenAPI /opportunities',
            executionMode: 'CRM_OFFICIAL_API',
            executionSource: 'CRM_OFFICIAL_API',
            matchedAdapter: 'crm-official-api.opportunity-metric-summary',
            gapReason: '',
            summary: '已通过联软标准 OpenAPI 生成商机总览。',
            appliedFilters: [],
            metricCards: [
              { name: '商机数', value: 2 },
              { name: '商机金额', value: '100 万元' },
            ],
            primaryView: {
              viewType: 'METRIC_CARDS',
              title: '商机整体总览',
              rows: [{ ownerName: '商机整体', amount: 1000000, count: 2 }],
            },
            secondaryViews: [],
            tableRows: [{ ownerName: '商机整体', amount: 1000000, count: 2 }],
            rowCount: 1,
          },
        ],
        mergedRows: [{ ownerName: '商机整体', amount: 1000000, count: 2 }],
        totalRowCount: 1,
        appliedFilters: [],
      } as never,
    );

    const presentationNote = report.sourceNotes?.find((item) => item.key === 'presentation-preference');
    expect(presentationNote?.label).toBe('呈现口径');
    expect(presentationNote?.description).toContain('文字摘要、表格明细、图表区块、完整报告页');
    expect(presentationNote?.description).not.toContain('text_summary');
    expect(presentationNote?.description).not.toContain('html_report');
  });

  it('服务商发展开拓和运营问题应按服务商发展运营看板结构输出', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_partner_development',
        channel: 'wecom-bot',
        questionText: '分析一下服务商发展、开拓和运营情况',
        normalizedQuestion: '分析一下服务商发展、开拓和运营情况',
        domain: 'partner-contribution',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '服务商发展运营情况' }],
      } as never,
      {
        workflowId: 'workflow_partner_development',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_partner_profile',
            taskId: 'task_partner_profile',
            taskTitle: '服务商发展运营情况',
            resultKind: 'partner-contribution',
            purpose: 'primary-summary',
            sql: '-- 联软标准 OpenAPI /partners',
            executionMode: 'CRM_OFFICIAL_API',
            executionSource: 'CRM_OFFICIAL_API',
            matchedAdapter: 'crm-official-api.partner-profile',
            gapReason: '',
            summary: '已通过联软标准 OpenAPI 生成服务商发展运营明细。',
            appliedFilters: [],
            metricCards: [
              { name: '服务商数量', value: 2 },
              { name: '订单金额', value: '170 万元' },
            ],
            primaryView: {
              viewType: 'TABLE',
              title: '服务商发展运营情况',
              rows: [
                {
                  partnerName: '广州核心服务商',
                  region: '华南',
                  bigRegion: '南区',
                  teamName: '广州团队',
                  partnerLevelName: '核心',
                  certificationCount: 3,
                  technicalServiceCount: 2,
                  amount: 4200000,
                  orderAmount: 1200000,
                  opportunityAmount: 3000000,
                  count: 5,
                },
                {
                  partnerName: '北京成长服务商',
                  region: '华北',
                  bigRegion: '北区',
                  teamName: '北京团队',
                  partnerLevelName: '成长',
                  certificationCount: 1,
                  amount: 1500000,
                  orderAmount: 500000,
                  opportunityAmount: 1000000,
                  count: 2,
                },
              ],
            },
            secondaryViews: [],
            tableRows: [
              {
                partnerName: '广州核心服务商',
                region: '华南',
                bigRegion: '南区',
                teamName: '广州团队',
                partnerLevelName: '核心',
                certificationCount: 3,
                technicalServiceCount: 2,
                amount: 4200000,
                orderAmount: 1200000,
                opportunityAmount: 3000000,
                count: 5,
              },
              {
                partnerName: '北京成长服务商',
                region: '华北',
                bigRegion: '北区',
                teamName: '北京团队',
                partnerLevelName: '成长',
                certificationCount: 1,
                amount: 1500000,
                orderAmount: 500000,
                opportunityAmount: 1000000,
                count: 2,
              },
            ],
            rowCount: 2,
          },
          {
            datasetId: 'dataset_partner_trend',
            taskId: 'task_partner_trend',
            taskTitle: '服务商签约年度趋势',
            resultKind: 'time-trend',
            purpose: 'trend-series',
            sql: '-- 联软标准 OpenAPI 趋势聚合',
            summary: '已生成近3年趋势。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'LINE_CHART',
              title: '服务商签约年度趋势',
              series: [
                { label: '2024', value: 800000 },
                { label: '2025', value: 1200000 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { bucket_label: '2024', amount: 800000, count: 1 },
              { bucket_label: '2025', amount: 1200000, count: 2 },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [],
        totalRowCount: 4,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('服务商发展运营数据看板');
    expect(report.executiveSummary).toContain('全国代理商发展运营数据看板');
    expect(report.sections.map((item) => item.title)).toEqual([
      '执行摘要',
      '关键指标',
      '近3年签约 & 商机趋势',
      '大区签约额对比（万元）',
      '合作等级明细',
      '省份代理商覆盖情况',
      '渠道商体系明细（按团队）',
      '运营建议',
    ]);
    expect(report.tableBlocks.map((item) => item.title)).toEqual([
      '合作等级明细',
      '渠道商体系明细（按团队）',
    ]);
    expect(report.executiveSummary).not.toContain('技术认证');
    expect(report.tableBlocks[0]?.rows?.map((row) => row.partnerLevel)).toEqual(['成长', '核心']);
    expect(report.tableBlocks[0]?.columns?.map((column) => column.label)).toContain('渠道商占比');
    expect(report.tableBlocks[1]?.columns?.map((column) => column.label)).toEqual([
      '大区',
      '团队',
      '渠道商总数',
      'LEP',
      '金牌',
      '签约技术',
      '提名',
      '2026签约数',
      '2026签约额',
      '占全国比',
    ]);
    expect(report.tableBlocks[1]?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bigRegionLabel: '南区',
        teamName: '广州团队',
        partnerTotalCount: 1,
        signedAmount2026Text: '120 万元',
      }),
      expect.objectContaining({
        bigRegionLabel: '北区',
        teamName: '北京团队',
        partnerTotalCount: 1,
        signedAmount2026Text: '50 万元',
      }),
    ]));
    expect(report.sections.find((item) => item.title === '省份代理商覆盖情况')?.items?.join(' ')).toContain(
      '广州核心服务商',
    );
    expect(report.sections.find((item) => item.title === '省份代理商覆盖情况')?.rows?.[0]).toMatchObject({
      province: '广东',
      region: '华南',
      partnerCount: 1,
      levelSummary: '核心 1 家',
      coveredCityCount: 1,
      totalCityCount: 21,
      cityGroups: [expect.objectContaining({ cityName: '广州', partnerCount: 1, partners: ['广州核心服务商'] })],
    });
  });

  it('渠道商数量和类型明细问题不应套服务商发展运营看板', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_partner_type_detail',
        channel: 'wecom-bot',
        questionText: '山东区域有多少个渠道商，分别是什么类型的单独列一下。',
        normalizedQuestion: '山东区域有多少个渠道商，分别是什么类型的单独列一下。',
        domain: 'customer-relationship',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '渠道商类型明细' }],
      } as never,
      {
        workflowId: 'workflow_partner_type_detail',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_partner_type_detail',
            taskId: 'task_partner_type_detail',
            taskTitle: '渠道商类型明细',
            resultKind: 'partner-contribution',
            purpose: 'primary-summary',
            sql: '-- 本地 OpenAPI Markdown 快照分析',
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            matchedAdapter: 'openapi-markdown-snapshot.partner-profile',
            gapReason: '',
            summary: '已通过本地 OpenAPI Markdown 快照完成渠道商画像统计，当前授权服务商快照命中 2 家渠道商。',
            appliedFilters: [],
            metricCards: [
              { name: '渠道商数量', value: 2 },
              { name: '技术服务商', value: 1 },
            ],
            primaryView: {
              viewType: 'DETAIL_TABLE',
              title: '渠道商画像明细',
              rows: [
                {
                  partnerName: '山东诚卓信息技术有限公司',
                  partnerType: '渠道商',
                  region: '山东区',
                },
                {
                  partnerName: '山东旭正信息科技有限公司',
                  partnerType: '技术服务商',
                  region: '山东区',
                },
              ],
            },
            secondaryViews: [],
            tableRows: [
              {
                partnerName: '山东诚卓信息技术有限公司',
                partnerType: '渠道商',
                region: '山东区',
              },
              {
                partnerName: '山东旭正信息科技有限公司',
                partnerType: '技术服务商',
                region: '山东区',
              },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [],
        totalRowCount: 2,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('渠道商类型明细报告');
    expect(report.reportTitle).not.toBe('服务商发展运营数据看板');
    expect(report.sections.map((item) => item.title)).not.toContain('近3年签约 & 商机趋势');
    expect(report.tableBlocks[0]?.title).toBe('渠道商类型明细');
  });

  it('服务商发展运营模板应作为默认兜底，用户明确只看区域明细时不套完整看板', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_partner_region_detail',
        channel: 'wecom-bot',
        questionText: '服务商发展运营情况，只看山东区域渠道商明细',
        normalizedQuestion: '服务商发展运营情况，只看山东区域渠道商明细',
        domain: 'partner-contribution',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '山东区域渠道商明细' }],
      } as never,
      {
        workflowId: 'workflow_partner_region_detail',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_partner_region_detail',
            taskId: 'task_partner_region_detail',
            taskTitle: '山东区域渠道商明细',
            resultKind: 'partner-contribution',
            purpose: 'detail-table',
            sql: '-- 本地 OpenAPI Markdown 快照 /partners',
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            matchedAdapter: 'openapi-markdown-snapshot.partner-profile',
            gapReason: '',
            summary: '已按用户要求只生成山东区域渠道商明细。',
            appliedFilters: [],
            metricCards: [
              { name: '渠道商数量', value: 2 },
            ],
            primaryView: {
              viewType: 'DETAIL_TABLE',
              title: '山东区域渠道商明细',
            },
            secondaryViews: [],
            tableRows: [
              { partnerName: '山东诚卓信息技术有限公司', region: '山东区' },
              { partnerName: '山东旭正信息科技有限公司', region: '山东区' },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [
          { partnerName: '山东诚卓信息技术有限公司', region: '山东区' },
          { partnerName: '山东旭正信息科技有限公司', region: '山东区' },
        ],
        totalRowCount: 2,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('山东区域渠道商明细报告');
    expect(report.reportTitle).not.toBe('服务商发展运营数据看板');
    expect(report.sections.map((item) => item.title)).not.toContain('近3年签约 & 商机趋势');
    expect(report.sections.map((item) => item.title)).not.toContain('大区签约额对比（万元）');
    expect(report.tableBlocks[0]?.title).toBe('山东区域渠道商明细');
  });

  it('业务链快照承接全国代理商发展运营看板时应使用二级真实合作伙伴明细', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_partner_dashboard_snapshot',
        channel: 'wecom-bot',
        questionText: '全国代理商发展运营数据看板',
        normalizedQuestion: '全国代理商发展运营数据看板',
        domain: 'customer-relationship',
        confidence: 'MEDIUM',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '合作伙伴开拓、客户报备、商机与订单经营分析' }],
      } as never,
      {
        workflowId: 'workflow_partner_dashboard_snapshot',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_business_chain_snapshot',
            taskId: 'crm-openapi-business-chain-snapshot',
            taskTitle: '合作伙伴开拓、客户报备、商机与订单经营分析',
            resultKind: 'metric-summary',
            purpose: 'primary-summary',
            sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照',
            executionMode: 'CRM_OFFICIAL_API',
            executionSource: 'CRM_OFFICIAL_API',
            matchedAdapter: 'crm-official-api.business-chain-snapshot',
            gapReason: '',
            summary: '已通过联软标准 OpenAPI 读取合作伙伴、客户报备、商机和订单真实明细。',
            appliedFilters: [],
            metricCards: [
              { name: '合作伙伴数', value: 173 },
              { name: '客户报备数', value: 152 },
              { name: '商机数', value: 44 },
              { name: '商机金额', value: '420 万元' },
              { name: '订单数', value: 3 },
              { name: '订单金额', value: '3.13 万元' },
            ],
            primaryView: {
              viewType: 'METRIC_CARDS',
              title: '组合经营概览',
              rows: [
                { businessSection: '合作伙伴开拓情况', count: 173 },
                { businessSection: '客户报备情况', count: 152 },
                { businessSection: '订单情况', count: 3, amountText: '3.13 万元' },
              ],
            },
            secondaryViews: [
              {
                viewType: 'DETAIL_TABLE',
                title: '合作伙伴明细',
                rows: [
                  {
                    partnerName: '广州核心服务商',
                    region: '华南',
                    bigRegion: '南区',
                    teamName: '广州团队',
                    level: '一级渠道',
                    cooperationLevel: 'gold',
                    isTechService: true,
                    techServiceType: 'full',
                  },
                  {
                    partnerName: '山东成长服务商',
                    city: '济南市',
                    region: '华东',
                    bigRegion: '东区',
                    teamName: '山东团队',
                    level: '未设置',
                    techServiceType: 'developing',
                    isTechService: false,
                  },
                ],
              },
              {
                viewType: 'RANKING_TABLE',
                title: '渠道商经营贡献汇总',
                rows: [
                  {
                    partnerName: '广州核心服务商',
                    registrationCount: 20,
                    opportunityCount: 8,
                    opportunityAmount: 1150000,
                    orderCount: 2,
                    orderAmount: 31300,
                    amount: 1181300,
                  },
                  {
                    partnerName: '山东成长服务商',
                    registrationCount: 3,
                    opportunityCount: 1,
                    opportunityAmount: 0,
                    orderCount: 1,
                    orderAmount: 12000,
                    amount: 12000,
                  },
                ],
              },
            ],
            tableRows: [
              { businessSection: '合作伙伴开拓情况', count: 173 },
              { businessSection: '客户报备情况', count: 152 },
              { businessSection: '订单情况', count: 3, amountText: '3.13 万元' },
            ],
            rowCount: 3,
          },
        ],
        mergedRows: [],
        totalRowCount: 3,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('服务商发展运营数据看板');
    expect(report.metricCards.slice(0, 4)).toEqual([
      { name: '渠道商总数', value: 173 },
      { name: '区域覆盖', value: '2 个区域' },
      { name: '合作等级数', value: '2 类' },
      { name: '商机金额', value: '420 万元' },
    ]);
    expect(report.tableBlocks[0]?.title).toBe('合作等级明细');
    expect(report.tableBlocks[0]?.rows).toEqual([
      expect.objectContaining({ partnerLevel: '一级渠道', partnerCount: 1, amountText: '118.13 万元' }),
      expect.objectContaining({ partnerLevel: '未设置', partnerCount: 1, amountText: '1.2 万元' }),
    ]);
    expect(report.tableBlocks[1]?.title).toBe('渠道商体系明细（按团队）');
    expect(report.tableBlocks[1]?.columns?.map((column) => column.label)).toEqual([
      '大区',
      '团队',
      '渠道商总数',
      'LEP',
      '金牌',
      '签约技术',
      '提名',
      '2026签约数',
      '2026签约额',
      '占全国比',
    ]);
    expect(report.tableBlocks[1]?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bigRegionLabel: '南区',
        teamName: '广州团队',
        partnerTotalCount: 1,
        goldCount: 1,
        signedTechnicalCount: 1,
        signedCount2026: 2,
        signedAmount2026Text: '3.13 万元',
      }),
      expect.objectContaining({
        bigRegionLabel: '东区',
        teamName: '山东团队',
        partnerTotalCount: 1,
        nominationCount: 1,
        signedCount2026: 1,
        signedAmount2026Text: '1.2 万元',
      }),
    ]));
    expect(report.sections.find((item) => item.title === '省份代理商覆盖情况')?.rows).toEqual([
      expect.objectContaining({
        coverageKey: '广东',
        province: '广东',
        region: '华南',
        partnerCount: 1,
        levelSummary: '一级渠道 1 家',
        levelGroups: [expect.objectContaining({ level: '一级渠道', count: 1, agents: ['广州核心服务商'] })],
        coveredCityCount: 1,
        totalCityCount: 21,
        cityGroups: [expect.objectContaining({ cityName: '广州', partnerCount: 1, partners: ['广州核心服务商'] })],
      }),
      expect.objectContaining({
        coverageKey: '山东',
        province: '山东',
        region: '华东',
        partnerCount: 1,
        levelSummary: '未设置 1 家',
        levelGroups: [expect.objectContaining({ level: '未设置', count: 1, agents: ['山东成长服务商'] })],
        coveredCityCount: 1,
        totalCityCount: 16,
        cityGroups: [expect.objectContaining({ cityName: '济南', partnerCount: 1, partners: ['山东成长服务商'] })],
      }),
    ]);
    expect(report.sections.map((item) => item.title)).not.toContain('技术服务人员与证书认证');
  });

  it('订单和渠道下单分析应按渠道下单汇总模板输出并优先使用订单金额排序', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_channel_order',
        channel: 'wecom-bot',
        questionText: '广州办渠道下单汇总分析',
        normalizedQuestion: '广州办渠道下单汇总分析',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '渠道下单汇总分析' }],
      } as never,
      {
        workflowId: 'workflow_channel_order',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_order_partner',
            taskId: 'task_order_partner',
            taskTitle: '渠道下单汇总分析',
            resultKind: 'partner-contribution',
            purpose: 'primary-summary',
            sql: '-- 联软标准 OpenAPI /orders',
            executionMode: 'CRM_OFFICIAL_API',
            executionSource: 'CRM_OFFICIAL_API',
            matchedAdapter: 'crm-official-api.order-partner-contribution',
            gapReason: '',
            summary: '已通过联软标准 OpenAPI 生成渠道下单汇总。',
            appliedFilters: [],
            metricCards: [
              { name: '命中订单数', value: 3 },
              { name: '累计订单金额', value: '600 万元' },
            ],
            primaryView: {
              viewType: 'TABLE',
              title: '渠道下单汇总分析',
              rows: [
                { partnerName: '广州订单渠道', orderAmount: 5000000, orderCount: 2, amount: 100, count: 2 },
                { partnerName: '深圳误导渠道', orderAmount: 1000000, orderCount: 1, amount: 999999999, count: 1 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { partnerName: '广州订单渠道', orderAmount: 5000000, orderCount: 2, amount: 100, count: 2 },
              { partnerName: '深圳误导渠道', orderAmount: 1000000, orderCount: 1, amount: 999999999, count: 1 },
            ],
            rowCount: 2,
          },
          {
            datasetId: 'dataset_order_trend',
            taskId: 'task_order_trend',
            taskTitle: '渠道下单年度趋势',
            resultKind: 'time-trend',
            purpose: 'trend-series',
            sql: '-- 联软标准 OpenAPI /orders 趋势聚合',
            summary: '已生成渠道下单年度趋势。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'LINE_CHART',
              title: '渠道下单年度趋势',
              series: [
                { label: '2025', value: 2000000 },
                { label: '2026', value: 4000000 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { bucket_label: '2025', orderAmount: 2000000, orderCount: 1 },
              { bucket_label: '2026', orderAmount: 4000000, orderCount: 2 },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [],
        totalRowCount: 4,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('渠道商下单汇总分析报告');
    expect(report.metricCards.slice(0, 4)).toEqual([
      { name: '合作渠道总数', value: 2 },
      { name: '渠道下单总量', value: 3 },
      { name: '渠道下单总额', value: '600 万元' },
      { name: '平均单笔金额', value: '200 万元' },
    ]);
    expect(report.sections.map((item) => item.title)).toEqual([
      '执行摘要',
      '关键指标',
      '渠道集中度分析',
      '渠道下单年度趋势',
      '渠道下单排名 TOP 10',
      'TOP 30 渠道分年下单明细',
      '全部 2 家渠道排名',
      '订单明细清单（共 2 条）',
      '经营建议',
    ]);
    expect(report.tableBlocks.map((item) => item.title)).toEqual([
      '渠道下单排名 TOP 10',
      'TOP 30 渠道分年下单明细',
      '全部 2 家渠道排名',
      '订单明细清单（共 2 条）',
    ]);
    expect(report.tableBlocks[0]?.rows?.[0]?.partnerName).toBe('广州订单渠道');
    expect(report.tableBlocks[0]?.rows?.map((row) => row.partnerName)).not.toContain('2026');
    expect(report.executiveSummary).toContain('广州订单渠道');
  });

  it('渠道商下单模板应作为默认兜底，用户明确只看 TOP10 时不套完整模板', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_channel_order_top10_only',
        channel: 'wecom-bot',
        questionText: '渠道商订单情况，只看TOP10渠道商排名',
        normalizedQuestion: '渠道商订单情况，只看TOP10渠道商排名',
        domain: 'contract-conversion',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [{ title: '订单金额渠道商TOP10排名' }],
      } as never,
      {
        workflowId: 'workflow_channel_order_top10_only',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_order_top10_only',
            taskId: 'task_order_top10_only',
            taskTitle: '订单金额渠道商TOP10排名',
            resultKind: 'partner-contribution',
            purpose: 'detail-table',
            sql: '-- 本地 OpenAPI Markdown 快照 /orders',
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            matchedAdapter: 'openapi-markdown-snapshot.orders',
            gapReason: '',
            summary: '已按用户要求只生成 TOP10 渠道商订单排名。',
            appliedFilters: [],
            metricCards: [
              { name: '订单数', value: 10 },
              { name: '订单金额', value: '900 万元' },
            ],
            primaryView: {
              viewType: 'BAR_CHART',
              title: '订单金额渠道商TOP10排名',
              series: [{ label: '广州订单渠道', value: 5000000 }],
            },
            secondaryViews: [],
            tableRows: [
              { partnerName: '广州订单渠道', orderAmount: 5000000, orderCount: 2 },
            ],
            rowCount: 1,
          },
        ],
        mergedRows: [
          { partnerName: '广州订单渠道', orderAmount: 5000000, orderCount: 2 },
        ],
        totalRowCount: 1,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('订单分析报告');
    expect(report.tableBlocks.map((item) => item.title)).not.toContain('TOP 30 渠道分年下单明细');
    expect(report.tableBlocks.map((item) => item.title)).not.toContain('全部 1 家渠道排名');
    expect(report.sections.map((item) => item.title)).toContain('订单金额渠道商TOP10排名');
  });

  it('泛商机分析应套默认经营模板并避免重复阶段分布表', () => {
    const channelRows = [
      { partner_name: '广州示例渠道', opportunity_count: 3, opportunity_amount: 1200000 },
      { partner_name: '深圳示例渠道', opportunity_count: 2, opportunity_amount: 800000 },
      { partner_name: '北京示例渠道', opportunity_count: 1, opportunity_amount: 300000 },
    ];
    const stageRows = [
      { stage_name: '方案交流', opportunity_count: 2, opportunity_amount: 800000 },
      { stage_name: '商务谈判', opportunity_count: 1, opportunity_amount: 400000 },
    ];
    const detailRows = [
      {
        opportunity_name: '示例客户一安全建设商机',
        customer_name: '示例客户一',
        partner_name: '广州示例渠道',
        stage_name: '方案交流',
        amount: 500000,
        created_at: '2026-01-15T00:00:00.000Z',
      },
      {
        opportunity_name: '示例客户二安全运营商机',
        customer_name: '示例客户二',
        partner_name: '深圳示例渠道',
        stage_name: '商务谈判',
        amount: 700000,
        created_at: '2026-07-10T00:00:00.000Z',
      },
      {
        opportunity_name: '示例客户三取消商机',
        customer_name: '示例客户三',
        partner_name: '北京示例渠道',
        stage_name: '已取消',
        amount: 300000,
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ];

    const report = service.compose(
      {
        workflowId: 'workflow_opportunity_partner',
        channel: 'wecom-bot',
        questionText: '帮我分析一下全部的商机情况',
        normalizedQuestion: '帮我分析一下全部的商机情况',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_opportunity_partner',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_opportunity_partner',
            taskId: 'sqlite-snapshot-opportunity-partner-overview',
            taskTitle: '商机整体及渠道商维度分析',
            resultKind: 'partner-contribution',
            purpose: 'primary-summary',
            sql: '-- SQLite 固定商机渠道商模板',
            executionMode: 'GUARDED_DIRECT_QUERY',
            executionSource: 'SQLITE_SNAPSHOT',
            matchedAdapter: 'sqlite-snapshot.fixed-opportunity-partner-overview',
            gapReason: '',
            summary: '已生成商机整体及渠道商维度分析。',
            appliedFilters: [],
            metricCards: [
              { name: '商机数', value: 3 },
              { name: '商机金额', value: '120 万元' },
            ],
            primaryView: {
              viewType: 'TABLE',
              title: '商机渠道商贡献',
              rows: channelRows,
            },
            secondaryViews: [
              {
                viewType: 'TABLE',
                title: '商机渠道商贡献',
                rows: channelRows,
              },
              {
                viewType: 'TABLE',
                title: '商机阶段分布',
                rows: stageRows,
              },
              {
                viewType: 'DETAIL_TABLE',
                title: '重点商机明细',
                rows: detailRows,
              },
            ],
            tableRows: channelRows,
            rowCount: channelRows.length,
          },
        ],
        mergedRows: channelRows,
        totalRowCount: channelRows.length,
        appliedFilters: [],
      } as never,
    );

    expect(report.reportTitle).toBe('商机经营分析报告');
    expect(report.metricCards.slice(0, 3)).toEqual([
      { name: '商机数量', value: 6 },
      { name: '商机金额', value: '230 万元' },
      { name: '平均商机金额', value: '38.33 万元' },
    ]);
    expect(report.executiveSummary).toContain('渠道 TOP5/TOP10/TOP20');
    expect(report.tableBlocks.map((item) => item.title)).toEqual([
      '渠道商机金额 TOP5',
      '渠道商机金额 TOP10',
      '渠道商机金额 TOP20',
      '头部集中度与长尾效应',
      '商机大单',
      '渠道商机年度分析',
      '渠道商机半年度分析',
      'TOP10商机明细',
      '非取消商机明细（共 2 条）',
    ]);
    expect(report.tableBlocks.map((item) => item.title)).not.toContain('商机阶段分布');
    expect(report.tableBlocks.find((item) => item.title === '渠道商机金额 TOP5')?.rows[0]).toMatchObject({
      rank: 1,
      partner_name: '广州示例渠道',
      opportunity_count: 3,
      opportunity_amount: 1200000,
    });
    expect(report.tableBlocks.find((item) => item.title === '头部集中度与长尾效应')?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric_name: 'TOP5渠道商机金额', shareText: '100.0%' }),
        expect.objectContaining({ metric_name: '长尾效应（TOP20以外）', partner_count: 0 }),
      ]),
    );
    expect(report.tableBlocks.find((item) => item.title === '渠道商机半年度分析')?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period_label: '2026上半年', opportunity_count: 1 }),
        expect.objectContaining({ period_label: '2026下半年', opportunity_count: 2 }),
      ]),
    );
    expect(report.tableBlocks.find((item) => item.title === 'TOP10商机明细')?.rows[0]).toMatchObject({
      opportunity_name: '示例客户二安全运营商机',
      amount: 700000,
    });
    expect(report.tableBlocks.find((item) => item.title === '非取消商机明细（共 2 条）')?.rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ opportunity_name: '示例客户三取消商机' })]),
    );
  });

  it('非默认模板也应去掉标题和内容完全相同的重复表格', () => {
    const duplicateRows = [
      { stage: '已接触', count: 2, amount: 300000 },
      { stage: '商务谈判', count: 1, amount: 200000 },
    ];

    const report = service.compose(
      {
        workflowId: 'workflow_stage_distribution',
        channel: 'wecom-bot',
        questionText: '商机阶段分布',
        normalizedQuestion: '商机阶段分布',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      } as never,
      {
        workflowId: 'workflow_stage_distribution',
        scopeSummary: '全部数据范围',
        slices: [
          {
            datasetId: 'dataset_stage_1',
            taskId: 'task_stage_1',
            taskTitle: '商机数量阶段分布',
            resultKind: 'stage-distribution',
            purpose: 'distribution',
            sql: '-- SQLite stage query',
            summary: '已生成阶段分布。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'TABLE',
              title: '商机数量阶段分布',
              rows: duplicateRows,
            },
            secondaryViews: [],
            tableRows: duplicateRows,
            rowCount: duplicateRows.length,
          },
          {
            datasetId: 'dataset_stage_2',
            taskId: 'task_stage_2',
            taskTitle: '商机数量阶段分布',
            resultKind: 'stage-distribution',
            purpose: 'distribution',
            sql: '-- SQLite stage query',
            summary: '已生成阶段分布。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'TABLE',
              title: '商机数量阶段分布',
              rows: duplicateRows,
            },
            secondaryViews: [],
            tableRows: duplicateRows,
            rowCount: duplicateRows.length,
          },
        ],
        mergedRows: duplicateRows,
        totalRowCount: duplicateRows.length,
        appliedFilters: [],
      } as never,
    );

    expect(report.tableBlocks.map((item) => item.title)).toEqual(['商机数量阶段分布明细']);
  });

  it('趋势报告应在执行摘要中体现时间跨度、峰值月份与最近月份', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_001',
        channel: 'web-console',
        questionText: '请分析一下前三个月的商机情况',
        normalizedQuestion: '请分析一下前三个月的商机情况',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_001',
        scopeSummary: '华东销售范围',
        slices: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额趋势分析',
            resultKind: 'time-trend',
            purpose: 'primary-summary',
            sql: 'SELECT ...',
            summary: '已执行趋势查询。',
            appliedFilters: [],
            metricCards: [{ name: '累计金额', value: '19,200,000' }],
            primaryView: {
              viewType: 'LINE_CHART',
              title: '新增商机金额趋势分析',
              series: [
                { label: '2026-02', value: 5300000 },
                { label: '2026-03', value: 8200000 },
                { label: '2026-04', value: 5700000 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { bucket_label: '2026-02', ownerName: '2026-02', amount: 5300000, count: 12 },
              { bucket_label: '2026-03', ownerName: '2026-03', amount: 8200000, count: 15 },
              { bucket_label: '2026-04', ownerName: '2026-04', amount: 5700000, count: 11 },
            ],
            rowCount: 3,
          },
        ],
        mergedRows: [
          { bucket_label: '2026-02', ownerName: '2026-02', amount: 5300000, count: 12 },
          { bucket_label: '2026-03', ownerName: '2026-03', amount: 8200000, count: 15 },
          { bucket_label: '2026-04', ownerName: '2026-04', amount: 5700000, count: 11 },
        ],
        totalRowCount: 3,
        appliedFilters: [{ label: '时间范围', value: '前三个月' }],
      },
    );

    expect(report.variant).toBe('trend');
    expect(report.executiveSummary).toContain('2026-02 至 2026-04');
    expect(report.executiveSummary).toContain('峰值出现在 2026-03');
    expect(report.executiveSummary).toContain('最近一期为 2026-04');
    expect(report.keyFindings[0]?.detail).toContain('峰值出现在 2026-03');
    expect(report.keyFindings[0]?.detail).toContain('最近一期为 2026-04');
    expect(report.keyFindings[0]?.detail).not.toContain('领先');
  });

  it('排名报告摘要应同时说明分组数量和底层业务记录数，避免把两者混为一谈', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_001',
        channel: 'web-console',
        questionText: '最近一年各销售负责人新增商机金额排名',
        normalizedQuestion: '最近一年各销售负责人新增商机金额排名',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        tasks: [],
      },
      {
        workflowId: 'workflow_001',
        scopeSummary: '测试范围',
        slices: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额排名',
            resultKind: 'owner-ranking',
            purpose: 'primary-summary',
            sql: 'SELECT ...',
            summary: '已执行排名查询。',
            appliedFilters: [],
            metricCards: [
              { name: '累计金额', value: '13,843,700' },
              { name: '命中商机数', value: 22 },
              { name: '分组数量', value: 2 },
            ],
            primaryView: {
              viewType: 'BAR_CHART',
              title: '新增商机金额排名',
              series: [
                { label: '布春雨', value: 13777034 },
                { label: '王亮2', value: 66666 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { ownerId: 'owner_bu', ownerName: '布春雨', amount: 13777034, count: 20 },
              { ownerId: 'owner_wang', ownerName: '王亮2', amount: 66666, count: 2 },
            ],
            rowCount: 2,
          },
        ],
        mergedRows: [
          { ownerId: 'owner_bu', ownerName: '布春雨', amount: 13777034, count: 20 },
          { ownerId: 'owner_wang', ownerName: '王亮2', amount: 66666, count: 2 },
        ],
        totalRowCount: 2,
        appliedFilters: [{ label: '时间口径', value: '最近一年' }],
      },
    );

    expect(report.executiveSummary).toContain('2 个业务分组');
    expect(report.executiveSummary).toContain('22 条商机记录');
    expect(report.executiveSummary).toContain('1,377.7 万元');
    expect(report.executiveSummary).toContain('领先第二名');
    expect(report.keyFindings[0]?.detail).toContain('领先第二名');
    expect(report.metricCards).toEqual(
      expect.arrayContaining([
        { name: 'TOP1贡献占比', value: '99.5%' },
        { name: '平均单笔商机金额', value: '62.93 万元' },
        { name: '第一名领先第二名差距', value: '1,371.04 万元' },
      ]),
    );
    expect(report.metricCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '13,843,700' }),
        expect.objectContaining({ value: '629,259' }),
      ]),
    );
    expect(report.keyFindings.map((item) => item.detail).join(' ')).toContain('头部贡献');
  });

  it('负责人经营 richer report 应生成区块化结果、派生指标和行动建议', () => {
    const report = service.compose(
      {
        workflowId: 'workflow_001',
        channel: 'web-console',
        questionText: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
        normalizedQuestion: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
        domain: 'opportunity-analysis',
        confidence: 'HIGH',
        requestedAction: 'READONLY_ANALYSIS',
        missingConditions: [],
        analysisFacetProfile: 'owner-performance-ranking',
        analysisDepth: 'deep-dive',
        analysisFocus: ['trend', 'risk', 'customer-contribution'],
        tasks: [],
      } as never,
      {
        workflowId: 'workflow_001',
        scopeSummary: '测试范围',
        temporalScope: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          startAt: '2025-03-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          granularity: 'year',
          timezone: 'Asia/Shanghai',
          source: 'AI_TEMPORAL_SLOT',
        },
        slices: [
          {
            datasetId: 'dataset_owner',
            taskId: 'task_owner',
            taskTitle: '新增商机金额负责人排名',
            resultKind: 'owner-ranking',
            purpose: 'primary-summary',
            sql: 'SELECT ...',
            summary: '已执行负责人排名查询。',
            appliedFilters: [],
            metricCards: [
              { name: '累计金额', value: '6,450,000' },
              { name: '命中商机数', value: 8 },
              { name: '分组数量', value: 3 },
            ],
            primaryView: {
              viewType: 'BAR_CHART',
              title: '新增商机金额负责人排名',
              series: [
                { label: '王敏', value: 2150000 },
                { label: '张琳', value: 2020000 },
                { label: '李浩', value: 2280000 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { ownerId: 'owner_wang', ownerName: '王敏', amount: 2280000, count: 2 },
              { ownerId: 'owner_zhang', ownerName: '张琳', amount: 2150000, count: 3 },
              { ownerId: 'owner_li', ownerName: '李浩', amount: 2020000, count: 3 },
            ],
            rowCount: 3,
            temporalScope: {
              rawText: '最近一年',
              normalizedLabel: '最近一年',
              startAt: '2025-03-31T16:00:00.000Z',
              endAt: '2026-04-30T16:00:00.000Z',
              granularity: 'year',
              timezone: 'Asia/Shanghai',
              source: 'AI_TEMPORAL_SLOT',
            },
          },
          {
            datasetId: 'dataset_trend',
            taskId: 'task_trend',
            taskTitle: '新增商机金额月度趋势',
            resultKind: 'time-trend',
            purpose: 'trend-series',
            sql: 'SELECT ...',
            summary: '已执行趋势查询。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'LINE_CHART',
              title: '新增商机金额月度趋势',
              series: [
                { label: '2025-12', value: 1200000 },
                { label: '2026-01', value: 1800000 },
                { label: '2026-02', value: 1450000 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { bucket_label: '2025-12', ownerName: '2025-12', amount: 1200000, count: 2 },
              { bucket_label: '2026-01', ownerName: '2026-01', amount: 1800000, count: 3 },
              { bucket_label: '2026-02', ownerName: '2026-02', amount: 1450000, count: 3 },
            ],
            rowCount: 3,
            temporalScope: {
              rawText: '最近一年',
              normalizedLabel: '最近一年',
              startAt: '2025-03-31T16:00:00.000Z',
              endAt: '2026-04-30T16:00:00.000Z',
              granularity: 'year',
              timezone: 'Asia/Shanghai',
              source: 'AI_TEMPORAL_SLOT',
            },
          },
          {
            datasetId: 'dataset_risk',
            taskId: 'task_risk',
            taskTitle: '高风险商机观察',
            resultKind: 'risk-overview',
            purpose: 'risk-observation',
            sql: 'SELECT ...',
            summary: '已执行风险观察查询。',
            appliedFilters: [],
            metricCards: [],
            primaryView: {
              viewType: 'BAR_CHART',
              title: '高风险商机观察',
              series: [
                { label: '王敏', value: 2 },
                { label: '张琳', value: 1 },
              ],
            },
            secondaryViews: [],
            tableRows: [
              { ownerId: 'owner_wang', ownerName: '王敏', amount: 830000, count: 2 },
              { ownerId: 'owner_zhang', ownerName: '张琳', amount: 420000, count: 1 },
            ],
            rowCount: 2,
            temporalScope: {
              rawText: '最近一年',
              normalizedLabel: '最近一年',
              startAt: '2025-03-31T16:00:00.000Z',
              endAt: '2026-04-30T16:00:00.000Z',
              granularity: 'year',
              timezone: 'Asia/Shanghai',
              source: 'AI_TEMPORAL_SLOT',
            },
          },
        ],
        mergedRows: [],
        totalRowCount: 8,
        appliedFilters: [{ label: '时间口径', value: '最近一年' }],
      } as never,
    );

    expect(report.sections.map((item) => item.sectionType)).toEqual(
      expect.arrayContaining([
        'summary',
        'metric-strip',
        'trend',
        'risk',
        'focus-list',
        'detail-table',
        'actions',
      ]),
    );
    expect(report.metricCards).toEqual(
      expect.arrayContaining([
        { name: 'TOP1贡献占比', value: '35.3%' },
        { name: 'TOP3贡献占比', value: '100.0%' },
        { name: '平均单笔商机金额', value: '80.63 万元' },
        { name: '第一名领先第二名差距', value: '13 万元' },
      ]),
    );
    expect(report.sections.find((item) => item.sectionType === 'actions')?.items).toEqual(
      expect.arrayContaining([
        expect.stringContaining('头部负责人'),
        expect.stringContaining('高风险商机'),
      ]),
    );
  });
});
