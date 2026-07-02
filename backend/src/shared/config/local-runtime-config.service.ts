import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  AnalysisRoute,
  AiSdkType,
  AiStructuredOutputMode,
  AiWireApi,
} from '../types/domain';
import {
  normalizeAiReasoningEffort,
  type AiReasoningEffort,
} from '../utils/ai-reasoning-effort.util';

interface ParsedToml {
  root: Record<string, string | boolean>;
  sections: Record<string, Record<string, string | boolean>>;
}

const DEFAULT_CRM_DATABASE_NAME = 'vcooline_ikcrm_production';

export interface AiRuntimeConfig {
  enabled: boolean;
  source?: 'env' | 'profile';
  profileId?: string;
  providerCode?: string;
  sdkType?: AiSdkType;
  baseUrl?: string;
  model?: string;
  modelProvider?: string;
  reasoningEffort?: string;
  serviceTier?: string;
  timeoutMs?: number;
  apiKey?: string;
  wireApi?: AiWireApi;
  structuredOutputMode?: AiStructuredOutputMode;
  requiresOpenaiAuth?: boolean;
  disableResponseStorage?: boolean;
  codexPath?: string;
  proxyEnv?: Record<string, string>;
  sdkOptions?: Record<string, unknown>;
}

export interface ClaudeEnvBootstrapConfig {
  providerCode: string;
  sdkType: AiSdkType;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  reasoningEffort?: AiReasoningEffort;
  sdkOptions: Record<string, unknown>;
  warnings: string[];
}

export interface OpenAiHttpEnvBootstrapConfig {
  providerCode: string;
  sdkType: 'openai-compatible-http';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  reasoningEffort?: AiReasoningEffort;
  serviceTier?: string;
  timeoutMs?: number;
  sdkOptions: Record<string, unknown>;
  warnings: string[];
}

export interface MysqlRuntimeConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface CrmAuthRuntimeConfig {
  enabled: boolean;
  baseUrl?: string;
  loginPath: string;
  corpId?: string;
  versionCode: string;
  device: string;
  timeoutMs: number;
  mockEnabled: boolean;
  writebackLogin?: string;
  writebackPassword?: string;
}

export interface CrmStandardOpenApiRuntimeConfig {
  enabled: boolean;
  baseUrl?: string;
  appKey?: string;
  appSecret?: string;
  timeoutMs: number;
  tokenCacheBufferSeconds: number;
  accessMode: 'bound-user' | 'service-client-with-local-scope';
  serviceClientAllowedRoles: string[];
}

export interface CrmSqliteReadonlyAnalysisRuntimeConfig {
  enabled: boolean;
  dbPath?: string;
  defaultRoute: AnalysisRoute;
  queryTimeoutMs: number;
  maxRows: number;
  maxBytes?: number;
}

export interface CrmOpenApiMarkdownSnapshotRuntimeConfig {
  enabled: boolean;
  snapshotDir: string;
  maxRowsPerResource: number;
  detailRowsPerSection: number;
  maxContextChars: number;
  refreshEnabled: boolean;
  refreshOnStartup: boolean;
  refreshIntervalMinutes: number;
}

export interface CrmAuthIdentityApiRuntimeConfig {
  enabled: boolean;
  baseUrl?: string;
  userPathTemplate: string;
  timeoutMs: number;
  authMode: 'crm-token' | 'none';
}

export interface CrmCustomerCreateRuntimeConfig {
  defaultCategory?: string;
  defaultSource?: string;
  itDecisionLocationField?: string;
  unifiedSocialCreditCodeField?: string;
}

export interface CrmOpportunityCreateRuntimeConfig {
  defaultStage?: string;
  defaultSource?: string;
  defaultKind?: string;
  leadCodeField?: string;
  renewalContractCodeField?: string;
  agentFullNameField?: string;
  projectStatusField?: string;
  preSalesField?: string;
  productAliasMap: Record<string, string>;
}

export interface WecomRuntimeConfig {
  botId?: string;
  botSecret?: string;
  loginAuthorizeUrl?: string;
  loginCallbackUrl?: string;
  webBaseUrl: string;
  botSignature?: string;
  botSource?: string;
  botTransportMode: 'mock' | 'sdk';
  botWsUrl: string;
  botMaxReconnectAttempts: number;
  botHeartbeatIntervalMs: number;
  deliveryMaxRetries: number;
  deliveryRetryDelayMs: number;
  botProactiveMinIntervalMs: number;
  botRateLimitRetryDelaysMs: number[];
  deliveryChunkMaxLength: number;
  webLoginAppId?: string;
  webLoginAgentId?: string;
  webLoginSecret?: string;
  webLoginQrConnectUrl: string;
  qyapiBaseUrl: string;
}

export interface WecomDirectorySyncRuntimeConfig {
  enabled: boolean;
  corpId?: string;
  agentId?: string;
  secret?: string;
  rootDepartmentName: string;
  pageSize: number;
}

export interface WecomNotifyRuntimeConfig {
  enabled: boolean;
  corpId?: string;
  agentId?: string;
  secret?: string;
  qyapiBaseUrl: string;
  realMessageEnabled: boolean;
  testReceiverUserId: string;
  appMessageMinIntervalMs: number;
  appMessageMaxRetries: number;
  appMessageRateLimitRetryDelaysMs: number[];
}

export interface DailyReportRuntimeConfig {
  enabled: boolean;
  internalSchedulerEnabled: boolean;
  schedulerActorUserId: string;
  reminderTime: string;
  closeTime: string;
  summaryTime: string;
}

@Injectable()
export class LocalRuntimeConfigService {
  private readonly repoRoot = this.resolveRepoRoot(process.cwd());
  private readonly configDir = join(this.repoRoot, '配置');
  private aiConfigCache?: AiRuntimeConfig;
  private crmDbConfigCache?: MysqlRuntimeConfig;
  private crmWritebackDbConfigCache?: MysqlRuntimeConfig;
  private analysisWarehouseDbConfigCache?: MysqlRuntimeConfig;
  private crmAuthConfigCache?: CrmAuthRuntimeConfig;
  private crmAuthIdentityApiConfigCache?: CrmAuthIdentityApiRuntimeConfig;
  private crmStandardOpenApiConfigCache?: CrmStandardOpenApiRuntimeConfig;
  private crmSqliteReadonlyAnalysisConfigCache?: CrmSqliteReadonlyAnalysisRuntimeConfig;
  private crmOpenApiMarkdownSnapshotConfigCache?: CrmOpenApiMarkdownSnapshotRuntimeConfig;
  private crmCustomerCreateConfigCache?: CrmCustomerCreateRuntimeConfig;
  private crmOpportunityCreateConfigCache?: CrmOpportunityCreateRuntimeConfig;
  private wecomRuntimeConfigCache?: WecomRuntimeConfig;
  private wecomDirectorySyncRuntimeConfigCache?: WecomDirectorySyncRuntimeConfig;
  private wecomNotifyRuntimeConfigCache?: WecomNotifyRuntimeConfig;
  private dailyReportRuntimeConfigCache?: DailyReportRuntimeConfig;

