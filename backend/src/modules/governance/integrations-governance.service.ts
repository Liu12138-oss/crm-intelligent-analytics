import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AuditEventRecord,
  CrmUser,
  CrmWxUserMapRecord,
  CrmWxUserRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { AiModelProfileService } from '../ai-models/ai-model-profile.service';
import { AiProfileActivationService } from '../ai-models/ai-profile-activation.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { LianruanCrmDiagnosticsService } from '../crm-standard-api/lianruan-crm-diagnostics.service';
import { LianruanCrmOpenApiClient } from '../crm-standard-api/lianruan-crm-openapi.client';
import { AccessDecisionService } from './access-decision.service';
import { LianruanCrmConnectionConfigService } from './lianruan-crm-connection-config.service';
import { WecomPilotPolicyRepository } from './wecom-pilot-policy.repository';
import { WecomBotConnectionConfigService } from './wecom-bot-connection-config.service';
import { updateWecomPilotPolicySchema } from './access-governance.schema';

interface IdentityMappingInput {
  wecomUserId: string;
  wecomUserName?: string;
  crmUserId: string;
  departmentIds?: string[];
}

@Injectable()
export class IntegrationsGovernanceService {
  constructor(
    private readonly appStorage: AppStorageService,
    private readonly aiModelProfileService: AiModelProfileService,
    private readonly aiProfileActivationService: AiProfileActivationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly lianruanCrmConnectionConfigService: LianruanCrmConnectionConfigService,
    private readonly lianruanCrmOpenApiClient: LianruanCrmOpenApiClient,
    private readonly lianruanCrmDiagnosticsService: LianruanCrmDiagnosticsService,
    private readonly wecomBotConnectionConfigService: WecomBotConnectionConfigService,
    private readonly wecomPilotPolicyRepository: WecomPilotPolicyRepository,
  ) {}

  getStatus(user: CrmUser) {
    this.ensureManageAccess(user);
    const ai = this.resolveAiStatus();
    const wecom = this.wecomBotConnectionConfigService.getConfigView(user);
    const crmOpenApi = this.lianruanCrmConnectionConfigService.getConfigView(user);
    const identitySummary = this.resolveIdentityMappingSummary();
    const pilotPolicy = this.wecomPilotPolicyRepository.getCurrent();
    const recentErrors = this.auditEventRepository
      .list()
      .filter((event) => Boolean(event.failureReason) || event.riskLevel === 'HIGH')
      .slice(0, 5);

    return {
      checkedAt: new Date().toISOString(),
      ai,
      wecom,
      crmOpenApi,
      identityMapping: identitySummary,
      pilotPolicy,
      recentErrors,
    };
  }

  getWecomConfig(user: CrmUser) {
    return this.wecomBotConnectionConfigService.getConfigView(user);
  }

  updateWecomConfig(user: CrmUser, payload: unknown) {
    return this.wecomBotConnectionConfigService.updateConfig(user, payload);
  }

  async testWecomConfig(user: CrmUser, payload?: unknown) {
    return await this.wecomBotConnectionConfigService.testConfig(user, payload);
  }

  getCrmOpenApiConfig(user: CrmUser) {
    return this.lianruanCrmConnectionConfigService.getConfigView(user);
  }

