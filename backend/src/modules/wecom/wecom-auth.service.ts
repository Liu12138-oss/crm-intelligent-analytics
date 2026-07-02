import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type { ChannelType, CrmUser } from '../../shared/types/domain';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { AccessDecisionService } from '../governance/access-decision.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { buildEntityId } from '../../shared/utils/id.util';
import { QueryExecutionTimeoutError } from '../analysis/analysis.errors';
import { LianruanCrmOpenApiAdapterService } from '../crm-standard-api/lianruan-crm-openapi.adapter.service';
import type { LianruanCrmOpenApiBoundUser } from '../crm-standard-api/lianruan-crm-openapi.types';
import { WecomBotConnectionConfigService } from '../governance/wecom-bot-connection-config.service';

@Injectable()
export class WecomAuthService {
  constructor(
    @Inject(CrmReadonlyService)
    private readonly crmReadonlyService: CrmReadonlyService,
    @Inject(AccessPolicyRepository)
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly accessDecisionService: AccessDecisionService,
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly auditEventRepository: AuditEventRepository,
    @Optional()
    private readonly lianruanCrmOpenApiAdapterService?: LianruanCrmOpenApiAdapterService,
    @Optional()
    private readonly wecomBotConnectionConfigService?: WecomBotConnectionConfigService,
  ) {}

  validateSignature(signature?: string): void {
    const config = this.resolveWecomRuntimeConfig();
    if (!config.botSignature || signature !== config.botSignature) {
      throw new ForbiddenException('企业微信签名校验失败。');
    }
  }

  validateSource(source?: string): void {
    const config = this.resolveWecomRuntimeConfig();
    if (!source || source !== config.botSource) {
      throw new ForbiddenException('企业微信消息来源校验失败。');
    }
  }

  validateBotId(botId?: string, options: { required?: boolean } = {}): void {
    const config = this.resolveWecomRuntimeConfig();
    if (!config.botId) {
      return;
    }

    if (!botId?.trim()) {
      if (options.required) {
        throw new ForbiddenException('企业微信机器人编号校验失败。');
      }
      return;
    }

    if (botId.trim() !== config.botId) {
      throw new ForbiddenException('企业微信机器人编号校验失败。');
    }
  }

  validateIncomingPayload(payload: {
    externalConversationId?: string;
    senderId?: string;
    messageId?: string;
    messageText?: string;
  }): void {
    if (
      !payload.externalConversationId?.trim() ||
      !payload.senderId?.trim() ||
      !payload.messageId?.trim() ||
      !payload.messageText?.trim()
    ) {
      throw new BadRequestException('企业微信消息结构不完整。');
    }
  }

  async resolveSender(
    senderId: string,
    targetChannel: ChannelType = 'wecom-bot',
  ): Promise<CrmUser> {
    const user = await this.resolveSenderFromPrimaryOrOpenApiFallback(senderId);
    if (!user) {
      const senderOnlyUser = this.resolveSenderOnlyCoreUser(senderId, targetChannel);
      if (senderOnlyUser) {
        return senderOnlyUser;
      }

      throw new ForbiddenException('当前企业微信用户未绑定 CRM 身份。');
    }

    this.ensureChannelAllowed(user, targetChannel);
    this.auditResolved(
      senderId,
      user,
      user.identitySource === 'crm-api'
        ? 'lianruan-standard-openapi-bound-user'
        : 'crm-wx-map',
    );
    return user;
  }