  getAiConfig(): AiRuntimeConfig {
    if (this.aiConfigCache) {
      return this.aiConfigCache;
    }

    const authPath = join(this.configDir, 'codex配置', 'auth.json');
    const tomlPath = join(this.configDir, 'codex配置', 'config.toml');
    const parsedToml = existsSync(tomlPath)
      ? this.parseToml(readFileSync(tomlPath, 'utf8'))
      : { root: {}, sections: {} };

    const providerName =
      process.env.ANALYSIS_AI_MODEL_PROVIDER ??
      this.readLocalEnvValue('ANALYSIS_AI_MODEL_PROVIDER') ??
      this.readString(parsedToml.root.model_provider);
    const providerSection = providerName
      ? parsedToml.sections[`model_providers.${providerName}`] ?? {}
      : {};

    const apiKey =
      process.env.OPENAI_API_KEY ??
      this.readLocalEnvValue('OPENAI_API_KEY') ??
      this.readAuthApiKey(authPath);
    const baseUrl =
      process.env.ANALYSIS_AI_BASE_URL ??
      this.readLocalEnvValue('ANALYSIS_AI_BASE_URL') ??
      this.readString(providerSection.base_url);
    const model =
      process.env.ANALYSIS_AI_MODEL ??
      this.readLocalEnvValue('ANALYSIS_AI_MODEL') ??
      this.readString(parsedToml.root.model);
    const reasoningEffort =
      process.env.ANALYSIS_AI_REASONING_EFFORT ??
      this.readLocalEnvValue('ANALYSIS_AI_REASONING_EFFORT') ??
      this.readString(parsedToml.root.model_reasoning_effort);
    const serviceTier =
      process.env.ANALYSIS_AI_SERVICE_TIER ??
      this.readLocalEnvValue('ANALYSIS_AI_SERVICE_TIER') ??
      this.readString(parsedToml.root.service_tier);
    const wireApi =
      this.readLocalEnvValue('ANALYSIS_AI_WIRE_API') ??
      process.env.ANALYSIS_AI_WIRE_API ??
      this.readString(providerSection.wire_api) ??
      (providerName ? 'responses' : undefined);
    const normalizedWireApi = this.normalizeAiWireApi(wireApi);
    const structuredOutputMode = this.normalizeStructuredOutputMode(
      this.readLocalEnvValue('ANALYSIS_AI_STRUCTURED_OUTPUT_MODE') ??
        process.env.ANALYSIS_AI_STRUCTURED_OUTPUT_MODE ??
        this.readString(providerSection.structured_output_mode),
      normalizedWireApi,
    );
    const requiresOpenaiAuth =
      this.readLocalEnvBoolean('ANALYSIS_AI_REQUIRES_OPENAI_AUTH') ??
      this.readBoolean(providerSection.requires_openai_auth) ??
      (providerName ? Boolean(apiKey) : undefined);
    const disableResponseStorage =
      this.readLocalEnvBoolean('ANALYSIS_AI_DISABLE_RESPONSE_STORAGE') ??
      this.readBoolean(parsedToml.root.disable_response_storage) ??
      (providerName ? true : undefined);
    const codexPath =
      this.readLocalEnvValue('ANALYSIS_AI_CODEX_PATH') ??
      process.env.ANALYSIS_AI_CODEX_PATH;
    const proxyEnv = this.readProxyEnv();

    this.aiConfigCache = {
      enabled: Boolean(apiKey && baseUrl && model),
      source: 'env',
      apiKey,
      baseUrl,
      model,
      sdkType: 'openai-compatible-http',
      modelProvider: providerName,
      reasoningEffort: normalizeAiReasoningEffort(
        reasoningEffort,
        'openai-compatible-http',
      ),
      serviceTier,
      providerCode: providerName,
      wireApi: normalizedWireApi,
      structuredOutputMode,
      requiresOpenaiAuth,
      disableResponseStorage,
      codexPath,
      proxyEnv,
      sdkOptions: {
        ...(normalizedWireApi ? { wireApi: normalizedWireApi } : {}),
        ...(structuredOutputMode ? { structuredOutputMode } : {}),
        ...(typeof requiresOpenaiAuth === 'boolean'
          ? { requiresOpenaiAuth }
          : {}),
        ...(typeof disableResponseStorage === 'boolean'
          ? { disableResponseStorage }
          : {}),
        ...(codexPath ? { codexPath } : {}),
        ...(proxyEnv ? { proxyEnv } : {}),
        ...(providerName ? { modelProvider: providerName } : {}),
      },
    };

    return this.aiConfigCache;
  }

  /**
   * 读取环境中可识别的 Claude 默认档案配置，供后台治理页做引导落表。
   *
   * 这里不直接驱动运行时主链，而是把本地已有的 Claude 相关键位整理成
   * “可展示、可补齐、可测试”的默认档案草稿，避免管理员首次上线重复录入。
   */
  getClaudeEnvConfig(): ClaudeEnvBootstrapConfig | null {
    const baseUrl =
      this.readProcessFirstConfigValue('ANTHROPIC_BASE_URL') ??
      this.readProcessFirstConfigValue('CLAUDE_BASE_URL');
    const apiKey =
      this.readProcessFirstConfigValue('ANTHROPIC_API_KEY') ??
      this.readProcessFirstConfigValue('ANTHROPIC_AUTH_TOKEN') ??
      this.readProcessFirstConfigValue('CLAUDE_API_KEY');
    const model =
      this.readProcessFirstConfigValue('ANTHROPIC_MODEL') ??
      this.readProcessFirstConfigValue('CLAUDE_MODEL');
    const reasoningEffort = normalizeAiReasoningEffort(
      this.readProcessFirstConfigValue('ANTHROPIC_REASONING_EFFORT') ??
        this.readProcessFirstConfigValue('CLAUDE_REASONING_EFFORT'),
      'claude-agent-sdk',
    );

    if (!baseUrl && !apiKey && !model) {
      return null;
    }

    const warnings: string[] = [];
    if (!baseUrl?.trim()) {
      warnings.push('缺少 Claude 服务地址');
    }
    if (!model?.trim()) {
      warnings.push('缺少 Claude 模型名');
    }
    if (!apiKey?.trim()) {
      warnings.push('缺少 Claude 密钥');
    }

    return {
      providerCode: 'anthropic-claude',
      sdkType: 'claude-agent-sdk',
      baseUrl: baseUrl?.trim() || undefined,
      apiKey: apiKey?.trim() || undefined,
      model: model?.trim() || undefined,
      reasoningEffort,
      sdkOptions: {
        anthropicApiStyle: this.readProcessFirstConfigValue('ANTHROPIC_API_KEY')
          ? 'api-key'
          : 'auth-token',
      },
      warnings,
    };
  }

