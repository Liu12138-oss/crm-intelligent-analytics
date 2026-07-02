import * as fs from 'fs';
import * as path from 'path';
import { WecomDashboardTemplateResolverService } from '../../../src/modules/wecom/wecom-dashboard-template-resolver.service';
import {
  WECOM_DASHBOARD_TEMPLATE_DEFINITIONS,
  type WecomDashboardTemplateCode,
} from '../../../src/modules/wecom/wecom-dashboard-template.registry';
import type { DashboardBlock } from '../../../src/modules/crm-standard-api/dashboard-report-composer.service';
import type { CrmAnalysisPresentationTemplateType } from '../../../src/shared/types/domain';

const CRM_ANALYSIS_TEMPLATE_TO_WECOM_DASHBOARD_TEMPLATE: Record<
  CrmAnalysisPresentationTemplateType,
  WecomDashboardTemplateCode
> = {
  BUSINESS_OVERVIEW: 'BUSINESS_OVERVIEW',
  FUNNEL_DIAGNOSIS: 'FUNNEL_DIAGNOSIS',
  REGION_COMPARISON: 'REGION_COMPARISON',
  CHANNEL_RANKING: 'CHANNEL_RANKING',
  CHANNEL_PROFILE: 'CHANNEL_PROFILE',
  DISTRIBUTION_HIERARCHY: 'DISTRIBUTION_HEALTH',
  TECH_SERVICE_ECOSYSTEM: 'SERVICE_ECOSYSTEM',
  REGISTRATION_PROTECTION: 'REGISTRATION_PROTECTION',
  OPPORTUNITY_RISK: 'OPPORTUNITY_RISK',
  QUOTE_ORDER_CONVERSION: 'QUOTE_TO_ORDER',
  DATA_SCOPE_QUALITY: 'DATA_SCOPE_QUALITY',
  OPERATING_CADENCE: 'CADENCE_REPORT',
  PRODUCT_SOLUTION_STRUCTURE: 'PRODUCT_SOLUTION',
  CUSTOMER_SUCCESS_RENEWAL: 'RENEWAL_SUCCESS',
  OWNER_ORG_COLLABORATION: 'CADENCE_REPORT',
  ALERT_AUDIT_GOVERNANCE: 'DATA_SCOPE_QUALITY',
};

describe('WecomDashboardTemplateResolverService', () => {
  const service = new WecomDashboardTemplateResolverService();
  const blocks: DashboardBlock[] = [
    {
      blockId: 'dashboard-kpi',
      blockType: 'kpi-matrix',
      title: '核心指标',
      metrics: [],
    },
  ];

  it('14 类模板编码和标题应保持唯一', () => {
    const codes = new Set(WECOM_DASHBOARD_TEMPLATE_DEFINITIONS.map((template) => template.code));
    const titles = new Set(WECOM_DASHBOARD_TEMPLATE_DEFINITIONS.map((template) => template.cardTitle));

    expect(WECOM_DASHBOARD_TEMPLATE_DEFINITIONS).toHaveLength(14);
    expect(codes.size).toBe(14);
    expect(titles.size).toBe(14);
  });

  it.each([
    ['全国渠道商发展运营情况', 'BUSINESS_OVERVIEW', '经营总览看板'],
    ['报备到订单转化漏斗断点在哪里', 'FUNNEL_DIAGNOSIS', '业务漏斗诊断'],
    ['哪些渠道贡献最大，前十渠道是谁', 'CHANNEL_RANKING', '渠道贡献排行'],
    ['山东区渠道经营表现如何', 'REGION_COMPARISON', '区域经营对比'],
    ['哪些渠道活跃，哪些渠道需要激活', 'CHANNEL_PROFILE', '渠道画像诊断'],
    ['哪些客户报备快到期，有没有重复报备', 'REGISTRATION_PROTECTION', '报备保护与渠道冲突'],
    ['预计签约但还没有报价的商机有哪些', 'OPPORTUNITY_RISK', '商机风险清单'],
    ['本周哪些报价最可能转订单', 'QUOTE_TO_ORDER', '报价转订单预测'],
    ['哪些客户 30 天内需要续费', 'RENEWAL_SUCCESS', '续费与客户成功'],
    ['终端安全相关商机和报价情况怎么样', 'PRODUCT_SOLUTION', '产品与解决方案结构'],
    ['技术服务商发展情况怎么样', 'SERVICE_ECOSYSTEM', '技术服务商生态'],
    ['一级二级渠道协同是否正常', 'DISTRIBUTION_HEALTH', '分销层级健康'],
    ['生成本周经营复盘', 'CADENCE_REPORT', '经营节奏报告'],
    ['当前数据口径是否受我的权限影响', 'DATA_SCOPE_QUALITY', '数据质量与权限口径'],
  ] as const)('问题“%s”应识别为 %s', (questionText, expectedCode, expectedCardTitle) => {
    const template = service.resolve({
      questionText,
      reportTitle: '联软 CRM 数据运营分析看板',
      blocks,
    });

    expect(template.code).toBe(expectedCode);
    expect(template.cardTitle).toBe(expectedCardTitle);
  });

  it('P3 300 问覆盖矩阵应全部映射到 14 类企微动态看板模板', () => {
    const matrixPath = path.resolve(
      __dirname,
      '../../../../docs/testing/CRM智能分析300问覆盖矩阵_20260630.md',
    );
    const matrixText = fs.readFileSync(matrixPath, 'utf8');
    const rows = [...matrixText.matchAll(
      /^\| (Q\d{3}) \| `([A-Z_]+)` [^|]* \| [^|]* \| [^|]* \| (.*?) \| `[^`]+` \|$/gm,
    )].map((match) => ({
      questionId: match[1],
      crmTemplateType: match[2] as CrmAnalysisPresentationTemplateType,
      questionText: match[3],
    }));

    expect(rows).toHaveLength(300);

    const mismatches = rows
      .map((row) => {
        const template = service.resolve({
          questionText: row.questionText,
          reportTitle: '联软 CRM 数据运营分析看板',
          blocks,
        });
        return {
          ...row,
          expectedCode: CRM_ANALYSIS_TEMPLATE_TO_WECOM_DASHBOARD_TEMPLATE[row.crmTemplateType],
          actualCode: template.code,
        };
      })
      .filter((row) => row.actualCode !== row.expectedCode);

    expect(mismatches).toEqual([]);
  });
});
