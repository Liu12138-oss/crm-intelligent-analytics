import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import {
  type WecomRuntimeConfig,
  LocalRuntimeConfigService,
} from '../../shared/config/local-runtime-config.service';
import type {
  CrmUser,
  WecomBotConnectionConfigRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { PermissionEnforcementService } from './permission-enforcement.service';
import {
  type UpdateWecomBotConnectionConfigPayload,
  updateWecomBotConnectionConfigSchema,
} from './wecom-bot-connection-config.schema';

export interface WecomBotConnectionConfigView {
  useRuntimeConfig: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  source: 'env' | 'runtime' | 'mixed';
  botIdMasked?: string;
  botIdPresent: boolean;
  botSecretPresent: boolean;
  botSignaturePresent: boolean;
  botSource?: string;
  botTransportMode: 'mock' | 'sdk';
  botWsUrl: string;
  botMaxReconnectAttempts: number;
  botHeartbeatIntervalMs: number;
  deliveryMaxRetries: number;
  deliveryRetryDelayMs: number;
  deliveryChunkMaxLength: number;
  inboundReady: boolean;
  sdkReady: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface WecomBotConnectionTestResult {
  success: boolean;
  checkedAt: string;
  durationMs: number;
  message: string;
  config: Pick<
    WecomBotConnectionConfigView,
    | 'effectiveEnabled'
    | 'source'
    | 'botIdMasked'
    | 'botIdPresent'
    | 'botSecretPresent'
    | 'botSignaturePresent'
    | 'botSource'
    | 'botTransportMode'
    | 'botWsUrl'
    | 'inboundReady'
    | 'sdkReady'
  >;
  steps: Array<{
    name: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    durationMs?: number;
  }>;
}

type EffectiveWecomRuntimeConfig = WecomRuntimeConfig & {
  source: 'env' | 'runtime' | 'mixed';
  effectiveEnabled: boolean;
};

@Injectable()
export class WecomBotConnectionConfigService {
  constructor(
    private readonly appStorage: AppStorageService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly auditEventRepository: AuditEventRepository,
  ) {}

  getEffectiveRuntimeConfig(): EffectiveWecomRuntimeConfig {
    const envConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const runtimeConfig = this.getRuntimeConfigRecord();
    if (!runtimeConfig.useRuntimeConfig) {
      return {
        ...envConfig,
        source: 'env',
        effectiveEnabled: this.isEffectiveEnabled(envConfig, true),
      };
    }

    const merged = this.mergeRuntimeWithEnv(runtimeConfig, envConfig);
    return {
      ...merged,
      source: this.resolveConfigSource(runtimeConfig, envConfig),
      effectiveEnabled: this.isEffectiveEnabled(merged, runtimeConfig.enabled),
    };
  }

  getConfigView(user: CrmUser): WecomBotConnectionConfigView {
    this.ensureManageAccess(user);
    return this.buildConfigView(
      this.getEffectiveRuntimeConfig(),
      this.getRuntimeConfigRecord(),
    );
  }

  updateConfig(user: CrmUser, payload: unknown): WecomBotConnectionConfigView {
    this.ensureManageAccess(user);
    const parsed = updateWecomBotConnectionConfigSchema.parse(payload);
    const current = this.getRuntimeConfigRecord();
    const now = new Date().toISOString();
    const next: WecomBotConnectionConfigRecord = {
      ...current,
      useRuntimeConfig: true,
      enabled: parsed.enabled ?? current.enabled,
      botId: this.pickUpdatedSecret(parsed.botId, current.botId),
      botSecret: this.pickUpdatedSecret(parsed.botSecret, current.botSecret),
      botSignature: this.pickUpdatedSecret(
        parsed.botSignature,
        current.botSignature,
      ),
      botSource: parsed.botSource ?? current.botSource,
      botTransportMode: parsed.botTransportMode ?? current.botTransportMode,
      botWsUrl: parsed.botWsUrl ?? current.botWsUrl,
      botMaxReconnectAttempts:
        parsed.botMaxReconnectAttempts ?? current.botMaxReconnectAttempts,
      botHeartbeatIntervalMs:
        parsed.botHeartbeatIntervalMs ?? current.botHeartbeatIntervalMs,
      deliveryMaxRetries:
        parsed.deliveryMaxRetries ?? current.deliveryMaxRetries,
      deliveryRetryDelayMs:
        parsed.deliveryRetryDelayMs ?? current.deliveryRetryDelayMs,
      deliveryChunkMaxLength:
        parsed.deliveryChunkMaxLength ?? current.deliveryChunkMaxLength,
      updatedBy: user.id,
      updatedAt: now,
    };

    this.appStorage.state.wecomBotConnectionConfig = next;
    this.appStorage.persist();
    const view = this.buildConfigView(this.getEffectiveRuntimeConfig(), next);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_BOT_CONFIG_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '企业微信机器人连接配置已更新。',
      },
      sessionSnapshot: {
        after: {
          enabled: view.enabled,
          effectiveEnabled: view.effectiveEnabled,
          source: view.source,
          botIdPresent: view.botIdPresent,
          botSecretPresent: view.botSecretPresent,
          botSignaturePresent: view.botSignaturePresent,
          botSource: view.botSource,
          botTransportMode: view.botTransportMode,
        },
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: '企业微信机器人连接配置已更新。',
      createdAt: now,
    });
    return view;
  }

  async testConfig(
    user: CrmUser,
    payload?: unknown,
  ): Promise<WecomBotConnectionTestResult> {
    this.ensureManageAccess(user);
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    const draft = payload
      ? updateWecomBotConnectionConfigSchema.partial().parse(payload)
      : undefined;
    const config = this.resolveDraftConfig(draft);
    const view = this.buildConfigView(config, this.getRuntimeConfigRecord());
    const steps: WecomBotConnectionTestResult['steps'] = [];

    const configStepStartedAt = Date.now();
    if (!view.effectiveEnabled) {
      steps.push({
        name: '配置开关',
        status: 'FAILED',
        message: '企业微信机器人连接配置未启用。',
        durationMs: Date.now() - configStepStartedAt,
      });
    } else {
      steps.push({
        name: '配置开关',
        status: 'SUCCESS',
        message: '企业微信机器人连接配置已启用。',
        durationMs: Date.now() - configStepStartedAt,
      });
    }

    const inboundStepStartedAt = Date.now();
    if (view.inboundReady) {
      steps.push({
        name: '入站验签参数',
        status: 'SUCCESS',
        message: '消息来源和签名均已配置，可用于本地模拟入站消息。',
        durationMs: Date.now() - inboundStepStartedAt,
      });
    } else {
      steps.push({
        name: '入站验签参数',
        status: 'FAILED',
        message: '缺少消息来源或签名，本地模拟消息会被拒绝。',
        durationMs: Date.now() - inboundStepStartedAt,
      });
    }

    const transportStepStartedAt = Date.now();
    if (view.botTransportMode === 'mock') {
      steps.push({
        name: '消息发送通道',
        status: 'SUCCESS',
        message: '当前为 mock 通道，本地测试可返回模拟投递编号。',
        durationMs: Date.now() - transportStepStartedAt,
      });
    } else if (view.sdkReady) {
      steps.push({
        name: '消息发送通道',
        status: 'SUCCESS',
        message: 'SDK 通道参数完整，可进入真实长连接联调。',
        durationMs: Date.now() - transportStepStartedAt,
      });
    } else {
      steps.push({
        name: '消息发送通道',
        status: 'FAILED',
        message: 'SDK 通道缺少机器人编号、密钥或长连接地址。',
        durationMs: Date.now() - transportStepStartedAt,
      });
    }

    const success = steps.every((step) => step.status === 'SUCCESS');
    const result = {
      success,
      checkedAt,
      durationMs: Date.now() - startedAt,
      message: success
        ? '企业微信机器人连接配置自检通过。'
        : '企业微信机器人连接配置自检未通过，请按失败步骤补齐参数。',
      config: this.pickTestConfigView(view),
      steps,
    };
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_BOT_CONFIG_TESTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '企业微信机器人连接配置已执行自检。',
      },
      sessionSnapshot: {
        success,
        steps: result.steps,
      },
      riskLevel: success ? 'LOW' : 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: result.message,
      createdAt: checkedAt,
    });
    return result;
  }

  private ensureManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权管理企业微信机器人连接配置。',
      {
        channel: 'web-console',
        resourceType: 'wecom-bot-connection-config',
      },
    );
  }

  private getRuntimeConfigRecord(): WecomBotConnectionConfigRecord {
    const current = this.appStorage.state.wecomBotConnectionConfig;
    return {
      id: 'wecom_bot_connection',
      useRuntimeConfig: current?.useRuntimeConfig ?? false,
      enabled: current?.enabled ?? true,
      botId: current?.botId,
      botSecret: current?.botSecret,
      botSignature: current?.botSignature,
      botSource: current?.botSource,
      botTransportMode: current?.botTransportMode ?? 'mock',
      botWsUrl: current?.botWsUrl,
      botMaxReconnectAttempts: current?.botMaxReconnectAttempts ?? 10,
      botHeartbeatIntervalMs: current?.botHeartbeatIntervalMs ?? 30000,
      deliveryMaxRetries: current?.deliveryMaxRetries ?? 2,
      deliveryRetryDelayMs: current?.deliveryRetryDelayMs ?? 300,
      deliveryChunkMaxLength: current?.deliveryChunkMaxLength ?? 900,
      updatedBy: current?.updatedBy,
      updatedAt: current?.updatedAt,
    };
  }

  private mergeRuntimeWithEnv(
    runtimeConfig: WecomBotConnectionConfigRecord,
    envConfig: WecomRuntimeConfig,
  ): WecomRuntimeConfig {
    return {
      ...envConfig,
      botId: runtimeConfig.botId ?? envConfig.botId,
      botSecret: runtimeConfig.botSecret ?? envConfig.botSecret,
      botSignature: runtimeConfig.botSignature ?? envConfig.botSignature,
      botSource: runtimeConfig.botSource ?? envConfig.botSource,
      botTransportMode:
        runtimeConfig.botTransportMode ?? envConfig.botTransportMode,
      botWsUrl: runtimeConfig.botWsUrl ?? envConfig.botWsUrl,
      botMaxReconnectAttempts:
        runtimeConfig.botMaxReconnectAttempts ??
        envConfig.botMaxReconnectAttempts,
      botHeartbeatIntervalMs:
        runtimeConfig.botHeartbeatIntervalMs ??
        envConfig.botHeartbeatIntervalMs,
      deliveryMaxRetries:
        runtimeConfig.deliveryMaxRetries ?? envConfig.deliveryMaxRetries,
      deliveryRetryDelayMs:
        runtimeConfig.deliveryRetryDelayMs ?? envConfig.deliveryRetryDelayMs,
      deliveryChunkMaxLength:
        runtimeConfig.deliveryChunkMaxLength ?? envConfig.deliveryChunkMaxLength,
    };
  }

  private resolveDraftConfig(
    draft?: Partial<UpdateWecomBotConnectionConfigPayload>,
  ): EffectiveWecomRuntimeConfig {
    const effective = this.getEffectiveRuntimeConfig();
    if (!draft) {
      return effective;
    }

    const next: WecomRuntimeConfig = {
      ...effective,
      botId: this.pickUpdatedSecret(draft.botId, effective.botId),
      botSecret: this.pickUpdatedSecret(draft.botSecret, effective.botSecret),
      botSignature: this.pickUpdatedSecret(
        draft.botSignature,
        effective.botSignature,
      ),
      botSource: draft.botSource ?? effective.botSource,
      botTransportMode: draft.botTransportMode ?? effective.botTransportMode,
      botWsUrl: draft.botWsUrl ?? effective.botWsUrl,
      botMaxReconnectAttempts:
        draft.botMaxReconnectAttempts ?? effective.botMaxReconnectAttempts,
      botHeartbeatIntervalMs:
        draft.botHeartbeatIntervalMs ?? effective.botHeartbeatIntervalMs,
      deliveryMaxRetries:
        draft.deliveryMaxRetries ?? effective.deliveryMaxRetries,
      deliveryRetryDelayMs:
        draft.deliveryRetryDelayMs ?? effective.deliveryRetryDelayMs,
      deliveryChunkMaxLength:
        draft.deliveryChunkMaxLength ?? effective.deliveryChunkMaxLength,
    };

    return {
      ...next,
      source: 'mixed',
      effectiveEnabled: this.isEffectiveEnabled(
        next,
        draft.enabled ?? effective.effectiveEnabled,
      ),
    };
  }

  private buildConfigView(
    config: EffectiveWecomRuntimeConfig,
    runtimeConfig: WecomBotConnectionConfigRecord,
  ): WecomBotConnectionConfigView {
    const inboundReady = Boolean(config.botSignature && config.botSource);
    const sdkReady = Boolean(config.botId && config.botSecret && config.botWsUrl);
    return {
      useRuntimeConfig: runtimeConfig.useRuntimeConfig,
      enabled: runtimeConfig.useRuntimeConfig
        ? runtimeConfig.enabled
        : config.effectiveEnabled,
      effectiveEnabled: config.effectiveEnabled,
      source: config.source,
      botIdMasked: this.maskSecret(config.botId),
      botIdPresent: Boolean(config.botId),
      botSecretPresent: Boolean(config.botSecret),
      botSignaturePresent: Boolean(config.botSignature),
      botSource: config.botSource,
      botTransportMode: config.botTransportMode,
      botWsUrl: config.botWsUrl,
      botMaxReconnectAttempts: config.botMaxReconnectAttempts,
      botHeartbeatIntervalMs: config.botHeartbeatIntervalMs,
      deliveryMaxRetries: config.deliveryMaxRetries,
      deliveryRetryDelayMs: config.deliveryRetryDelayMs,
      deliveryChunkMaxLength: config.deliveryChunkMaxLength,
      inboundReady,
      sdkReady: config.botTransportMode === 'sdk' ? sdkReady : true,
      updatedBy: runtimeConfig.updatedBy,
      updatedAt: runtimeConfig.updatedAt,
    };
  }

  private pickTestConfigView(
    view: WecomBotConnectionConfigView,
  ): WecomBotConnectionTestResult['config'] {
    return {
      effectiveEnabled: view.effectiveEnabled,
      source: view.source,
      botIdMasked: view.botIdMasked,
      botIdPresent: view.botIdPresent,
      botSecretPresent: view.botSecretPresent,
      botSignaturePresent: view.botSignaturePresent,
      botSource: view.botSource,
      botTransportMode: view.botTransportMode,
      botWsUrl: view.botWsUrl,
      inboundReady: view.inboundReady,
      sdkReady: view.sdkReady,
    };
  }

  private resolveConfigSource(
    runtimeConfig: WecomBotConnectionConfigRecord,
    envConfig: WecomRuntimeConfig,
  ): 'runtime' | 'mixed' {
    const usesEnvFallback = Boolean(
      (!runtimeConfig.botId && envConfig.botId) ||
        (!runtimeConfig.botSecret && envConfig.botSecret) ||
        (!runtimeConfig.botSignature && envConfig.botSignature) ||
        (!runtimeConfig.botSource && envConfig.botSource),
    );
    return usesEnvFallback ? 'mixed' : 'runtime';
  }

  private isEffectiveEnabled(
    config: WecomRuntimeConfig,
    enabled: boolean,
  ): boolean {
    return Boolean(enabled && config.botSignature && config.botSource);
  }

  private pickUpdatedSecret(
    incoming: string | undefined,
    current: string | undefined,
  ): string | undefined {
    if (incoming === undefined) {
      return current;
    }
    const normalized = incoming.trim();
    return normalized || current;
  }

  private maskSecret(value?: string): string | undefined {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return undefined;
    }
    if (normalized.length <= 8) {
      return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
    }
    return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
  }
}