  async resolveSenderFromSessionCache(params: {
    senderId: string;
    requesterId: string;
    targetChannel?: ChannelType;
  }): Promise<CrmUser> {
    const targetChannel = params.targetChannel ?? 'wecom-bot';
    let cachedRequesterFailure: ForbiddenException | undefined;
    const resolvedUser = await this.resolveCachedRequester(params.requesterId).catch(
      (error: unknown) => {
        if (error instanceof ForbiddenException) {
          cachedRequesterFailure = error;
          return undefined;
        }

        throw error;
      },
    );
    const user = resolvedUser
      ? {
          ...resolvedUser,
          // 会话缓存路径沿用首次通过企业微信身份映射建立的权限口径，
          // 避免测试桩或本地只读上下文把 identitySource 退回成 mock 后误触发权限拒绝。
          identitySource:
            resolvedUser.identitySource === 'mock'
              ? 'database'
            : resolvedUser.identitySource,
        }
      : undefined;
    if (!user) {
      const remappedUser = await this.resolveSenderFromPrimaryOrOpenApiFallback(
        params.senderId,
      );
      if (!remappedUser) {
        const senderOnlyUser = this.resolveSenderOnlyCoreUser(
          params.senderId,
          targetChannel,
        );
        if (senderOnlyUser) {
          return senderOnlyUser;
        }

        if (cachedRequesterFailure) {
          throw cachedRequesterFailure;
        }
        throw new ForbiddenException('当前企业微信会话中的 CRM 用户已失效。');
      }

      this.ensureChannelAllowed(remappedUser, targetChannel);
      return remappedUser;
    }

    try {
      this.ensureChannelAllowed(user, targetChannel);
      return user;
    } catch (error) {
      const remappedUser = await this.resolveUserWithIdentityTimeout(() =>
        this.crmReadonlyService.getUserByWecomSenderId(params.senderId),
      );
      if (!remappedUser) {
        const senderOnlyUser = this.resolveSenderOnlyCoreUser(
          params.senderId,
          targetChannel,
        );
        if (senderOnlyUser) {
          return senderOnlyUser;
        }

        throw error;
      }

      const nextUser = {
        ...remappedUser,
        identitySource:
          remappedUser.identitySource === 'mock'
            ? 'database'
            : remappedUser.identitySource,
      };
      this.ensureChannelAllowed(nextUser, targetChannel);
      return nextUser;
    }
  }

  async resolveWebLoginUser(params: {
    crmUserId?: string;
    mobile?: string;
    email?: string;
  }): Promise<CrmUser> {
    if (params.crmUserId) {
      const boundUser = await this.resolveUserWithIdentityTimeout(() =>
        this.crmReadonlyService.getUserById(params.crmUserId!),
      );
      if (boundUser) {
        this.ensureChannelAllowed(boundUser, 'web-console');
        return boundUser;
      }
    }

    const fallbackIdentity = params.mobile ?? params.email;
    if (fallbackIdentity) {
      const fallbackUser = await this.resolveUserWithIdentityTimeout(() =>
        this.crmReadonlyService.getUserByPhoneOrEmail(fallbackIdentity),
      );
      if (fallbackUser) {
        this.ensureChannelAllowed(fallbackUser, 'web-console');
        return fallbackUser;
      }
    }

    throw new ForbiddenException(
      '当前企业微信账号未返回可匹配的手机号或邮箱，无法绑定有效的 CRM 用户。',
    );
  }

  async resolveMappedWebLoginUser(
    wecomUserId: string,
  ): Promise<CrmUser | undefined> {
    const user = await this.resolveUserWithIdentityTimeout(() =>
      this.crmReadonlyService.getUserByWecomSenderId(wecomUserId),
    );
    if (!user) {
      return undefined;
    }

    this.ensureChannelAllowed(user, 'web-console');
    this.auditResolved(wecomUserId, user, 'crm-wx-map-web-login');
    return user;
  }

  private ensureChannelAllowed(
    user: CrmUser,
    targetChannel: ChannelType,
  ): void {
    const policy = this.accessPolicyRepository.getCurrent();
    const decision = this.accessDecisionService.buildDecision(user, targetChannel);
    if (!policy.enabledChannels.includes(targetChannel) || decision.state === 'CHANNEL_DISABLED') {
      throw new ForbiddenException(
        targetChannel === 'web-console'
          ? '当前用户未开通 Web 登录入口。'
          : decision.reason ?? '当前企业微信机器人入口暂未开放，请先使用 Web 工作台。',
      );
    }

    if (!decision.allowed) {
      if (targetChannel === 'wecom-bot') {
        this.auditEventRepository.create({
          id: buildEntityId('audit'),
          eventType: 'WECOM_PILOT_ACCESS_DENIED',
          actorId: user.id,
          actorRoleIds: user.roleIds,
          actorType: 'crm-user',
          actorDisplayName: user.name,
          actorExternalId: user.wecomSenderId,
          actorBindingStatus: 'BOUND_CRM',
          channel: 'wecom-bot',
          channelAgentType: 'wecom-bot',
          scopeSnapshot: {
            organizationIds: user.organizationIds,
            departmentIds: user.departmentIds,
            ownerIds: user.ownerIds,
            scopeSummary: '企业微信入口灰度或角色权限拒绝。',
          },
          sessionSnapshot: {
            accessState: decision.state,
            reason: decision.reason,
            wecomPilotSnapshot: decision.wecomPilotSnapshot,
          },
          riskLevel: 'LOW',
          reviewStatus: 'CONFIRMED',
          outcome: decision.reason ?? '企业微信入口已拒绝。',
          failureReason: decision.reason,
          actionSummary: '企业微信灰度准入被拒绝。',
          targetType: 'wecom-access-policy',
          targetSummary: '企业微信机器人入口',
          createdAt: new Date().toISOString(),
        });
      }

      throw new ForbiddenException(
        targetChannel === 'web-console'
          ? '当前用户无权使用 Web 登录入口。'
          : decision.reason ?? '当前用户无权使用企业微信问数能力。',
      );
    }
  }