  /**
   * 为治理页默认档案选择一条当前更可能可用的 OpenAI 兼容 HTTP 配置。
   *
   * 选择顺序：
   * 1. 若 `ANALYSIS_AI_*` 本身已经像标准 OpenAI HTTP 配置（通常 Base URL 包含 `/v1`），优先使用；
   * 2. 否则尝试把 `ANTHROPIC_*` 直连配置映射为 OpenAI 兼容 HTTP 配置，
   *    用于兼容支持 `openai` endpoint 的统一网关；
   * 3. 两者都不满足时返回 null，由治理页只展示其它可用默认档案。
   */
  getOpenAiCompatibleHttpEnvConfig(): OpenAiHttpEnvBootstrapConfig | null {
    const analysisConfig = this.getAiConfig();
    if (
      analysisConfig.baseUrl?.trim() &&
      analysisConfig.model?.trim() &&
      analysisConfig.apiKey?.trim() &&
      this.looksLikeOpenAiCompatibleBaseUrl(analysisConfig.baseUrl)
    ) {
      return {
        providerCode:
          analysisConfig.providerCode ??
          analysisConfig.modelProvider ??
          'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        baseUrl: analysisConfig.baseUrl,
        apiKey: analysisConfig.apiKey,
        model: analysisConfig.model,
        reasoningEffort: normalizeAiReasoningEffort(
          analysisConfig.reasoningEffort,
          'openai-compatible-http',
        ),
        serviceTier: analysisConfig.serviceTier,
        timeoutMs: analysisConfig.timeoutMs,
        sdkOptions: {
          ...(analysisConfig.sdkOptions ?? {}),
          wireApi: analysisConfig.wireApi ?? 'responses',
          structuredOutputMode:
            analysisConfig.structuredOutputMode ?? 'json_schema',
          requiresOpenaiAuth: analysisConfig.requiresOpenaiAuth !== false,
          disableResponseStorage:
            analysisConfig.disableResponseStorage !== false,
        },
        warnings: [],
      };
    }

    const claudeConfig = this.getClaudeEnvConfig();
    if (!claudeConfig) {
      return null;
    }

    const warnings = [...claudeConfig.warnings];
    if (!claudeConfig.baseUrl?.trim()) {
      warnings.push('缺少 OpenAI 兼容 HTTP 服务地址');
    }
    if (!claudeConfig.model?.trim()) {
      warnings.push('缺少 OpenAI 兼容 HTTP 模型名');
    }
    if (!claudeConfig.apiKey?.trim()) {
      warnings.push('缺少 OpenAI 兼容 HTTP 密钥');
    }

    return {
      providerCode: claudeConfig.providerCode,
      sdkType: 'openai-compatible-http',
      baseUrl: this.normalizeOpenAiCompatibleBaseUrl(claudeConfig.baseUrl),
      apiKey: claudeConfig.apiKey,
      model: claudeConfig.model,
      reasoningEffort: normalizeAiReasoningEffort(
        claudeConfig.reasoningEffort,
        'openai-compatible-http',
      ),
      serviceTier: 'standard',
      sdkOptions: {
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_object',
        requiresOpenaiAuth: true,
        disableResponseStorage: true,
      },
      warnings,
    };
  }

  getRepoRoot(): string {
    return this.repoRoot;
  }

  getCrmReadonlyDbConfig(): MysqlRuntimeConfig {
    if (this.crmDbConfigCache) {
      return this.crmDbConfigCache;
    }

    const envConfig = {
      host:
        this.readLocalEnvValue('CRM_READONLY_DB_HOST') ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_HOST') ??
        process.env.CRM_READONLY_DB_HOST ??
        process.env.CRM_WRITEBACK_DB_HOST,
      port:
        this.readLocalEnvValue('CRM_READONLY_DB_PORT')
          ? Number(this.readLocalEnvValue('CRM_READONLY_DB_PORT'))
          : this.readLocalEnvValue('CRM_WRITEBACK_DB_PORT')
            ? Number(this.readLocalEnvValue('CRM_WRITEBACK_DB_PORT'))
            : process.env.CRM_READONLY_DB_PORT
              ? Number(process.env.CRM_READONLY_DB_PORT)
              : process.env.CRM_WRITEBACK_DB_PORT
                ? Number(process.env.CRM_WRITEBACK_DB_PORT)
                : undefined,
      database:
        this.readLocalEnvValue('CRM_READONLY_DB_NAME') ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_NAME') ??
        process.env.CRM_READONLY_DB_NAME ??
        process.env.CRM_WRITEBACK_DB_NAME,
      user:
        this.readLocalEnvValue('CRM_READONLY_DB_USER') ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_USER') ??
        process.env.CRM_READONLY_DB_USER ??
        process.env.CRM_WRITEBACK_DB_USER,
      password:
        this.readLocalEnvValue('CRM_READONLY_DB_PASSWORD') ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_PASSWORD') ??
        process.env.CRM_READONLY_DB_PASSWORD ??
        process.env.CRM_WRITEBACK_DB_PASSWORD,
    };

    if (envConfig.host && envConfig.database && envConfig.user && envConfig.password) {
      this.crmDbConfigCache = {
        enabled: true,
        ...envConfig,
        database: this.normalizeCrmDatabaseName(envConfig.database),
      };
      return this.crmDbConfigCache;
    }

    const credentialPath = join(this.configDir, '数据库', '数据库账号密码.txt');
    const parsedCredential = existsSync(credentialPath)
      ? this.parseCredentialText(readFileSync(credentialPath, 'utf8'))
      : {};

    this.crmDbConfigCache = {
      enabled: Boolean(
        parsedCredential.host &&
          parsedCredential.database &&
          parsedCredential.user &&
          parsedCredential.password,
      ),
      host: parsedCredential.host,
      port: parsedCredential.port,
      database: this.normalizeCrmDatabaseName(parsedCredential.database),
      user: parsedCredential.user,
      password: parsedCredential.password,
    };

    return this.crmDbConfigCache;
  }

  getCrmWritebackDbConfig(): MysqlRuntimeConfig {
    if (this.crmWritebackDbConfigCache) {
      return this.crmWritebackDbConfigCache;
    }

    const envConfig = {
      host:
        process.env.CRM_WRITEBACK_DB_HOST ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_HOST') ??
        process.env.CRM_READONLY_DB_HOST ??
        this.readLocalEnvValue('CRM_READONLY_DB_HOST'),
      port:
        process.env.CRM_WRITEBACK_DB_PORT
          ? Number(process.env.CRM_WRITEBACK_DB_PORT)
          : this.readLocalEnvValue('CRM_WRITEBACK_DB_PORT')
            ? Number(this.readLocalEnvValue('CRM_WRITEBACK_DB_PORT'))
            : process.env.CRM_READONLY_DB_PORT
              ? Number(process.env.CRM_READONLY_DB_PORT)
              : this.readLocalEnvValue('CRM_READONLY_DB_PORT')
                ? Number(this.readLocalEnvValue('CRM_READONLY_DB_PORT'))
                : undefined,
      database:
        process.env.CRM_WRITEBACK_DB_NAME ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_NAME') ??
        process.env.CRM_READONLY_DB_NAME ??
        this.readLocalEnvValue('CRM_READONLY_DB_NAME'),
      user:
        process.env.CRM_WRITEBACK_DB_USER ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_USER') ??
        process.env.CRM_READONLY_DB_USER ??
        this.readLocalEnvValue('CRM_READONLY_DB_USER'),
      password:
        process.env.CRM_WRITEBACK_DB_PASSWORD ??
        this.readLocalEnvValue('CRM_WRITEBACK_DB_PASSWORD') ??
        process.env.CRM_READONLY_DB_PASSWORD ??
        this.readLocalEnvValue('CRM_READONLY_DB_PASSWORD'),
    };

    this.crmWritebackDbConfigCache = {
      enabled: Boolean(
        envConfig.host &&
          envConfig.database &&
          envConfig.user &&
          envConfig.password,
      ),
      ...envConfig,
      database: this.normalizeCrmDatabaseName(envConfig.database),
    };

    return this.crmWritebackDbConfigCache;
  }

