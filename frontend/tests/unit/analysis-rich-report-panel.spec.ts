import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AnalysisRichReportPanel from '@/components/analysis/AnalysisRichReportPanel.vue';

describe('analysis rich report panel', () => {
  it('应渲染趋势预测、经营建议和完整 Markdown 折叠入口', async () => {
    const wrapper = mount(AnalysisRichReportPanel, {
      props: {
        report: {
          variant: 'trend',
          reportTitle: '新增商机金额趋势分析',
          executiveSummary: '最近四个月新增商机金额趋势已生成。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'READY',
            direction: 'UP',
            drivers: ['近四期趋势延续'],
            summary: '整体趋势上行。',
          },
          forecastInsight: {
            status: 'READY',
            horizonLabel: '下一周期',
            metricLabel: '新增商机金额',
            predictedValue: 162,
            predictedRangeLow: 150,
            predictedRangeHigh: 175,
            confidenceLevel: 'MEDIUM',
            drivers: ['近四期趋势延续'],
            caveats: ['当前预测仅供短期参考。'],
            summary: '预计下一周期大概率落在 150 到 175 之间。',
          },
          anomalyInsights: [],
          riskInsights: [
            {
              riskType: 'RESULT_RISK',
              title: '样本长度有限',
              detail: '当前结果仅包含 4 个时间点。',
              severity: 'MEDIUM',
            },
          ],
          recommendations: [
            {
              priority: 'HIGH',
              title: '提前排布头部项目推进',
              action: '提前锁定头部项目推进节奏。',
              reason: '趋势继续上行。',
              evidenceKeys: ['forecast-range'],
            },
          ],
          keyFindings: [],
          metricCards: [],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [],
          scopeSummary: '测试范围',
          appliedFilters: [],
          detailMarkdown: '## 执行摘要\n最近四个月新增商机金额趋势已生成。\n## 趋势预测\n预计下一周期大概率落在 150 到 175 之间。',
          availableActions: [],
        },
      },
      global: {
        stubs: {
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElTag: {
            template: '<span><slot /></span>',
          },
          ElIcon: {
            template: '<i><slot /></i>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('趋势预测');
    expect(wrapper.text()).toContain('经营建议');
    expect(wrapper.text()).toContain('下一周期的新增商机金额大概率在 150 到 175 之间');
    expect(wrapper.find('.analysis-rich-report__markdown-toggle').exists()).toBe(true);
  });

  it('默认应以结构化经营报告展示摘要、指标、发现、重点明细和建议，而不是直接铺开 Markdown', () => {
    const wrapper = mount(AnalysisRichReportPanel, {
      props: {
        report: {
          variant: 'summary',
          reportTitle: '近一周新增商机明细',
          executiveSummary: '本周全组织新增商机50笔，涉及金额559.33万元。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'UNAVAILABLE',
            drivers: [],
            summary: '当前数据为单周期快照，适合做结构观察。',
          },
          forecastInsight: {
            status: 'LOW_CONFIDENCE',
            horizonLabel: '下一周期',
            metricLabel: '预计金额',
            confidenceLevel: 'LOW',
            drivers: [],
            caveats: ['当前为方向性预测，请结合下周期数据复核。'],
            summary: '预计下一周期新增金额大概率落在 31.2 到 46.8 之间。',
          },
          anomalyInsights: [],
          riskInsights: [],
          recommendations: [
            {
              priority: 'HIGH',
              title: '优先复核重点项目',
              action: '优先确认大额项目负责人、阶段和预计签单日期。',
              reason: '头部项目金额占比较高。',
              evidenceKeys: ['top-row'],
            },
          ],
          keyFindings: [
            {
              title: '新增商机规模',
              detail: '本周新增商机50笔，总金额559.33万元。',
              tone: 'neutral',
              datasetId: 'dataset_1',
            },
          ],
          metricCards: [
            { name: '新增商机数', value: 50 },
            { name: '新增金额', value: 559.33 },
          ],
          chartBlocks: [],
          tableBlocks: [
            {
              blockId: 'table_1',
              datasetId: 'dataset_1',
              title: '近一周新增商机明细',
              rows: [
                {
                  customer_name: '宁波泰康脑科医院有限公司',
                  project_name: '准入桌管二期扩容',
                  owner_name: '李威V',
                  expected_amount: '15.00',
                  stage_name: '30%有预算且最认可',
                },
              ],
              columns: [],
            },
          ],
          sections: [],
          datasetReferences: [],
          scopeSummary: '测试范围',
          appliedFilters: [],
          detailMarkdown: '## 执行摘要\n这段 Markdown 默认不应直接展开。',
          availableActions: [],
        },
      },
    });

    expect(wrapper.find('.analysis-rich-report__hero').exists()).toBe(true);
    expect(wrapper.text()).toContain('本周全组织新增商机50笔');
    expect(wrapper.text()).toContain('新增商机数');
    expect(wrapper.text()).toContain('关键发现');
    expect(wrapper.text()).toContain('重点明细');
    expect(wrapper.text()).toContain('宁波泰康脑科医院有限公司');
    expect(wrapper.text()).toContain('经营建议');
    expect(wrapper.text()).toContain('仅供排布参考');
    expect(wrapper.text()).toContain('下一周期的预计金额大概率在 31.2 到 46.8 之间');
    expect(wrapper.text()).toContain('不是确定结论');
    expect(wrapper.text()).not.toContain('低置信');
    expect(wrapper.text()).not.toContain('这段 Markdown 默认不应直接展开');
    expect(wrapper.text()).not.toContain('UNAVAILABLE');
    expect(wrapper.text()).not.toContain('不具备预测条件');
    expect(wrapper.text()).not.toContain('风险与边界');
  });

  it('汇总模板结果应展示为重点汇总项，不应冒充重点明细', () => {
    const wrapper = mount(AnalysisRichReportPanel, {
      props: {
        report: {
          variant: 'ranking',
          reportTitle: '承诺商机季度拆分',
          executiveSummary: '本次返回 2 条汇总结果，核心指标为承诺商机 3867.32。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'READY',
            drivers: ['按团队汇总'],
            summary: '当前团队承诺商机呈头部集中。',
          },
          forecastInsight: {
            status: 'LOW_CONFIDENCE',
            horizonLabel: '下一周期',
            metricLabel: '承诺商机',
            confidenceLevel: 'LOW',
            drivers: ['按团队汇总'],
            caveats: ['当前为汇总结果，只适合作为排布参考。'],
            summary: '预计下一周期承诺商机大概率在 1800 到 2300 之间。',
          },
          anomalyInsights: [],
          riskInsights: [],
          recommendations: [],
          keyFindings: [],
          metricCards: [{ name: '承诺商机', value: 3867.32 }],
          chartBlocks: [],
          tableBlocks: [
            {
              blockId: 'table_1',
              datasetId: 'dataset_1',
              title: '承诺商机季度拆分',
              rows: [
                {
                  team_name: '大北区-北区金融部',
                  committed_amount: 2151.52,
                  q2_committed_amount: 856.99,
                  opportunity_count: 496,
                },
                {
                  team_name: '大南区-南区金融部',
                  committed_amount: 1715.8,
                  q2_committed_amount: 890.37,
                  opportunity_count: 707,
                },
              ],
              columns: [],
            },
          ],
          sections: [],
          datasetReferences: [],
          scopeSummary: '测试范围',
          appliedFilters: [],
          detailMarkdown: '## 执行摘要\n本次返回 2 条汇总结果。',
          availableActions: [],
        },
      },
    });

    expect(wrapper.text()).toContain('重点汇总项');
    expect(wrapper.text()).toContain('大北区-北区金融部');
    expect(wrapper.text()).toContain('承诺商机 2,151.52');
    expect(wrapper.text()).not.toContain('重点明细');
    expect(wrapper.text()).not.toContain('未命名明细');
  });

  it('应为模板报告正文中的数值增加语义色标', () => {
    const wrapper = mount(AnalysisRichReportPanel, {
      props: {
        report: {
          variant: 'summary',
          reportTitle: '全年完成预测总览',
          executiveSummary:
            '全年完成预测总览显示，当前有效收入6,112.03，短期预测区间18,152.53-27,228.79，离散度较高。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'READY',
            drivers: [],
            summary: '有效收入较上期增长12.5%。',
          },
          forecastInsight: {
            status: 'READY',
            horizonLabel: '下一周期',
            metricLabel: '全年完成预测',
            predictedRangeLow: 18152.53,
            predictedRangeHigh: 27228.79,
            confidenceLevel: 'MEDIUM',
            drivers: [],
            caveats: ['预测区间宽度达9,076.26，离散度较高。'],
            summary: '短期预测区间18,152.53-27,228.79，离散度较高。',
          },
          anomalyInsights: [],
          riskInsights: [
            {
              riskType: 'RESULT_RISK',
              title: '预测区间偏宽',
              detail: '区间宽度达9,076.26，离散度较高。',
              severity: 'MEDIUM',
            },
          ],
          recommendations: [],
          keyFindings: [
            {
              title: '有效收入入转化待强化',
              detail: '有效收入仅占全年预测的26.9%，需关注实际落地效率。',
              tone: 'risk',
              datasetId: 'dataset_1',
            },
          ],
          metricCards: [{ name: '有效收入', value: '6,112.03' }],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [],
          scopeSummary: '测试范围',
          appliedFilters: [],
          detailMarkdown: '',
          availableActions: [],
        },
      },
    });

    const highlightedNumbers = wrapper.findAll('.number-tone');

    expect(highlightedNumbers.length).toBeGreaterThanOrEqual(7);
    expect(wrapper.find('.number-tone[data-tone="success"]').text()).toBe('6,112.03');
    expect(wrapper.findAll('.number-tone[data-tone="danger"]').map((item) => item.text())).toContain('9,076.26');
    expect(wrapper.find('.number-tone[data-tone="normal"]').exists()).toBe(true);
  });
});
