import { AuditEventBuilderService } from '../../../src/modules/audit/audit-event-builder.service';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('AuditEventBuilderService', () => {
  const service = new AuditEventBuilderService();

  it('应为 CRM 用户生成已绑定行为人字段', () => {
    const user: CrmUser = {
      id: 'user_sales_director',
      name: '销售总监',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['user_sales_director'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      wecomSenderId: 'wx_sales_director',
    };

    expect(service.crmUserActor(user)).toEqual({
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      actorType: 'crm-user',
      actorDisplayName: '销售总监',
      actorExternalId: 'wx_sales_director',
      actorBindingStatus: 'BOUND_CRM',
    });
  });

  it('应为未绑定企业微信用户生成稳定主体', () => {
    expect(service.unboundWecomActor(' wx_unknown_user ')).toEqual({
      actorId: 'wecom:wx_unknown_user',
      actorRoleIds: [],
      actorType: 'wecom-user',
      actorDisplayName: '未绑定 CRM 用户（企业微信：wx_unknown_user）',
      actorExternalId: 'wx_unknown_user',
      actorBindingStatus: 'UNBOUND_WECOM',
    });
  });

  it('应为系统入口生成系统行为人字段', () => {
    expect(service.systemActor('system:wecom-bot-ingress', '企业微信机器人入口')).toEqual({
      actorId: 'system:wecom-bot-ingress',
      actorRoleIds: [],
      actorType: 'system',
      actorDisplayName: '企业微信机器人入口',
      actorBindingStatus: 'SYSTEM',
    });
  });

  it('应把企业微信机器人保存在通道代理字段', () => {
    expect(
      service.wecomChannelAgent({
        botId: 'bot_crm_assistant',
        channelAgentId: 'app_crm_assistant',
        rawSenderId: 'bot_crm_assistant',
      }),
    ).toEqual({
      channel: 'wecom-bot',
      channelAgentId: 'app_crm_assistant',
      channelAgentType: 'wecom-bot',
    });
  });
});
