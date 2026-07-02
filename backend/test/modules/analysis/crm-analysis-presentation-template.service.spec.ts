import type { AnalysisResultRecord } from '../../../src/shared/types/domain';
import { CrmAnalysisPresentationTemplateService } from '../../../src/modules/analysis/crm-analysis-presentation-template.service';
import {
  resolveCrmAnalysisQuestionTemplateRuleByQuestionNumber,
  resolveCrmAnalysisQuestionTemplateRuleByText,
} from '../../../src/modules/analysis/crm-analysis-question-template.registry';

describe('CrmAnalysisPresentationTemplateService', () => {
  function createResultRecord(overrides: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
    const base: AnalysisResultRecord = {
      requestId: 'query-template-test',
      questionText: '本月经营情况怎么样',
      title: 'CRM 智能分析报告',
      summary: '本月经营总览已生成。',
      report: {
        variant: 'summary',
        reportTitle: 'CRM 智能分析报告',
        executiveSummary: '本月经营总览已生成。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前用户可见范围',
        appliedFilters: [],
        availableActions: [],
      },
      scopeSummary: '当前用户可见范围',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      keyFindings: [],
      rowCount: 0,
      dataFreshnessAt: '2026-06-30T00:00:00.000Z',
      consistencyToken: 'template-test',
      streamBlocks: [],
      availableActions: [],
      returnedAt: '2026-06-30T00:00:00.000Z',
    };

    return {
      ...base,
      ...overrides,
      report: {
        ...base.report,
        ...overrides.report,
      },
    };
  }

  it('应把经营总览类问题匹配到经营总览卡', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '今天早上我应该看哪几个核心经营指标？',
    });

    const template = service.resolveTemplate({ result, questionText: result.questionText });

    expect(template.templateType).toBe('BUSINESS_OVERVIEW');
    expect(template.templateName).toBe('经营总览卡');
    expect(template.imageCardRequired).toBe(true);
    expect(template.renderHints.layout).toBe('METRIC_CARD');
  });

  it('应优先把权限口径类问题匹配到数据质量与权限口径卡', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '这次分析是不是全平台数据，为什么我不能看全国？',
    });

    const template = service.resolveTemplate({ result, questionText: result.questionText });

    expect(template.templateType).toBe('DATA_SCOPE_QUALITY');
    expect(template.templateName).toBe('数据质量与权限口径卡');
    expect(template.renderHints.tone).toBe('GOVERNANCE');
  });

  it('应把预计签约但未报价的问题匹配到商机风险清单卡', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '预计 30 天内签约但还没有报价的商机有哪些？',
      tableRows: [
        {
          opportunityName: '某重点商机',
          amount: 1800000,
        },
      ],
    });

    const template = service.resolveTemplate({ result, questionText: result.questionText });

    expect(template.templateType).toBe('OPPORTUNITY_RISK');
    expect(template.templateName).toBe('商机风险清单卡');
    expect(template.displayMode).toContain('MARKDOWN_TABLE');
  });

  it('应把渠道排名类问题匹配到渠道贡献排行卡', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '渠道订单金额排名前十是谁？',
      report: {
        ...createResultRecord().report,
        variant: 'ranking',
      },
      tableRows: [
        {
          partnerName: '华南核心代理',
          amount: 862000,
        },
      ],
    });

    const template = service.resolveTemplate({ result, questionText: result.questionText });

    expect(template.templateType).toBe('CHANNEL_RANKING');
    expect(template.templateName).toBe('渠道贡献排行卡');
    expect(template.renderHints.layout).toBe('RANKING');
  });

  it('附加模板时应补齐后续动作建议', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '本月业务漏斗哪里流失最严重？',
    });

    const templatedResult = service.attachTemplate({
      result,
      questionText: result.questionText,
    });

    expect(templatedResult.report.presentationTemplate?.templateType).toBe('FUNNEL_DIAGNOSIS');
    expect(templatedResult.report.nextBestQuestions).toEqual(
      expect.arrayContaining(['查看断点明细']),
    );
    expect(result.report.presentationTemplate).toBeUndefined();
  });

  it('应保证 300 个需求问题编号都有模板规则兜底', () => {
    const missingQuestionNumbers = Array.from({ length: 300 }, (_, index) => index + 1)
      .filter((questionNumber) =>
        !resolveCrmAnalysisQuestionTemplateRuleByQuestionNumber(questionNumber),
      );

    expect(missingQuestionNumbers).toEqual([]);
  });

  it('应把产品、人员、预警和客户市场类需求命中新补充模板', () => {
    expect(resolveCrmAnalysisQuestionTemplateRuleByText('产品目录、模块与实施工作量如何影响报价？')?.templateType)
      .toBe('PRODUCT_SOLUTION_STRUCTURE');
    expect(resolveCrmAnalysisQuestionTemplateRuleByText('各负责人本周商机推进和团队协同情况怎么样？')?.templateType)
      .toBe('OWNER_ORG_COLLABORATION');
    expect(resolveCrmAnalysisQuestionTemplateRuleByText('通知中心有哪些风险预警没有处理？')?.templateType)
      .toBe('ALERT_AUDIT_GOVERNANCE');
    expect(resolveCrmAnalysisQuestionTemplateRuleByText('当前重点客户和市场质量是否健康？')?.templateType)
      .toBe('CUSTOMER_SUCCESS_RENEWAL');
  });

  it('模板服务应优先使用 300 问注册表纠正展示模板', () => {
    const service = new CrmAnalysisPresentationTemplateService();
    const result = createResultRecord({
      questionText: '产品目录、模块与实施工作量如何影响报价？',
      report: {
        ...createResultRecord().report,
        variant: 'summary',
      },
    });

    const template = service.resolveTemplate({ result, questionText: result.questionText });

    expect(template.templateType).toBe('PRODUCT_SOLUTION_STRUCTURE');
    expect(template.templateName).toBe('产品与解决方案结构卡');
  });
});
