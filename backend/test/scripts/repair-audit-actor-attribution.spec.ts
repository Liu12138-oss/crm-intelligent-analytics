import { repairAuditActorAttributionState } from '../../scripts/repair-audit-actor-attribution';
import type { AppStorageState } from '../../src/shared/types/domain';

describe('repair-audit-actor-attribution', () => {
  function createState(): Pick<AppStorageState, 'auditEvents' | 'crmWxUserMaps'> {
    return {
      crmWxUserMaps: [
        {
          id: 'map_001',
          wxOrganizationId: 'wx_org_001',
          wxUserId: 'wx_sales_director',
          crmUserId: 'user_sales_director',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
      auditEvents: [
        {
          id: 'audit_robot_001',
          eventType: 'QUERY_SUCCEEDED',
          actorId: 'bot_crm_assistant',
          actorRoleIds: [],
          scopeSnapshot: {
            organizationIds: [],
            departmentIds: [],
            ownerIds: [],
            scopeSummary: '历史机器人误归因。',
          },
          sessionSnapshot: {
            senderId: 'wx_sales_director',
            botId: 'bot_crm_assistant',
          },
          riskLevel: 'LOW',
          reviewStatus: 'CONFIRMED',
          outcome: '查询成功',
          createdAt: '2026-05-18T00:00:00.000Z',
        },
        {
          id: 'audit_robot_002',
          eventType: 'WECOM_AUTH_FAILED',
          actorId: 'bot_crm_assistant',
          actorRoleIds: [],
          scopeSnapshot: {
            organizationIds: [],
            departmentIds: [],
            ownerIds: [],
            scopeSummary: '历史机器人误归因。',
          },
          sessionSnapshot: {
            senderId: 'wx_unbound_user',
            botId: 'bot_crm_assistant',
          },
          riskLevel: 'HIGH',
          reviewStatus: 'PENDING',
          outcome: '认证失败',
          createdAt: '2026-05-18T00:00:00.000Z',
        },
      ],
    };
  }

  it('dry-run 只统计不写入', () => {
    const state = createState();
    const summary = repairAuditActorAttributionState(state, { apply: false });

    expect(summary).toEqual({
      suspectedRobotCount: 2,
      mappedCrmCount: 1,
      unboundWecomCount: 1,
      unknownCount: 0,
      updatedCount: 0,
    });
    expect(state.auditEvents[0].actorId).toBe('bot_crm_assistant');
  });

  it('apply 才回填真实行为人与通道代理', () => {
    const state = createState();
    const summary = repairAuditActorAttributionState(state, { apply: true });

    expect(summary.updatedCount).toBe(2);
    expect(state.auditEvents[0]).toEqual(
      expect.objectContaining({
        actorId: 'user_sales_director',
        actorType: 'crm-user',
        actorExternalId: 'wx_sales_director',
        actorBindingStatus: 'BOUND_CRM',
        channelAgentId: 'bot_crm_assistant',
      }),
    );
    expect(state.auditEvents[1]).toEqual(
      expect.objectContaining({
        actorId: 'wecom:wx_unbound_user',
        actorDisplayName: '未绑定 CRM 用户（企业微信：wx_unbound_user）',
        actorBindingStatus: 'UNBOUND_WECOM',
      }),
    );
  });
});