  /**
   * 在 AI + 企微核心模式下构造 senderId 临时身份。
   *
   * 参数说明：`senderId` 为企业微信发送人，`targetChannel` 必须是机器人通道。
   * 返回值说明：满足核心模式准入时返回无 CRM 权限的临时用户，否则返回 undefined。
   * 调用注意事项：该身份只用于普通 AI 对话，不具备 CRM 查询、导出或写回权限。
   */
  private resolveSenderOnlyCoreUser(
    senderId: string,
    targetChannel: ChannelType,
  ): CrmUser | undefined {
    if (!this.isSenderOnlyCoreIdentityEnabled(targetChannel)) {
      return undefined;
    }

    const policy = this.accessPolicyRepository.getCurrent();
    if (!policy.enabledChannels.includes('wecom-bot')) {
      throw new ForbiddenException('当前企业微信机器人入口暂未开放，请先使用 Web 工作台。');
    }

    const normalizedSenderId = senderId.replace(/[^\w-]/gu, '_');
    return {
      id: `wecom_sender_${normalizedSenderId}`,
      name: senderId,
      roleIds: [],
      roleNames: [],
      organizationIds: [],
      departmentIds: [],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['wecom-bot'],
      wecomSenderId: senderId,
      identitySource: 'mirror-userid',
    };
  }

  /**
   * 判断是否允许使用 senderId 临时身份。
   *
   * 设计原因：第一阶段默认启用 CRM 问数，必须回到正式 CRM 身份映射；
   * 只有显式关闭业务动作时，普通 AI 对话才允许临时 senderId 身份。
   */
  private isSenderOnlyCoreIdentityEnabled(targetChannel: ChannelType): boolean {
    if (targetChannel !== 'wecom-bot') {
      return false;
    }

    if (process.env.WECOM_SENDER_ONLY_IDENTITY_ENABLED === 'false') {
      return false;
    }

    return process.env.WECOM_BUSINESS_ACTIONS_ENABLED === 'false';
  }

