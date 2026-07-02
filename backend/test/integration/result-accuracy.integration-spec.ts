import { ResultConsistencyService } from '../../src/modules/analysis/result-consistency.service';

describe('result accuracy', () => {
  const resultConsistencyService = new ResultConsistencyService();

  it('金额汇总与明细一致时应通过校验', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '新增商机金额', value: '1,270,000' },
          { name: '记录数', value: 2 },
          { name: '分组数量', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [
            { label: '王敏', value: 730000 },
            { label: '李浩', value: 540000 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
          { ownerId: 'owner_li', ownerName: '李浩', amount: 540000, count: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('存在派生金额指标卡时应仍优先校验累计金额，而不是误用平均单笔金额', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '平均单笔商机金额', value: '650,000' },
          { name: '累计金额', value: '1,300,000' },
          { name: '记录数', value: 2 },
          { name: '分组数量', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [
            { label: '王敏', value: 730000 },
            { label: '李浩', value: 570000 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
          { ownerId: 'owner_li', ownerName: '李浩', amount: 570000, count: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('金额包含小数时应允许按金额精度校验，不应因浮点误差拦截交付', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '累计金额', value: '200.30' },
          { name: '记录数', value: 2 },
          { name: '分组数量', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [
            { label: '王敏', value: 100.1 },
            { label: '李浩', value: 100.2 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 100.1, count: 1 },
          { ownerId: 'owner_li', ownerName: '李浩', amount: 100.2, count: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('服务商画像明细没有聚合分组键时不应被误判为重复业务分组', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '服务商画像统计',
        summary: '最近一年加入的服务商画像已生成。',
        metricCards: [
          { name: '服务商数量', value: 2 },
          { name: '技术服务商', value: 1 },
        ],
        primaryView: {
          viewType: 'DETAIL_TABLE',
          title: '服务商画像明细',
          rows: [
            {
              partnerId: 'P001',
              partnerName: '山东服务商',
              partnerLevel: 'gold',
              joinDate: '2026-05-28',
            },
            {
              partnerId: 'P002',
              partnerName: '北京服务商',
              partnerLevel: 'gold',
              joinDate: '2026-05-14',
            },
          ],
        },
        tableRows: [
          {
            partnerId: 'P001',
            partnerName: '山东服务商',
            partnerLevel: 'gold',
            joinDate: '2026-05-28',
          },
          {
            partnerId: 'P002',
            partnerName: '北京服务商',
            partnerLevel: 'gold',
            joinDate: '2026-05-14',
          },
        ],
      }),
    ).not.toThrow();
  });

  it('聚合排行存在重复业务分组时仍应拒绝交付', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '新增商机金额', value: '1,000,000' },
          { name: '记录数', value: 2 },
        ],
        primaryView: undefined,
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 500000, count: 1 },
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 500000, count: 1 },
        ],
      }),
    ).toThrow('结果集中存在重复业务分组');
  });

  it('金额汇总与明细不一致时应拒绝', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '新增商机金额', value: '1,000,000' },
          { name: '记录数', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [{ label: '王敏', value: 730000 }],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
          { ownerId: 'owner_li', ownerName: '李浩', amount: 540000, count: 1 },
        ],
      }),
    ).toThrow('金额汇总与结果明细不一致');
  });

  it('图表与明细属于不同粒度时不应误判为不一致', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '商机停滞风险分析',
        summary: '已按月份展示趋势，并列出停滞商机明细。',
        metricCards: [
          { name: '涉及商机金额', value: '127 万元' },
          { name: '命中商机数', value: 2 },
        ],
        primaryView: {
          viewType: 'LINE_CHART',
          title: '停滞商机月度趋势',
          series: [
            { label: '2026-05', value: 800000 },
            { label: '2026-06', value: 470000 },
          ],
        },
        tableRows: [
          { ownerId: 'opp_001', ownerName: '山东安全平台项目', amount: 800000, count: 1 },
          { ownerId: 'opp_002', ownerName: '河南终端准入项目', amount: 470000, count: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('商机进展明细只展示部分阶段桶时不应因数量小于总数被误拦', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '商机进展分析',
        summary: '已按商机阶段和月份分析当前商机进展。',
        metricCards: [
          { name: '商机数量', value: 44 },
          { name: '商机金额', value: '120 万元' },
        ],
        primaryView: {
          viewType: 'PIE_CHART',
          title: '商机阶段分布',
          series: [
            { label: '20%已登记/已报备', value: 20 },
            { label: '50%已报价', value: 10 },
          ],
        },
        tableRows: [
          {
            bucket_label: '20%已登记/已报备',
            ownerName: '20%已登记/已报备',
            count: 20,
            amount: 600000,
          },
          {
            bucket_label: '50%已报价',
            ownerName: '50%已报价',
            count: 10,
            amount: 600000,
          },
        ],
      }),
    ).not.toThrow();
  });

  it('记录数小于明细加总时仍应拒绝交付', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '商机数量分析',
        summary: '商机数量分析已生成。',
        metricCards: [
          { name: '商机数量', value: 1 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '商机阶段分布',
          series: [
            { label: '20%已登记/已报备', value: 2 },
          ],
        },
        tableRows: [
          {
            bucket_label: '20%已登记/已报备',
            ownerName: '20%已登记/已报备',
            count: 2,
          },
        ],
      }),
    ).toThrow('记录数与结果明细不一致');
  });

  it('合同总览指标与销售排名明细并存时应按总览数据集校验', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '2026年合同金额总览',
        summary: '2026年合同金额为 87,397,279.70，排名靠前的销售已生成。',
        metricCards: [
          { name: '合同金额', value: '87,397,279.70' },
          { name: '命中合同数', value: 689 },
          { name: '分组数量', value: 3 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '合同金额负责人前三排名',
          series: [
            { label: '文鹏', value: 5232277 },
            { label: '布春雨', value: 4826000 },
            { label: '李文斌', value: 3511300.05 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wen', ownerName: '文鹏', amount: 5232277, count: 15 },
          { ownerId: 'owner_bu', ownerName: '布春雨', amount: 4826000, count: 12 },
          { ownerId: 'owner_li', ownerName: '李文斌', amount: 3511300.05, count: 9 },
        ],
        report: {
          variant: 'ranking',
          reportTitle: '2026年合同金额总览',
          executiveSummary: '2026年合同金额为 87,397,279.70，排名靠前的销售已生成。',
          keyFindings: [],
          metricCards: [
            { name: '合同金额', value: '87,397,279.70' },
            { name: '命中合同数', value: 689 },
            { name: '分组数量', value: 3 },
          ],
          chartBlocks: [
            {
              blockId: 'chart_ranking',
              title: '合同金额负责人前三排名',
              viewType: 'BAR_CHART',
              series: [
                { label: '文鹏', value: 5232277 },
                { label: '布春雨', value: 4826000 },
                { label: '李文斌', value: 3511300.05 },
              ],
              datasetId: 'dataset_ranking',
            },
          ],
          tableBlocks: [
            {
              blockId: 'table_summary',
              title: '合同金额总览明细',
              datasetId: 'dataset_summary',
              rows: [
                {
                  ownerId: 'summary',
                  ownerName: '合同金额总览',
                  amount: 87397279.7,
                  count: 689,
                },
              ],
            },
            {
              blockId: 'table_ranking',
              title: '合同金额负责人前三排名明细',
              datasetId: 'dataset_ranking',
              rows: [
                { ownerId: 'owner_wen', ownerName: '文鹏', amount: 5232277, count: 15 },
                { ownerId: 'owner_bu', ownerName: '布春雨', amount: 4826000, count: 12 },
                { ownerId: 'owner_li', ownerName: '李文斌', amount: 3511300.05, count: 9 },
              ],
            },
          ],
          sections: [],
          datasetReferences: [
            {
              datasetId: 'dataset_summary',
              taskId: 'task_summary',
              taskTitle: '合同金额总览',
              purpose: 'primary-summary',
              rowCount: 1,
            },
            {
              datasetId: 'dataset_ranking',
              taskId: 'task_ranking',
              taskTitle: '合同金额负责人前三排名',
              purpose: 'detail-table',
              rowCount: 3,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [],
          availableActions: [],
        },
      }),
    ).not.toThrow();
  });

  it('金额指标名称保留转合同金额时也应从匹配的总览表块回算', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '2026年转合同金额总览',
        summary: '2026年转合同金额为 8,739.73 万元，排名靠前的销售已生成。',
        metricCards: [
          { name: '转合同金额', value: '8,739.73 万元' },
          { name: '命中合同数', value: 689 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '合同金额负责人前三排名',
          series: [
            { label: '文鹏', value: 5232277 },
            { label: '布春雨', value: 4826000 },
            { label: '李文斌', value: 3511300.05 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wen', ownerName: '文鹏', amount: 5232277, count: 15 },
          { ownerId: 'owner_bu', ownerName: '布春雨', amount: 4826000, count: 12 },
          { ownerId: 'owner_li', ownerName: '李文斌', amount: 3511300.05, count: 9 },
        ],
        report: {
          variant: 'ranking',
          reportTitle: '2026年转合同金额总览',
          executiveSummary: '2026年转合同金额为 8,739.73 万元，排名靠前的销售已生成。',
          keyFindings: [],
          metricCards: [
            { name: '转合同金额', value: '8,739.73 万元' },
            { name: '命中合同数', value: 689 },
          ],
          chartBlocks: [],
          tableBlocks: [
            {
              blockId: 'table_total',
              title: '转合同金额总览明细',
              datasetId: 'dataset_total',
              rows: [
                {
                  ownerId: 'summary',
                  ownerName: '转合同金额总览',
                  amount: 87397279.7,
                  count: 689,
                },
              ],
            },
            {
              blockId: 'table_ranking',
              title: '合同金额负责人前三排名明细',
              datasetId: 'dataset_ranking',
              rows: [
                { ownerId: 'owner_wen', ownerName: '文鹏', amount: 5232277, count: 15 },
                { ownerId: 'owner_bu', ownerName: '布春雨', amount: 4826000, count: 12 },
                { ownerId: 'owner_li', ownerName: '李文斌', amount: 3511300.05, count: 9 },
              ],
            },
          ],
          sections: [],
          datasetReferences: [
            {
              datasetId: 'dataset_total',
              taskId: 'task_total',
              taskTitle: '转合同金额总览',
              purpose: 'primary-summary',
              rowCount: 1,
            },
            {
              datasetId: 'dataset_ranking',
              taskId: 'task_ranking',
              taskTitle: '合同金额负责人前三排名',
              purpose: 'detail-table',
              rowCount: 3,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [],
          availableActions: [],
        },
      }),
    ).not.toThrow();
  });

  it('报告引用未登记数据集时应拒绝', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '共命中 2 条记录。',
        metricCards: [
          { name: '新增商机金额', value: '1,270,000' },
          { name: '记录数', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [{ label: '王敏', value: 730000 }],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
        ],
        report: {
          variant: 'ranking',
          reportTitle: '销售负责人新增商机金额排名报告',
          executiveSummary: '共命中 2 条记录。',
          keyFindings: [
            {
              title: '关键发现 1',
              detail: '王敏表现最好。',
              tone: 'positive',
              datasetId: 'dataset_missing',
            },
          ],
          metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额排名',
              purpose: 'primary-summary',
              rowCount: 1,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [],
          availableActions: [],
        },
      }),
    ).toThrow('报告块引用了未登记的数据集');
  });

  it('Markdown 总结与结构化执行摘要不一致时应拒绝交付', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '本月华东区域新增商机金额排名已生成。',
        metricCards: [
          { name: '新增商机金额', value: '1,270,000' },
          { name: '记录数', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [{ label: '王敏', value: 730000 }],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
        ],
        report: {
          variant: 'ranking',
          reportTitle: '销售负责人新增商机金额排名报告',
          executiveSummary: '本月华东区域新增商机金额排名已生成。',
          keyFindings: [],
          metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额排名',
              purpose: 'primary-summary',
              rowCount: 1,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [],
          groundedMarkdown: '## 执行摘要\n这里是一段与当前结果无关的摘要。',
          availableActions: [],
        },
      }),
    ).toThrow('Markdown 总结与结构化结果不一致');
  });

  it('forecastInsight 已就绪但 detailMarkdown 未体现预测区块时应拒绝交付', () => {
    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '销售负责人新增商机金额排名',
        summary: '本月华东区域新增商机金额排名已生成。',
        metricCards: [
          { name: '新增商机金额', value: '730,000' },
          { name: '记录数', value: 1 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [{ label: '王敏', value: 730000 }],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
        ],
        report: {
          variant: 'ranking',
          reportTitle: '销售负责人新增商机金额排名报告',
          executiveSummary: '本月华东区域新增商机金额排名已生成。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'READY',
            direction: 'UP',
            summary: '当前趋势整体上行。',
          },
          forecastInsight: {
            status: 'READY',
            horizonLabel: '下一周期',
            predictedValue: 1380000,
            predictedRangeLow: 1310000,
            predictedRangeHigh: 1450000,
            confidenceLevel: 'MEDIUM',
            drivers: ['近四期趋势延续'],
            caveats: ['仅供短期参考'],
            summary: '预计下一周期大概率在 1310000 到 1450000 之间。',
          },
          anomalyInsights: [],
          riskInsights: [],
          recommendations: [
            {
              priority: 'HIGH',
              title: '优先跟进头部负责人项目',
              action: '复盘头部负责人的推进策略',
              reason: '头部贡献较高',
              evidenceKeys: ['top1-share'],
            },
          ],
          keyFindings: [],
          metricCards: [{ name: '新增商机金额', value: '730,000' }],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额排名',
              purpose: 'primary-summary',
              rowCount: 1,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [],
          groundedMarkdown: '## 执行摘要\n本月华东区域新增商机金额排名已生成。',
          workbenchMarkdown: '## 执行摘要\n本月华东区域新增商机金额排名已生成。',
          detailMarkdown: '## 执行摘要\n本月华东区域新增商机金额排名已生成。',
          wecomMarkdown: '## 执行摘要\n本月华东区域新增商机金额排名已生成。',
          availableActions: [],
        } as any,
      } as any),
    ).toThrow('richer report 内容与结构化洞察不一致');
  });

  it('报告块与 Markdown 引用不同时间口径时应拒绝交付', () => {
    const temporalScope = {
      rawText: '最近四个月',
      normalizedLabel: '最近四个月',
      startAt: '2025-12-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
      granularity: 'month',
      timezone: 'Asia/Shanghai',
      source: 'AI_TEMPORAL_SLOT' as const,
    };

    expect(() =>
      resultConsistencyService.ensureConsistent({
        title: '新增商机金额趋势分析',
        summary: '最近四个月新增商机金额趋势已生成。',
        metricCards: [
          { name: '新增商机金额', value: '1,270,000' },
          { name: '记录数', value: 1 },
        ],
        primaryView: {
          viewType: 'LINE_CHART',
          title: '新增商机金额趋势分析',
          series: [{ label: '2026-04', value: 1270000 }],
        },
        tableRows: [
          { bucket_label: '2026-04', ownerName: '2026-04', amount: 1270000, count: 1 },
        ],
        temporalScope,
        report: {
          variant: 'trend',
          reportTitle: '新增商机金额趋势分析',
          executiveSummary: '最近四个月新增商机金额趋势已生成。',
          temporalScope,
          keyFindings: [
            {
              title: '趋势观察 1',
              detail: '新增商机金额趋势分析覆盖最近四个月。',
              tone: 'neutral',
              datasetId: 'dataset_001',
            },
          ],
          metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
          chartBlocks: [
            {
              blockId: 'chart_001',
              title: '新增商机金额趋势分析（本月）',
              viewType: 'LINE_CHART',
              series: [{ label: '2026-04', value: 1270000 }],
              datasetId: 'dataset_001',
              temporalScope: {
                ...temporalScope,
                rawText: '本月',
                normalizedLabel: '本月',
              },
            } as any,
          ],
          tableBlocks: [
            {
              blockId: 'table_001',
              title: '新增商机金额趋势分析明细',
              rows: [
                { bucket_label: '2026-04', ownerName: '2026-04', amount: 1270000, count: 1 },
              ],
              datasetId: 'dataset_001',
              temporalScope,
            } as any,
          ],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额趋势分析',
              purpose: 'primary-summary',
              rowCount: 1,
            },
          ],
          scopeSummary: '测试范围',
          appliedFilters: [{ label: '时间口径', value: '最近四个月' }],
          groundedMarkdown: '## 新增商机金额趋势分析\n### 执行摘要\n最近四个月新增商机金额趋势已生成。\n> 时间口径：本月',
          availableActions: [],
        } as any,
      } as any),
    ).toThrow('结果时间口径不一致');
  });
});