  /**
   * 读取 AI-agent 自建分析库连接配置。
   *
   * 参数说明：无。
   * 返回值说明：返回 MySQL / MySQL 兼容分析库连接参数。
   * 调用注意事项：该配置只用于我方数仓和语义层，不允许复用联软生产 SQLite 或 CRM 业务库直连。
   */
  getAnalysisWarehouseDbConfig(): MysqlRuntimeConfig {
    if (this.analysisWarehouseDbConfigCache) {
      return this.analysisWarehouseDbConfigCache;
    }

    const envConfig = {
      host:
        process.env.ANALYSIS_WAREHOUSE_DB_HOST ??
        this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_HOST'),
      port: process.env.ANALYSIS_WAREHOUSE_DB_PORT
        ? Number(process.env.ANALYSIS_WAREHOUSE_DB_PORT)
        : this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_PORT')
          ? Number(this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_PORT'))
          : undefined,
      database:
        process.env.ANALYSIS_WAREHOUSE_DB_NAME ??
        this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_NAME'),
      user:
        process.env.ANALYSIS_WAREHOUSE_DB_USER ??
        this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_USER'),
      password:
        process.env.ANALYSIS_WAREHOUSE_DB_PASSWORD ??
        this.readLocalEnvValue('ANALYSIS_WAREHOUSE_DB_PASSWORD'),
    };

    this.analysisWarehouseDbConfigCache = {
      enabled: Boolean(
        envConfig.host &&
          envConfig.database &&
          envConfig.user &&
          envConfig.password,
      ),
      ...envConfig,
      database: envConfig.database?.trim() || undefined,
    };

    return this.analysisWarehouseDbConfigCache;
  }

  getCrmAuthConfig(): CrmAuthRuntimeConfig {
    if (this.crmAuthConfigCache) {
      return this.crmAuthConfigCache;
    }

    const baseUrl =
      process.env.CRM_OPEN_API_BASE_URL ??
      process.env.CRM_AUTH_BASE_URL ??
      this.readLocalEnvValue('CRM_OPEN_API_BASE_URL') ??
      this.readLocalEnvValue('CRM_AUTH_BASE_URL');
    const corpId =
      process.env.CRM_OPEN_API_CORP_ID ??
      process.env.CRM_AUTH_CORP_ID ??
      process.env.CRM_CORP_ID ??
      this.readLocalEnvValue('CRM_OPEN_API_CORP_ID') ??
      this.readLocalEnvValue('CRM_AUTH_CORP_ID') ??
      this.readLocalEnvValue('CRM_CORP_ID');
    const loginPath = this.normalizeHttpPath(
      process.env.CRM_OPEN_API_LOGIN_PATH ??
        this.readLocalEnvValue('CRM_OPEN_API_LOGIN_PATH') ??
        '/api/v2/auth/login',
      '/api/v2/auth/login',
    );
    const versionCode =
      process.env.CRM_OPEN_API_VERSION_CODE ??
      this.readLocalEnvValue('CRM_OPEN_API_VERSION_CODE') ??
      '9.9.9';
    const device =
      process.env.CRM_OPEN_API_DEVICE ??
      this.readLocalEnvValue('CRM_OPEN_API_DEVICE') ??
      'open_api';
    const timeoutMs = Number(
      process.env.CRM_OPEN_API_TIMEOUT_MS ??
        this.readLocalEnvValue('CRM_OPEN_API_TIMEOUT_MS') ??
        '12000',
    );
    const writebackLogin =
      process.env.CRM_OPEN_API_WRITEBACK_LOGIN ??
      this.readLocalEnvValue('CRM_OPEN_API_WRITEBACK_LOGIN');
    const writebackPassword =
      process.env.CRM_OPEN_API_WRITEBACK_PASSWORD ??
      this.readLocalEnvValue('CRM_OPEN_API_WRITEBACK_PASSWORD');
    const mockEnabled =
      process.env.CRM_AUTH_MOCK_ENABLED !== undefined
        ? process.env.CRM_AUTH_MOCK_ENABLED === 'true'
        : this.readLocalEnvBoolean('CRM_AUTH_MOCK_ENABLED') === true ||
          process.env.NODE_ENV === 'test';

    this.crmAuthConfigCache = {
      enabled: Boolean(baseUrl),
      baseUrl,
      loginPath,
      corpId,
      versionCode,
      device,
      timeoutMs,
      mockEnabled,
      writebackLogin,
      writebackPassword,
    };

    return this.crmAuthConfigCache;
  }

  /**
   * 读取真实登录后的身份查询 API 运行时配置。
   *
   * 参数说明：无。
   * 返回值说明：返回真实登录成功后按 `user_id` 拉取身份上下文的 API 配置；未补齐基址时 `enabled=false`。
   * 调用注意事项：该配置只作为真实登录第二阶段的只读身份兜底，不替代现有只读库链路。
   */
  getCrmAuthIdentityApiConfig(): CrmAuthIdentityApiRuntimeConfig {
    if (this.crmAuthIdentityApiConfigCache) {
      return this.crmAuthIdentityApiConfigCache;
    }

    const baseUrl =
      process.env.CRM_AUTH_IDENTITY_API_BASE_URL ??
      this.readLocalEnvValue('CRM_AUTH_IDENTITY_API_BASE_URL') ??
      process.env.CRM_OPEN_API_BASE_URL ??
      this.readLocalEnvValue('CRM_OPEN_API_BASE_URL');
    const userPathTemplate =
      process.env.CRM_AUTH_IDENTITY_API_USER_PATH ??
      this.readLocalEnvValue('CRM_AUTH_IDENTITY_API_USER_PATH') ??
      '/api/open/v1/identity/users/{userId}';
    const timeoutMs = Number(
      process.env.CRM_AUTH_IDENTITY_API_TIMEOUT_MS ??
        this.readLocalEnvValue('CRM_AUTH_IDENTITY_API_TIMEOUT_MS') ??
        process.env.CRM_OPEN_API_TIMEOUT_MS ??
        this.readLocalEnvValue('CRM_OPEN_API_TIMEOUT_MS') ??
        '12000',
    );
    const authModeRaw =
      process.env.CRM_AUTH_IDENTITY_API_AUTH_MODE ??
      this.readLocalEnvValue('CRM_AUTH_IDENTITY_API_AUTH_MODE') ??
      'crm-token';
    const authMode = authModeRaw === 'none' ? 'none' : 'crm-token';

    this.crmAuthIdentityApiConfigCache = {
      enabled: Boolean(baseUrl),
      baseUrl: this.normalizeHttpBaseUrl(baseUrl),
      userPathTemplate,
      timeoutMs,
      authMode,
    };

    return this.crmAuthIdentityApiConfigCache;
  }

  /**
   * 读取联软标准 OpenAPI 运行时配置。
   *
   * 参数说明：无。
   * 返回值说明：返回标准 OpenAPI 的基础鉴权与超时配置；缺少关键字段时 `enabled=false`。
   * 调用注意事项：该配置用于联软第一阶段只读接口联调，不替换现有 CRM 官方 API 与只读库主链。
   */
  getCrmStandardOpenApiConfig(): CrmStandardOpenApiRuntimeConfig {
    if (this.crmStandardOpenApiConfigCache) {
      return this.crmStandardOpenApiConfigCache;
    }

    const baseUrl =
      this.readProcessFirstConfigValue('CRM_STANDARD_OPEN_API_BASE_URL') ??
      this.readProcessFirstConfigValue('CRM_STANDARD_API_BASE_URL');
    const appKey =
      this.readProcessFirstConfigValue('CRM_STANDARD_OPEN_API_APP_KEY') ??
      this.readProcessFirstConfigValue('CRM_STANDARD_API_APP_KEY');
    const appSecret =
      this.readProcessFirstConfigValue('CRM_STANDARD_OPEN_API_APP_SECRET') ??
      this.readProcessFirstConfigValue('CRM_STANDARD_API_APP_SECRET');
    const timeoutMs = Number(
      this.readProcessFirstConfigValue('CRM_STANDARD_OPEN_API_TIMEOUT_MS') ??
        this.readProcessFirstConfigValue('CRM_STANDARD_API_TIMEOUT_MS') ??
        '12000',
    );
    const tokenCacheBufferSeconds = Number(
      this.readProcessFirstConfigValue(
        'CRM_STANDARD_OPEN_API_TOKEN_CACHE_BUFFER_SECONDS',
      ) ??
        this.readProcessFirstConfigValue(
          'CRM_STANDARD_API_TOKEN_CACHE_BUFFER_SECONDS',
        ) ??
        '60',
    );
    const accessModeRaw =
      this.readProcessFirstConfigValue('CRM_STANDARD_OPEN_API_ACCESS_MODE') ??
      this.readProcessFirstConfigValue('CRM_STANDARD_API_ACCESS_MODE') ??
      'bound-user';
    const serviceClientAllowedRolesRaw =
      this.readProcessFirstConfigValue(
        'CRM_STANDARD_OPEN_API_SERVICE_CLIENT_ALLOWED_ROLES',
      ) ??
      this.readProcessFirstConfigValue(
        'CRM_STANDARD_API_SERVICE_CLIENT_ALLOWED_ROLES',
      ) ??
      'superadmin,admin';

    this.crmStandardOpenApiConfigCache = {
      enabled: Boolean(baseUrl && appKey && appSecret),
      baseUrl: this.normalizeHttpBaseUrl(baseUrl),
      appKey,
      appSecret,
      timeoutMs,
      tokenCacheBufferSeconds,
      accessMode:
        accessModeRaw === 'service-client-with-local-scope'
          ? 'service-client-with-local-scope'
          : 'bound-user',
      serviceClientAllowedRoles: serviceClientAllowedRolesRaw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    };

    return this.crmStandardOpenApiConfigCache;
  }

  /**
   * 读取 CRM SQLite 只读分析路线配置。
   *
   * 参数说明：无。
   * 返回值说明：返回生产只读 SQLite 路线的启用状态、数据库路径和执行边界。
   * 调用注意事项：该配置只服务新增“CRM SQLite 只读库”路线；不会自动替换 OpenAPI 主链，
   * 也不会复用旧 MySQL 分析库，避免历史兜底再次返回非真实明细。
   */
  getCrmSqliteReadonlyAnalysisConfig(): CrmSqliteReadonlyAnalysisRuntimeConfig {
    if (this.crmSqliteReadonlyAnalysisConfigCache) {
      return this.crmSqliteReadonlyAnalysisConfigCache;
    }

    const dbPath =
      this.readProcessFirstConfigValue('CRM_SQLITE_READONLY_DB_PATH') ??
      this.readProcessFirstConfigValue('LIANRUAN_CRM_SQLITE_READONLY_DB_PATH') ??
      this.readProcessFirstConfigValue('LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE');
    const enabled =
      (this.readProcessFirstConfigValue('CRM_SQLITE_READONLY_ENABLED') ?? 'false') ===
      'true';
    const defaultRoute = this.normalizeAnalysisRoute(
      this.readProcessFirstConfigValue('CRM_ANALYSIS_ROUTE'),
    );
    const queryTimeoutMs = Number(
      this.readProcessFirstConfigValue('CRM_SQLITE_READONLY_QUERY_TIMEOUT_MS') ??
        '10000',
    );
    const maxRows = Number(
      this.readProcessFirstConfigValue('CRM_SQLITE_READONLY_MAX_ROWS') ?? '2000',
    );
    const maxBytesRaw = this.readProcessFirstConfigValue(
      'CRM_SQLITE_READONLY_MAX_BYTES',
    );
    const maxBytes = maxBytesRaw ? Number(maxBytesRaw) : undefined;

    this.crmSqliteReadonlyAnalysisConfigCache = {
      enabled,
      dbPath,
      defaultRoute,
      queryTimeoutMs:
        Number.isFinite(queryTimeoutMs) && queryTimeoutMs > 0
          ? queryTimeoutMs
          : 10000,
      maxRows:
        Number.isFinite(maxRows) && maxRows > 0
          ? Math.min(Math.floor(maxRows), 10000)
          : 2000,
      maxBytes:
        Number.isFinite(maxBytes) && Number(maxBytes) > 0
          ? Number(maxBytes)
          : undefined,
    };

    return this.crmSqliteReadonlyAnalysisConfigCache;
  }

  /**
   * 读取 OpenAPI Markdown 分析快照配置。
   *
   * 参数说明：无。
   * 返回值说明：返回快照启用状态、输出目录、明细条数和 AI 上下文截断上限。
   * 调用注意事项：该配置只控制 Markdown 快照读写，不改变 OpenAPI/SQLite 现有取数路线。
   */
  getCrmOpenApiMarkdownSnapshotConfig(): CrmOpenApiMarkdownSnapshotRuntimeConfig {
    if (this.crmOpenApiMarkdownSnapshotConfigCache) {
      return this.crmOpenApiMarkdownSnapshotConfigCache;
    }

    const enabled =
      (this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_ENABLED') ??
        'false') === 'true';
    const snapshotDir =
      this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_DIR') ??
      join(this.repoRoot, 'backend', 'analysis-snapshot');
    const maxRowsPerResource = Number(
      this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_MAX_ROWS') ??
        '1000',
    );
    const detailRowsPerSection = Number(
      this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_DETAIL_ROWS') ??
        '30',
    );
    const maxContextChars = Number(
      this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_MAX_CONTEXT_CHARS') ??
        '20000',
    );
    const refreshEnabled =
      (this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_REFRESH_ENABLED') ??
        'false') === 'true';
    const refreshOnStartup =
      (this.readProcessFirstConfigValue('CRM_OPENAPI_MARKDOWN_SNAPSHOT_REFRESH_ON_STARTUP') ??
        'true') === 'true';
    const refreshIntervalMinutes = Number(
      this.readProcessFirstConfigValue(
        'CRM_OPENAPI_MARKDOWN_SNAPSHOT_REFRESH_INTERVAL_MINUTES',
      ) ?? '60',
    );

    this.crmOpenApiMarkdownSnapshotConfigCache = {
      enabled,
      snapshotDir,
      maxRowsPerResource:
        Number.isFinite(maxRowsPerResource) && maxRowsPerResource > 0
          ? Math.min(Math.floor(maxRowsPerResource), 10000)
          : 1000,
      detailRowsPerSection:
        Number.isFinite(detailRowsPerSection) && detailRowsPerSection > 0
          ? Math.min(Math.floor(detailRowsPerSection), 200)
          : 30,
      maxContextChars:
        Number.isFinite(maxContextChars) && maxContextChars > 1000
          ? Math.min(Math.floor(maxContextChars), 120000)
          : 20000,
      refreshEnabled,
      refreshOnStartup,
      refreshIntervalMinutes:
        Number.isFinite(refreshIntervalMinutes) && refreshIntervalMinutes > 0
          ? Math.min(Math.max(Math.floor(refreshIntervalMinutes), 5), 1440)
          : 60,
    };

    return this.crmOpenApiMarkdownSnapshotConfigCache;
  }

  getCrmCustomerCreateConfig(): CrmCustomerCreateRuntimeConfig {
    return {
      defaultCategory:
        this.readProcessFirstConfigValue('CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY'),
      defaultSource:
        this.readProcessFirstConfigValue('CRM_CUSTOMER_CREATE_DEFAULT_SOURCE'),
      itDecisionLocationField:
        this.readProcessFirstConfigValue(
          'CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
        ),
      unifiedSocialCreditCodeField:
        this.readProcessFirstConfigValue(
          'CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD',
        ),
    };
  }

  getCrmOpportunityCreateConfig(): CrmOpportunityCreateRuntimeConfig {
    return {
      defaultStage:
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_DEFAULT_STAGE'),
      defaultSource:
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_DEFAULT_SOURCE'),
      defaultKind:
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_DEFAULT_KIND'),
      leadCodeField:
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD'),
      renewalContractCodeField:
        this.readProcessFirstConfigValue(
          'CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD',
        ),
      agentFullNameField:
        this.readProcessFirstConfigValue(
          'CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD',
        ),
      projectStatusField:
        this.readProcessFirstConfigValue(
          'CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD',
        ),
      preSalesField:
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD'),
      productAliasMap: this.parseJsonRecord(
        this.readProcessFirstConfigValue('CRM_OPPORTUNITY_CREATE_PRODUCT_ALIAS_MAP'),
      ),
    };
  }

  getWecomRuntimeConfig(): WecomRuntimeConfig {
    if (this.wecomRuntimeConfigCache) {
      return this.wecomRuntimeConfigCache;
    }

    const wecomCredentialPath = join(
      this.configDir,
      '企业微信',
      'ID和密钥.md',
    );
    const wecomCredentialContent = existsSync(wecomCredentialPath)
      ? readFileSync(wecomCredentialPath, 'utf8')
      : '';

    const sdkTransportSwitch = this.readProcessFirstConfigValue(
      'WECOM_ENABLE_SDK_TRANSPORT',
    );

    this.wecomRuntimeConfigCache = {
      // 生产环境必须优先使用进程环境变量，避免发布包内残留的本地 `.env.local`
      // 覆盖服务器上的 systemd / backend.env 配置。
      botId:
        this.readProcessFirstConfigValue('WECOM_BOT_ID') ??
        this.readWecomCredentialValue(wecomCredentialContent, 'Bot ID'),
      botSecret:
        this.readProcessFirstConfigValue('WECOM_BOT_SECRET') ??
        this.readWecomCredentialValue(wecomCredentialContent, 'Secret'),
      loginAuthorizeUrl: this.readProcessFirstConfigValue(
        'WECOM_WEB_LOGIN_AUTHORIZE_URL',
      ),
      loginCallbackUrl:
        this.readProcessFirstConfigValue('WECOM_WEB_LOGIN_CALLBACK_URL') ??
        'http://127.0.0.1:3001/api/v1/auth/wecom/callback',
      webBaseUrl:
        this.readProcessFirstConfigValue('APP_WEB_BASE_URL') ??
        this.readProcessFirstConfigValue('WECOM_WEB_BASE_URL') ??
        'http://127.0.0.1:5173',
      botSignature:
        this.readProcessFirstConfigValue('WECOM_BOT_SIGNATURE') ??
        (process.env.NODE_ENV === 'test' ? 'test-signature' : undefined),
      botSource:
        this.readProcessFirstConfigValue('WECOM_BOT_SOURCE') ?? 'wecom-bot',
      botTransportMode:
        sdkTransportSwitch === 'true'
          ? 'sdk'
          : sdkTransportSwitch === 'false' || process.env.NODE_ENV !== 'production'
          ? 'mock'
          : 'sdk',
      botWsUrl:
        this.readProcessFirstConfigValue('WECOM_BOT_WS_URL') ??
        'wss://openws.work.weixin.qq.com',
      botMaxReconnectAttempts: Number(
        this.readProcessFirstConfigValue(
          'WECOM_BOT_MAX_RECONNECT_ATTEMPTS',
        ) ??
          '10',
      ),
      botHeartbeatIntervalMs: Number(
        this.readProcessFirstConfigValue('WECOM_BOT_HEARTBEAT_INTERVAL_MS') ??
          '30000',
      ),
      deliveryMaxRetries: Number(
        this.readProcessFirstConfigValue('WECOM_BOT_DELIVERY_MAX_RETRIES') ??
          (process.env.NODE_ENV === 'test' ? '0' : '2'),
      ),
      deliveryRetryDelayMs: Number(
        this.readProcessFirstConfigValue(
          'WECOM_BOT_DELIVERY_RETRY_DELAY_MS',
        ) ??
          '300',
      ),
      botProactiveMinIntervalMs: Number(
        this.readProcessFirstConfigValue(
          'WECOM_BOT_PROACTIVE_MIN_INTERVAL_MS',
        ) ??
          '15000',
      ),
      botRateLimitRetryDelaysMs: this.parseNumberList(
        this.readProcessFirstConfigValue('WECOM_BOT_RATE_LIMIT_RETRY_DELAYS_MS'),
        [60000, 180000, 300000],
      ),
      deliveryChunkMaxLength: Number(
        this.readProcessFirstConfigValue(
          'WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH',
        ) ??
          '900',
      ),
      webLoginAppId: this.readProcessFirstConfigValue('WECOM_WEB_LOGIN_APP_ID'),
      webLoginAgentId: this.readProcessFirstConfigValue(
        'WECOM_WEB_LOGIN_AGENT_ID',
      ),
      webLoginSecret: this.readProcessFirstConfigValue(
        'WECOM_WEB_LOGIN_SECRET',
      ),
      webLoginQrConnectUrl:
        this.readProcessFirstConfigValue('WECOM_WEB_LOGIN_QR_CONNECT_URL') ??
        'https://open.work.weixin.qq.com/wwopen/sso/qrConnect',
      qyapiBaseUrl:
        this.readProcessFirstConfigValue('WECOM_QYAPI_BASE_URL') ??
        'https://qyapi.weixin.qq.com/cgi-bin',
    };

    return this.wecomRuntimeConfigCache;
  }

  getWecomDirectorySyncConfig(): WecomDirectorySyncRuntimeConfig {
    if (this.wecomDirectorySyncRuntimeConfigCache) {
      return this.wecomDirectorySyncRuntimeConfigCache;
    }

    const wecomRuntimeConfig = this.getWecomRuntimeConfig();
    const corpId =
      this.readProcessFirstConfigValue('WECOM_DIRECTORY_CORP_ID') ??
      wecomRuntimeConfig.webLoginAppId;
    const agentId = this.readProcessFirstConfigValue('WECOM_DIRECTORY_AGENT_ID');
    const secret = this.readProcessFirstConfigValue('WECOM_DIRECTORY_SECRET');
    const rootDepartmentName =
      this.readProcessFirstConfigValue('WECOM_DIRECTORY_ROOT_DEPARTMENT_NAME') ??
      '联软科技集团';
    const pageSize = Number(
      this.readProcessFirstConfigValue('WECOM_DIRECTORY_PAGE_SIZE') ??
        '100',
    );

    this.wecomDirectorySyncRuntimeConfigCache = {
      // 目录同步与 Web 登录需要拆分成两套应用凭证，否则字段权限和授权范围会相互干扰。
      enabled: Boolean(corpId && secret),
      corpId,
      agentId,
      secret,
      rootDepartmentName,
      pageSize,
    };

    return this.wecomDirectorySyncRuntimeConfigCache;
  }

  getWecomNotifyConfig(): WecomNotifyRuntimeConfig {
    if (this.wecomNotifyRuntimeConfigCache) {
      return this.wecomNotifyRuntimeConfigCache;
    }

    const wecomRuntimeConfig = this.getWecomRuntimeConfig();
    const corpId =
      this.readProcessFirstConfigValue('WECOM_NOTIFY_CORP_ID') ??
      wecomRuntimeConfig.webLoginAppId;
    const agentId =
      this.readProcessFirstConfigValue('WECOM_NOTIFY_AGENT_ID') ??
      wecomRuntimeConfig.webLoginAgentId;
    const secret =
      this.readProcessFirstConfigValue('WECOM_NOTIFY_SECRET') ??
      wecomRuntimeConfig.webLoginSecret;
    const realMessageEnabled =
      (this.readProcessFirstConfigValue(
        'WECOM_NOTIFY_REAL_MESSAGE_ENABLED',
      ) ??
        'false') === 'true';
    const testReceiverUserId =
      this.readProcessFirstConfigValue('WECOM_NOTIFY_TEST_USER_ID') ??
      'WangLiang02';

    this.wecomNotifyRuntimeConfigCache = {
      enabled: Boolean(corpId && agentId && secret),
      corpId,
      agentId,
      secret,
      qyapiBaseUrl: wecomRuntimeConfig.qyapiBaseUrl,
      realMessageEnabled,
      testReceiverUserId,
      appMessageMinIntervalMs: Number(
        this.readProcessFirstConfigValue(
          'WECOM_APP_MESSAGE_MIN_INTERVAL_MS',
        ) ??
          '3000',
      ),
      appMessageMaxRetries: Number(
        this.readProcessFirstConfigValue('WECOM_APP_MESSAGE_MAX_RETRIES') ??
          '2',
      ),
      appMessageRateLimitRetryDelaysMs: this.parseNumberList(
        this.readProcessFirstConfigValue(
          'WECOM_APP_MESSAGE_RATE_LIMIT_RETRY_DELAYS_MS',
        ),
        [60000, 180000, 300000],
      ),
    };

    return this.wecomNotifyRuntimeConfigCache;
  }

  getDailyReportConfig(): DailyReportRuntimeConfig {
    if (this.dailyReportRuntimeConfigCache) {
      return this.dailyReportRuntimeConfigCache;
    }

    const enabled =
      (
        process.env.DAILY_REPORT_ENABLED ??
        this.readLocalEnvValue('DAILY_REPORT_ENABLED') ??
        'true'
      ) !== 'false';

    this.dailyReportRuntimeConfigCache = {
      enabled,
      // 页面开关启用后，生产应用自身要能驱动日报链路，避免依赖外部脚本登录态。
      internalSchedulerEnabled:
        (
          process.env.DAILY_REPORT_INTERNAL_SCHEDULER_ENABLED ??
          this.readLocalEnvValue('DAILY_REPORT_INTERNAL_SCHEDULER_ENABLED') ??
          'true'
        ) !== 'false',
      schedulerActorUserId:
        process.env.DAILY_REPORT_SCHEDULER_ACTOR_USER_ID ??
        this.readLocalEnvValue('DAILY_REPORT_SCHEDULER_ACTOR_USER_ID') ??
        'user_admin',
      reminderTime:
        process.env.DAILY_REPORT_REMINDER_TIME ??
        this.readLocalEnvValue('DAILY_REPORT_REMINDER_TIME') ??
        '22:00',
      closeTime:
        process.env.DAILY_REPORT_CLOSE_TIME ??
        this.readLocalEnvValue('DAILY_REPORT_CLOSE_TIME') ??
        '23:59',
      summaryTime:
        process.env.DAILY_REPORT_SUMMARY_TIME ??
        this.readLocalEnvValue('DAILY_REPORT_SUMMARY_TIME') ??
        '08:00',
    };

    return this.dailyReportRuntimeConfigCache;
  }

  private readAuthApiKey(authPath: string): string | undefined {
    if (!existsSync(authPath)) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(readFileSync(authPath, 'utf8')) as Record<string, unknown>;
      return typeof parsed.OPENAI_API_KEY === 'string'
        ? parsed.OPENAI_API_KEY
        : undefined;
    } catch {
      return undefined;
    }
  }