  updateCrmOpenApiConfig(user: CrmUser, payload: unknown) {
    const view = this.lianruanCrmConnectionConfigService.updateConfig(user, payload);
    this.lianruanCrmOpenApiClient.clearAccessTokenCache();
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'CRM_OPENAPI_CONFIG_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '客户关系管理系统开放接口配置已更新。',
      },
      sessionSnapshot: {
        effectiveEnabled: view.effectiveEnabled,
        source: view.source,
        baseUrl: view.baseUrl,
        appKeyPresent: view.appKeyPresent,
        appSecretPresent: view.appSecretPresent,
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: '客户关系管理系统开放接口配置已更新。',
      createdAt: new Date().toISOString(),
    });
    return view;
  }

  async testCrmOpenApiConfig(user: CrmUser, payload?: unknown) {
    const result = await this.lianruanCrmConnectionConfigService.testConfig(
      user,
      payload,
    );
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'CRM_OPENAPI_CONFIG_TESTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '客户关系管理系统开放接口配置已执行自检。',
      },
      sessionSnapshot: {
        success: result.success,
        steps: result.steps,
      },
      riskLevel: result.success ? 'LOW' : 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: result.message,
      createdAt: result.checkedAt,
    });
    return result;
  }

  async getCrmOpenApiDiagnostics(user: CrmUser) {
    return await this.lianruanCrmDiagnosticsService.getDiagnostics(user);
  }

  listIdentityMappings(user: CrmUser, filters: { wecomUserId?: string }) {
    this.ensureManageAccess(user);
    const normalizedWecomUserId = filters.wecomUserId?.trim();
    const crmWxUsers = this.appStorage.state.crmWxUsers.filter((wxUser) =>
      normalizedWecomUserId ? wxUser.userid === normalizedWecomUserId : true,
    );
    const items = crmWxUsers.map((wxUser) =>
      this.buildIdentityMappingView(wxUser),
    );
    return {
      items,
      total: items.length,
      summary: this.resolveIdentityMappingSummary(),
    };
  }

  upsertIdentityMapping(user: CrmUser, payload: IdentityMappingInput) {
    this.ensureManageAccess(user);
    const now = new Date().toISOString();
    const wecomUserId = String(payload.wecomUserId ?? '').trim();
    const crmUserId = String(payload.crmUserId ?? '').trim();
    if (!wecomUserId || !crmUserId) {
      throw new BadRequestException('企业微信用户编号和系统用户编号不能为空。');
    }

    let wxUser = this.appStorage.state.crmWxUsers.find(
      (item) => item.userid === wecomUserId,
    );
    if (!wxUser) {
      wxUser = {
        id: buildEntityId('crm_wx_user'),
        wxOrganizationId: 'runtime_wecom_org',
        userid: wecomUserId,
        originUserid: wecomUserId,
        name: payload.wecomUserName?.trim() || wecomUserId,
        departmentIds: payload.departmentIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      this.appStorage.state.crmWxUsers.unshift(wxUser);
    } else {
      wxUser.name = payload.wecomUserName?.trim() || wxUser.name;
      wxUser.departmentIds = payload.departmentIds ?? wxUser.departmentIds;
      wxUser.updatedAt = now;
    }

    const currentMap = this.appStorage.state.crmWxUserMaps.find(
      (item) => item.wxUserId === wxUser!.id,
    );
    const nextMap: CrmWxUserMapRecord = {
      id: currentMap?.id ?? buildEntityId('crm_wx_user_map'),
      wxOrganizationId: wxUser.wxOrganizationId,
      wxUserId: wxUser.id,
      crmUserId,
      createdAt: currentMap?.createdAt ?? now,
      updatedAt: now,
    };
    this.appStorage.state.crmWxUserMaps =
      this.appStorage.state.crmWxUserMaps.filter(
        (item) => item.id !== nextMap.id && item.wxUserId !== wxUser!.id,
      );
    this.appStorage.state.crmWxUserMaps.unshift(nextMap);
    this.appStorage.persist();
    const view = this.buildIdentityMappingView(wxUser);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'IDENTITY_MAPPING_DIAGNOSTIC_QUERIED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '企业微信用户和系统用户映射已保存。',
      },
      sessionSnapshot: view,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信用户 ${wecomUserId} 已绑定到系统用户 ${crmUserId}。`,
      createdAt: now,
    });
    return view;
  }

  getPilotPolicy(user: CrmUser) {
    this.ensureManageAccess(user);
    return this.wecomPilotPolicyRepository.getCurrent();
  }

  updatePilotPolicy(user: CrmUser, payload: unknown) {
    this.ensureManageAccess(user);
    const parsed = updateWecomPilotPolicySchema.parse(payload);
    const current = this.wecomPilotPolicyRepository.getCurrent();
    const saved = this.wecomPilotPolicyRepository.save({
      channel: 'wecom-bot',
      mode: parsed.mode,
      allowUserIds: [...parsed.allowUserIds],
      allowRoleIds: [...parsed.allowRoleIds],
      allowDepartmentIds: [...parsed.allowDepartmentIds],
      denyUserIds: [...parsed.denyUserIds],
      note: parsed.note,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_PILOT_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '企业微信灰度策略已更新。',
      },
      sessionSnapshot: {
        before: current,
        after: saved,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信灰度策略已切换为 ${saved.mode}。`,
      createdAt: saved.updatedAt,
    });
    return saved;
  }

  listAuditEvents(
    user: CrmUser,
    params: {
      eventType?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    this.ensureManageAccess(user);
    const page = Math.max(Math.floor(params.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Math.floor(params.pageSize ?? 20), 1), 100);
    const events = this.auditEventRepository
      .list()
      .filter((event) =>
        params.eventType ? event.eventType === params.eventType : true,
      );
    return {
      items: events.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: events.length,
    };
  }

  private ensureManageAccess(user: CrmUser): void {
    if (user.isAdmin) {
      return;
    }
    this.accessDecisionService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权访问联调管理能力。',
    );
  }

  private resolveAiStatus() {
    const profiles = this.aiModelProfileService.list();
    const activation = this.aiProfileActivationService.getCurrentActivation();
    const activeProfile = profiles.find(
      (profile) => profile.id === activation.activeProfileId,
    );
    return {
      profileCount: profiles.length,
      activeProfileId: activation.activeProfileId,
      activeProfileName: activeProfile?.name,
      activeProviderCode: activeProfile?.providerCode,
      activeModel: activeProfile?.model,
      activeSdkType: activeProfile?.sdkType,
      lastVerifiedAt: activation.lastVerifiedAt,
      lastVerificationStatus: activation.lastVerificationStatus,
      ready: Boolean(activeProfile),
    };
  }

  private resolveIdentityMappingSummary() {
    const totalWecomUsers = this.appStorage.state.crmWxUsers.length;
    const mappedWecomUserIds = new Set(
      this.appStorage.state.crmWxUserMaps.map((item) => item.wxUserId),
    );
    const mappedCount = this.appStorage.state.crmWxUsers.filter((item) =>
      mappedWecomUserIds.has(item.id),
    ).length;
    return {
      totalWecomUsers,
      mappedCount,
      unmappedCount: Math.max(totalWecomUsers - mappedCount, 0),
    };
  }

  private buildIdentityMappingView(wxUser: CrmWxUserRecord) {
    const maps = this.appStorage.state.crmWxUserMaps.filter(
      (item) => item.wxUserId === wxUser.id,
    );
    const crmUserIds = maps.map((item) => item.crmUserId);
    const status =
      maps.length === 0
        ? 'UNMAPPED'
        : maps.length > 1
          ? 'CONFLICTED'
          : 'MAPPED';
    return {
      wecomUserId: wxUser.userid,
      wecomInternalId: wxUser.id,
      wecomUserName: wxUser.name,
      departmentIds: wxUser.departmentIds,
      crmUserId: crmUserIds[0],
      crmUserIds,
      status,
      reason:
        status === 'UNMAPPED'
          ? '当前企业微信用户未绑定系统用户。'
          : status === 'CONFLICTED'
            ? '当前企业微信用户存在多个系统用户映射，请保留唯一绑定。'
            : '当前企业微信用户已完成系统用户绑定。',
      updatedAt: maps[0]?.updatedAt ?? wxUser.updatedAt,
    };
  }
}
