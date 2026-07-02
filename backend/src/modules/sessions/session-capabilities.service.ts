import { Injectable } from '@nestjs/common';
import type {
  AccessPolicyRecord,
  AnalysisCapabilitySnapshotRecord,
  CrmUser,
} from '../../shared/types/domain';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AccessDecisionService } from '../governance/access-decision.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';

@Injectable()
export class SessionCapabilitiesService {
  private readonly capabilitySnapshotTtlMs = Number(
    process.env.CRM_CAPABILITY_SNAPSHOT_TTL_MS ?? '30000',
  );
  private readonly capabilitySnapshots = new Map<
    string,
    {
      snapshot: AnalysisCapabilitySnapshotRecord;
      versionKey: string;
      expiresAt: number;
    }
  >();

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 生成收敛后的核心能力快照。
   *
   * 参数说明：`user` 为当前登录用户，`policy` 为当前访问策略，`context.sessionId` 用于短时缓存。
   * 返回值说明：只暴露 AI 配置治理、联调管理和企业微信普通 AI 对话状态，不暴露 CRM 问数、合同、证书、日报、导出或写回能力。
   * 调用注意事项：该快照服务于前端入口显示，不作为业务执行授权；真实执行链路仍由对应控制器和服务做固定前置校验。
   */
  buildCapabilitySnapshot(
    user: CrmUser,
    policy: AccessPolicyRecord,
    context?: {
      sessionId?: string;
    },
  ): AnalysisCapabilitySnapshotRecord {
    const startedAt = Date.now();
    const sessionId = context?.sessionId?.trim();
    const versionKey = this.buildCapabilityVersionKey(user, policy);
    if (sessionId) {
      const cachedSnapshot = this.getCachedCapabilitySnapshot(sessionId, versionKey);
      if (cachedSnapshot) {
        this.analysisLoggerService.logStep('核心能力快照命中缓存。', {
          sessionId,
          userId: user.id,
          durationMs: Date.now() - startedAt,
        });
        return cachedSnapshot;
      }
    }

    const webDecision = this.accessDecisionService.buildDecision(user, 'web-console');
    const wecomDecision = this.accessDecisionService.buildDecision(user, 'wecom-bot');
    const aiEnabled = this.localRuntimeConfigService.getAiConfig().enabled;
    const snapshot: AnalysisCapabilitySnapshotRecord = {
      serviceStatus: aiEnabled ? 'ONLINE' : 'DEGRADED',
      scopeSummary: webDecision.scopeSnapshot.scopeSummary,
      defaultAnalysisRoute: 'OPENAPI',
      analysisRoutes: [
        {
          route: 'OPENAPI',
          label: '企微普通 AI 对话',
          enabled: true,
          description: '当前仅通过企业微信机器人提供普通 AI 对话和已关闭业务能力提示。',
        },
      ],
      roleNames: user.roleNames,
      channels: policy.enabledChannels,
      domains: policy.allowedDomains,
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 0,
      exportDailyLimit: 0,
      remainingDailyExports: 0,
      historyEnabled: false,
      templateCount: 0,
      dataFreshnessAt: new Date().toISOString(),
      visibleMenus: webDecision.visibleMenus.filter((menuKey) =>
        ['ai-model-governance', 'connection-policy'].includes(menuKey),
      ),
      actionKeys: webDecision.actionKeys.filter((actionKey) =>
        ['ai_profile.manage', 'governance.policy.manage'].includes(actionKey),
      ),
      followUpAllowed: false,
      templateViewAllowed: false,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: wecomDecision.state,
      wecomBotAccessReason: wecomDecision.reason,
      queryAssetSummary: {
        timeSlot: 'CORE_AI_WECOM_ONLY',
        recommendedTemplates: [],
      },
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
      isApplicationSuperAdmin:
        webDecision.scopeSnapshot.scopeSource === 'application-super-admin',
    };

    if (sessionId) {
      this.capabilitySnapshots.set(sessionId, {
        snapshot,
        versionKey,
        expiresAt: Date.now() + this.capabilitySnapshotTtlMs,
      });
    }

    this.analysisLoggerService.logStep('核心能力快照构建完成。', {
      sessionId,
      userId: user.id,
      aiEnabled,
      visibleMenuCount: snapshot.visibleMenus.length,
      actionKeyCount: snapshot.actionKeys.length,
      durationMs: Date.now() - startedAt,
    });

    return snapshot;
  }

  invalidateAllSnapshots(): void {
    this.capabilitySnapshots.clear();
  }

  private getCachedCapabilitySnapshot(
    sessionId: string,
    versionKey: string,
  ): AnalysisCapabilitySnapshotRecord | undefined {
    const cached = this.capabilitySnapshots.get(sessionId);
    if (!cached) {
      return undefined;
    }

    if (cached.versionKey !== versionKey || cached.expiresAt <= Date.now()) {
      this.capabilitySnapshots.delete(sessionId);
      return undefined;
    }

    return cached.snapshot;
  }

  private buildCapabilityVersionKey(
    user: CrmUser,
    policy: AccessPolicyRecord,
  ): string {
    return JSON.stringify({
      userId: user.id,
      roleIds: [...user.roleIds].sort(),
      departmentIds: [...user.departmentIds].sort(),
      organizationIds: [...user.organizationIds].sort(),
      policyUpdatedAt: policy.updatedAt,
    });
  }
}