  private parseCredentialText(content: string): Partial<MysqlRuntimeConfig> {
    const lines = content.split(/\r?\n/);
    const labelMap: Record<string, keyof MysqlRuntimeConfig> = {
      数据库: 'database',
      主机地址: 'host',
      端口: 'port',
      用户名: 'user',
      密码: 'password',
    };

    const result: Partial<MysqlRuntimeConfig> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*')) {
        continue;
      }

      const matched = trimmed.match(/^([^:=：]+)\s*[:=：]\s*(.+)$/);
      if (!matched) {
        continue;
      }

      const label = matched[1].trim();
      const value = matched[2].trim();
      const mappedKey = labelMap[label];
      if (!mappedKey) {
        continue;
      }

      if (mappedKey === 'port') {
        result.port = Number(value);
      } else {
        result[mappedKey] = value as never;
      }
    }

    return result;
  }

  private normalizeCrmDatabaseName(databaseName?: string): string | undefined {
    if (!databaseName) {
      return DEFAULT_CRM_DATABASE_NAME;
    }

    const normalized = databaseName.trim().toLowerCase();
    if (!normalized || normalized === 'mysql') {
      return DEFAULT_CRM_DATABASE_NAME;
    }

    return databaseName;
  }

  /**
   * 归一化分析路线环境变量。
   *
   * 参数说明：`value` 为 `CRM_ANALYSIS_ROUTE` 原始值。
   * 返回值说明：返回 OpenAPI 或 SQLite 只读库路线。
   * 调用注意事项：无法识别时保持 OpenAPI，避免拼写错误把生产请求导入未知路径。
   */
  private normalizeAnalysisRoute(value?: string): AnalysisRoute {
    const normalizedValue = value?.trim().toLowerCase();
    if (
      normalizedValue === 'sqlite-readonly' ||
      normalizedValue === 'sqlite_readonly' ||
      normalizedValue === 'sqlite'
    ) {
      return 'SQLITE_READONLY';
    }

    return 'OPENAPI';
  }

  private readWecomCredentialValue(
    content: string,
    label: string,
  ): string | undefined {
    if (!content) {
      return undefined;
    }

    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matched = content.match(
      new RegExp(`${escapedLabel}\\s*[:：]\\s*(.+)$`, 'm'),
    );
    return matched?.[1]?.trim();
  }

  private parseToml(content: string): ParsedToml {
    const root: Record<string, string | boolean> = {};
    const sections: Record<string, Record<string, string | boolean>> = {};
    let currentSection = '';

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        if (!sections[currentSection]) {
          sections[currentSection] = {};
        }
        continue;
      }

      const keyMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (!keyMatch) {
        continue;
      }

      const key = keyMatch[1];
      const value = this.parseTomlValue(keyMatch[2]);
      if (currentSection) {
        sections[currentSection][key] = value;
      } else {
        root[key] = value;
      }
    }

    return { root, sections };
  }

  private parseTomlValue(rawValue: string): string | boolean {
    const value = rawValue.trim();
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    const singleQuoted = value.match(/^'(.*)'$/);
    if (singleQuoted) {
      return singleQuoted[1];
    }

    const doubleQuoted = value.match(/^"(.*)"$/);
    if (doubleQuoted) {
      return doubleQuoted[1];
    }

    return value;
  }

  private readString(value: string | boolean | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private readBoolean(value: string | boolean | undefined): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  }

  /**
   * 归一化 OpenAI 兼容 HTTP 协议类型，避免环境变量误填后进入不受控路径。
   */
  private normalizeAiWireApi(value?: string): AiWireApi | undefined {
    const normalizedValue = value?.trim().toLowerCase();
    if (normalizedValue === 'responses' || normalizedValue === 'chat_completions') {
      return normalizedValue;
    }

    return value ? undefined : undefined;
  }

  /**
   * 根据协议补齐结构化输出默认值。
   *
   * Responses 默认走严格 JSON Schema；Chat Completions 兼容平台默认使用
   * JSON object，再由后端本地 schema 校验兜住结构边界。
   */
  private normalizeStructuredOutputMode(
    value?: string,
    wireApi?: AiWireApi,
  ): AiStructuredOutputMode | undefined {
    const normalizedValue = value?.trim().toLowerCase();
    if (
      normalizedValue === 'json_schema' ||
      normalizedValue === 'json_object' ||
      normalizedValue === 'prompt_schema'
    ) {
      return normalizedValue;
    }

    if (!wireApi) {
      return undefined;
    }

    return wireApi === 'chat_completions' ? 'json_object' : 'json_schema';
  }

  /**
   * 识别一个 Base URL 是否更像 OpenAI 兼容 HTTP 网关。
   */
  private looksLikeOpenAiCompatibleBaseUrl(baseUrl: string): boolean {
    const normalizedBaseUrl = baseUrl.trim().toLowerCase();
    return normalizedBaseUrl.includes('/v1');
  }

  /**
   * 将兼容网关地址补齐为 OpenAI 常见的 `/v1` Base URL。
   */
  private normalizeOpenAiCompatibleBaseUrl(baseUrl?: string): string | undefined {
    if (!baseUrl?.trim()) {
      return undefined;
    }

    const trimmedValue = baseUrl.trim().replace(/\/+$/u, '');
    return trimmedValue.toLowerCase().endsWith('/v1')
      ? trimmedValue
      : `${trimmedValue}/v1`;
  }

  /**
   * 统一裁剪 HTTP 基址末尾斜杠，避免后续路径拼接出现双斜杠。
   *
   * 参数说明：`baseUrl` 为环境变量中的原始 HTTP 地址。
   * 返回值说明：去掉末尾斜杠后的地址；若为空白则返回 `undefined`。
   * 调用注意事项：仅用于 URL 规范化，不校验协议或域名有效性。
   */
  private normalizeHttpBaseUrl(baseUrl?: string): string | undefined {
    if (!baseUrl?.trim()) {
      return undefined;
    }

    return baseUrl.trim().replace(/\/+$/u, '');
  }

  /**
   * 统一规范 HTTP 路径，确保以单个 `/` 开头，便于后续与 Base URL 安全拼接。
   *
   * 参数说明：
   * - `path` 为环境变量中的原始路径。
   * - `fallbackPath` 为缺省时使用的默认路径。
   * 返回值说明：返回以 `/` 开头且不带尾部多余斜杠的路径。
   * 调用注意事项：仅做路径规范化，不校验服务端是否真实存在该接口。
   */
  private normalizeHttpPath(path: string | undefined, fallbackPath: string): string {
    const normalizedPath = (path?.trim() || fallbackPath).replace(/\/+$/u, '');
    if (!normalizedPath) {
      return fallbackPath;
    }

    return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  }

  private readLocalEnvValue(name: string): string | undefined {
    const candidateFiles = this.resolveLocalEnvCandidateFiles();

    for (const filePath of candidateFiles) {
      if (!existsSync(filePath)) {
        continue;
      }

      const content = readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/u);
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        const matched = line.match(
          new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, 'u'),
        );
        if (!matched) {
          continue;
        }

        // 本地环境文件允许显式配置空值；一旦命中当前键，就不应串读到下一行注释或其它键。
        return matched[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }

    return undefined;
  }

  /**
   * 按运行环境解析本地环境文件候选顺序。
   *
   * 规则：
   * 1. 先尝试 `.env.<NODE_ENV>.local`，允许开发/测试/生产各自维护专用文件；
   * 2. 后端 dev 或本地快照脚本未显式声明 `NODE_ENV` 时，按开发环境读取
   *    `.env.development.local`，避免局域网联调或本地数据快照缺少必要连接配置；
   * 3. 仅在非生产环境回退 `.env.local`，避免发布包里的开发配置污染线上；
   * 4. 同时兼容仓库根和 `backend/` 两种历史放置位置。
   */
  private resolveLocalEnvCandidateFiles(): string[] {
    const normalizedNodeEnv = this.resolveEffectiveLocalNodeEnv();
    const candidateFiles: string[] = [];

    if (normalizedNodeEnv) {
      candidateFiles.push(
        join(this.repoRoot, `.env.${normalizedNodeEnv}.local`),
        join(this.repoRoot, 'backend', `.env.${normalizedNodeEnv}.local`),
      );
    }

    if (normalizedNodeEnv !== 'production') {
      candidateFiles.push(
        join(this.repoRoot, '.env.local'),
        join(this.repoRoot, 'backend', '.env.local'),
      );
    }

    return candidateFiles;
  }

  /**
   * 解析本地配置读取使用的环境名。
   *
   * 参数说明：无。
   * 返回值说明：返回 `production`、`development` 等小写环境名；无法判断时返回空字符串。
   * 调用注意事项：只影响仓库本地环境文件读取顺序，不修改 `process.env.NODE_ENV`。
   */
  private resolveEffectiveLocalNodeEnv(): string {
    const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    if (normalizedNodeEnv) {
      return normalizedNodeEnv;
    }

    const lifecycleEvent = (process.env.npm_lifecycle_event ?? '').trim();
    if (['dev', 'dev:once', 'dev:watch', 'snapshot:openapi-markdown'].includes(lifecycleEvent)) {
      return 'development';
    }

    return '';
  }

  private readProcessFirstConfigValue(name: string): string | undefined {
    if (process.env.NODE_ENV === 'test') {
      return process.env[name];
    }

    return process.env[name] ?? this.readLocalEnvValue(name);
  }

  private readLocalEnvBoolean(name: string): boolean | undefined {
    return this.readBoolean(this.readLocalEnvValue(name));
  }

  private readProxyEnv(): Record<string, string> | undefined {
    const proxyEntries = [
      ['HTTP_PROXY', process.env.HTTP_PROXY ?? this.readLocalEnvValue('HTTP_PROXY')],
      ['HTTPS_PROXY', process.env.HTTPS_PROXY ?? this.readLocalEnvValue('HTTPS_PROXY')],
      ['ALL_PROXY', process.env.ALL_PROXY ?? this.readLocalEnvValue('ALL_PROXY')],
      ['NO_PROXY', process.env.NO_PROXY ?? this.readLocalEnvValue('NO_PROXY')],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (proxyEntries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(proxyEntries);
  }

  private parseJsonRecord(value?: string): Record<string, string> {
    if (!value?.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const normalizedEntries: Record<string, string> = {};
      for (const [key, rawValue] of Object.entries(parsed)) {
        const trimmedKey = key.trim();
        if (!trimmedKey || typeof rawValue !== 'string' || !rawValue.trim()) {
          continue;
        }

        normalizedEntries[trimmedKey] = rawValue.trim();
      }
      return normalizedEntries;
    } catch {
      return {};
    }
  }

  private parseNumberList(value: string | undefined, fallback: number[]): number[] {
    if (!value?.trim()) {
      return fallback;
    }

    const numbers = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item >= 0);
    return numbers.length > 0 ? numbers : fallback;
  }

  private resolveRepoRoot(startDir: string): string {
    let currentDir = resolve(startDir);
    while (true) {
      const matchesLegacyRepoLayout =
        existsSync(join(currentDir, '配置')) && existsSync(join(currentDir, 'specs'));
      const matchesCurrentRepoLayout =
        existsSync(join(currentDir, 'specs')) &&
        (existsSync(join(currentDir, 'backend')) ||
          existsSync(join(currentDir, 'frontend')) ||
          existsSync(join(currentDir, 'openspec')) ||
          existsSync(join(currentDir, 'pnpm-workspace.yaml')));
      const matchesWorkspaceReleaseLayout =
        existsSync(join(currentDir, 'pnpm-workspace.yaml')) &&
        existsSync(join(currentDir, 'backend')) &&
        existsSync(join(currentDir, 'frontend'));

      if (
        matchesLegacyRepoLayout ||
        matchesCurrentRepoLayout ||
        matchesWorkspaceReleaseLayout
      ) {
        return currentDir;
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        return startDir;
      }

      currentDir = parentDir;
    }
  }
}