  private auditResolved(
    senderId: string,
    user: CrmUser,
    source: string,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_IDENTITY_RESOLVED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      actorType: 'crm-user',
      actorDisplayName: user.name,
      actorExternalId: senderId,
      actorBindingStatus: 'BOUND_CRM',
      channel: 'wecom-bot',
      channelAgentType: 'wecom-bot',
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `企业微信身份识别命中来源：${source}`,
      },
      sessionSnapshot: {
        senderId,
        resolveSource: source,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信发送者 ${senderId} 已识别为 CRM 用户 ${user.id}`,
      actionSummary: '企业微信身份映射已识别。',
      targetType: 'wecom-identity',
      targetId: senderId,
      targetSummary: `企业微信用户 ${senderId}`,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 企业微信身份链路遇到只读库抖动时，需要快速失败并返回统一提示，不能让会话无限挂起。
   * @param resolver 具体身份解析函数。
   * @returns 解析到的 CRM 用户，或 undefined。
   */
  private async resolveUserWithIdentityTimeout(
    resolver: () => Promise<CrmUser | undefined>,
  ): Promise<CrmUser | undefined> {
    try {
      return await resolver();
    } catch (error) {
      if (error instanceof QueryExecutionTimeoutError) {
        throw new ForbiddenException('当前无法确认你的 CRM 身份，请稍后重试。');
      }

      throw error;
    }
  }

  /**
   * 读取会话缓存中的 CRM 用户，查询超时时不直接终止，交给当前 sender 重新解析。
   *
   * 参数说明：`requesterId` 为会话中缓存的 CRM 用户 ID。
   * 返回值说明：查询到用户则返回，否则返回 `undefined`。
   * 调用注意事项：OpenAPI 临时身份不会存在于旧只读库，必须允许后续按 sender 重新兜底。
   */
  private async resolveCachedRequester(
    requesterId: string,
  ): Promise<CrmUser | undefined> {
    return await this.resolveUserWithIdentityTimeout(() =>
      this.crmReadonlyService.getUserById(requesterId),
    );
  }

  /**
   * 优先按 CRM 原生企微映射识别发送人，失败时按联软标准 OpenAPI 绑定用户兜底。
   *
   * 参数说明：`senderId` 为企业微信消息中的发送人 userid。
   * 返回值说明：返回已解析的 CRM 用户；无法解析时返回 `undefined`。
   * 调用注意事项：OpenAPI 兜底只用于第一阶段联调或 SQLite/OpenAPI 部署，
   * 其数据权限仍由标准 OpenAPI client 侧控制，不应替代正式 userid 级权限映射。
   */
  private async resolveSenderFromPrimaryOrOpenApiFallback(
    senderId: string,
  ): Promise<CrmUser | undefined> {
    let primaryIdentityFailure: ForbiddenException | undefined;
    try {
      const mappedUser = await this.resolveUserWithIdentityTimeout(() =>
        this.crmReadonlyService.getUserByWecomSenderId(senderId),
      );
      if (mappedUser) {
        return mappedUser;
      }
    } catch (error) {
      if (!(error instanceof ForbiddenException)) {
        throw error;
      }

      primaryIdentityFailure = error;
    }

    const fallbackUser = await this.resolveOpenApiBoundUserFallback(senderId);
    if (fallbackUser) {
      return fallbackUser;
    }

    if (primaryIdentityFailure) {
      throw primaryIdentityFailure;
    }

    return undefined;
  }

  /**
   * 将联软标准 OpenAPI 的绑定用户转换为系统内可执行问数的临时 CRM 用户。
   *
   * 参数说明：`senderId` 为企业微信发送人 userid。
   * 返回值说明：OpenAPI 已启用且远端返回绑定用户时返回临时用户，否则返回 `undefined`。
   * 调用注意事项：默认映射为最小问数角色 `role_region_manager`，避免把联调身份放大成系统管理员。
   */
  private async resolveOpenApiBoundUserFallback(
    senderId: string,
  ): Promise<CrmUser | undefined> {
    if (!this.lianruanCrmOpenApiAdapterService?.isEnabled()) {
      return undefined;
    }

    const context = await this.lianruanCrmOpenApiAdapterService.getCurrentContext();
    return this.buildOpenApiBoundCrmUser(context.user, senderId);
  }

  private resolveWecomRuntimeConfig() {
    return (
      this.wecomBotConnectionConfigService?.getEffectiveRuntimeConfig() ??
      this.localRuntimeConfigService.getWecomRuntimeConfig()
    );
  }

  /**
   * 构造联软标准 OpenAPI 绑定用户对应的临时 CRM 用户快照。
   *
   * 参数说明：
   * - `boundUser`：`/auth/me` 返回的绑定用户。
   * - `senderId`：当前企业微信发送人 userid。
   * 返回值说明：返回可进入现有权限判断链路的 CRM 用户对象。
   * 调用注意事项：角色只用于我方功能入口判断；真实数据范围以远端 OpenAPI token 权限为准。
   */
  private buildOpenApiBoundCrmUser(
    boundUser: LianruanCrmOpenApiBoundUser,
    senderId: string,
  ): CrmUser {
    const roleLabel = boundUser.role?.trim() || '联软 OpenAPI 绑定用户';
    const isAdmin = /admin|管理员|超管|系统管理员/iu.test(roleLabel);
    const roleId = isAdmin ? 'role_admin' : 'role_region_manager';
    const organizationId = boundUser.region
      ? `lianruan-region-${boundUser.region}`
      : 'lianruan-standard-openapi';
    const departmentId = boundUser.bigRegion
      ? `lianruan-big-region-${boundUser.bigRegion}`
      : organizationId;

    return {
      id: String(boundUser.id),
      name: boundUser.name || boundUser.username || String(boundUser.id),
      roleIds: [roleId],
      roleNames: [roleLabel],
      organizationIds: [organizationId],
      departmentIds: [departmentId],
      ownerIds: [String(boundUser.id)],
      isAdmin,
      exportAllowed: isAdmin,
      channels: ['web-console', 'wecom-bot'],
      wecomSenderId: senderId,
      identitySource: 'crm-api',
    };
  }
}
