import {
  buildCustomerCreateSummaryPrompt,
  detectWecomCrmCreateIntent,
  getMissingCustomerFields,
  isWecomCrmCreateConfirmMessage,
  parseOpportunityDraftUpdates,
} from '../../../src/modules/wecom/wecom-crm-create.helper';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('wecom crm create helper', () => {
  const mockUser: CrmUser = {
    id: 'user_sales_director',
    name: '销售总监',
    roleIds: ['role_sales_director'],
    roleNames: ['销售总监'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales'],
    ownerIds: ['owner_zhang'],
    isAdmin: false,
    exportAllowed: true,
    channels: ['wecom-bot'],
  };

  it('应只在明确创建入口时识别客户或商机创建意图', () => {
    expect(detectWecomCrmCreateIntent('新增客户')).toBe('Customer');
    expect(detectWecomCrmCreateIntent('帮我新建商机')).toBe('Opportunity');
    expect(detectWecomCrmCreateIntent('本月各销售负责人新增商机金额排名')).toBeUndefined();
    expect(detectWecomCrmCreateIntent('请分析一下最近四个月的商机情况')).toBeUndefined();
    expect(
      detectWecomCrmCreateIntent('有多少客户是没有报备商机的，分别创建了多长时间'),
    ).toBeUndefined();
    expect(detectWecomCrmCreateIntent('创建客户多长时间分布')).toBeUndefined();
  });

  it('应把关联产品别名解析为 productId，并保留未识别项', () => {
    const result = parseOpportunityDraftUpdates(
      '关联产品：云平台标准版、未知产品',
      {
        云平台标准版: 'prod_saas_standard',
      },
    );

    expect(result.updates.productIds).toEqual(['prod_saas_standard']);
    expect(result.unresolvedProducts).toEqual(['未知产品']);
  });

  it('客户默认值缺失时应把客户类型和客户来源纳入必填', () => {
    expect(
      getMissingCustomerFields(
        {
          name: '王亮集团',
          phone: '19899009900',
          itDecisionLocation: '武汉',
          unifiedSocialCreditCode: '234234234234234234',
        },
        {
          requireCategory: true,
          requireSource: true,
        },
      ),
    ).toEqual(['客户类型', '客户来源']);
  });

  it('客户创建摘要应显示客户类型和客户来源', () => {
    const summary = buildCustomerCreateSummaryPrompt(
      {
        name: '王亮集团',
        phone: '19899009900',
        itDecisionLocation: '武汉',
        unifiedSocialCreditCode: '234234234234234234',
        category: '测试',
        source: '测试啊',
      },
      mockUser,
    );

    expect(summary).toContain('客户类型：测试');
    expect(summary).toContain('客户来源：测试啊');
  });

  it('确认类短回复应支持常见肯定语气，同时避免把补充说明误判为确认', () => {
    expect(isWecomCrmCreateConfirmMessage('是的')).toBe(true);
    expect(isWecomCrmCreateConfirmMessage('好的')).toBe(true);
    expect(isWecomCrmCreateConfirmMessage('没问题')).toBe(true);
    expect(isWecomCrmCreateConfirmMessage('好的，改成王亮集团')).toBe(false);
  });
});
