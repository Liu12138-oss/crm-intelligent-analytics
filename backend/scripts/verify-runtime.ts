import { AppStorageService } from '../src/database/app-storage/app-storage.service';
import { AiProviderRegistryService } from '../src/modules/ai-models/ai-provider-registry.service';
import { AiRuntimeConfigResolver } from '../src/modules/ai-models/ai-runtime-config.resolver';
import { AiSecretCryptoService } from '../src/modules/ai-models/ai-secret-crypto.service';
import { UnifiedAiExecutionService } from '../src/modules/ai-models/unified-ai-execution.service';
import { ClaudeProviderAdapter } from '../src/modules/ai-models/adapters/claude-provider.adapter';
import { CodexProviderAdapter } from '../src/modules/ai-models/adapters/codex-provider.adapter';
import { OpenAiCompatibleHttpAdapter } from '../src/modules/ai-models/adapters/openai-compatible-http.adapter';
import { CrmLoginIdentityApiService } from '../src/modules/auth/crm-login-identity-api.service';
import { LianruanCrmOpenApiClient } from '../src/modules/crm-standard-api/lianruan-crm-openapi.client';
import { LianruanCrmConnectionConfigService } from '../src/modules/governance/lianruan-crm-connection-config.service';
import { LocalRuntimeConfigService } from '../src/shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../src/shared/logging/analysis-logger.service';

interface AiRuntimeCheckResult {
  configured: boolean;
  connected: boolean;
  source?: string;
  profileId?: string;
  profileName?: string;
  providerCode?: string;
  sdkType?: string;
  model?: string;
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  wireApi?: string;
  structuredOutputMode?: string;
  lastHealthCheckStatus?: string;
  failureReason?: string;
}

interface StandardApiCheckResult {
  configured: boolean;
  baseUrlPresent: boolean;
  appKeyPresent: boolean;
  appSecretPresent: boolean;
  connected: boolean;
  boundUserId?: string;
  boundUserName?: string;
  scopeType?: string;
  failureReason?: string;
}

interface CrmAuthCheckResult {
  configured: boolean;
  baseUrlPresent: boolean;
  loginPath: string;
  corpIdPresent: boolean;
  device: string;
  versionCode: string;
  timeoutMs: number;
  mockEnabled: boolean;
}

interface IdentityApiCheckResult {
  configured: boolean;
  baseUrlPresent: boolean;
  userPathTemplate: string;
  authMode: string;
  timeoutMs: number;
  connected?: boolean;
  checkedUserId?: string;
  checkSkippedReason?: string;
  failureReason?: string;
}

/**
 * 截断运行态检查错误，避免部署日志被上游长响应刷屏。
 *
 * 参数说明：`error` 为任意异常对象。
 * 返回值说明：返回适合命令行展示的短错误文本。
 */
function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/gu, ' ').trim().slice(0, 300);
}

/**
 * 读取当前激活 AI Profile 的非敏感摘要。
 *
 * 参数说明：`appStorageService` 为本地应用状态仓储。
 * 返回值说明：返回激活 Profile；未激活或快照缺失时返回 `undefined`。
 */
function resolveActiveProfileSummary(appStorageService: AppStorageService) {
  const activeProfileId = appStorageService.state.aiModelActivation.activeProfileId;
  if (!activeProfileId) {
    return undefined;
  }

  return appStorageService.state.aiModelProfiles.find(
    (profile) => profile.id === activeProfileId && profile.status === 'ACTIVE',
  );
}

/**
 * 对当前 AI 运行时做最小结构化输出检查。
 *
 * 参数说明：
 * - `resolver`：统一 AI 运行态配置解析器，优先读取后台激活 Profile；
 * - `unifiedAiExecutionService`：统一 AI 执行门面；
 * - `appStorageService`：用于补充 Profile 后台健康检查摘要。
 * 返回值说明：返回 AI 配置、连通性与失败原因，不包含密钥。
 */
async function verifyAiRuntime(params: {
  resolver: AiRuntimeConfigResolver;
  unifiedAiExecutionService: UnifiedAiExecutionService;
  appStorageService: AppStorageService;
}): Promise<AiRuntimeCheckResult> {
  const config = params.resolver.getCurrentConfig();
  const activeProfile = resolveActiveProfileSummary(params.appStorageService);
  const baseResult: AiRuntimeCheckResult = {
    configured: Boolean(config.enabled && config.sdkType),
    connected: false,
    source: config.source,
    profileId: config.profileId,
    profileName: activeProfile?.name,
    providerCode: config.providerCode ?? config.modelProvider,
    sdkType: config.sdkType,
    model: config.model,
    baseUrlPresent: Boolean(config.baseUrl),
    apiKeyPresent: Boolean(config.apiKey),
    wireApi: config.wireApi,
    structuredOutputMode: config.structuredOutputMode,
    lastHealthCheckStatus: activeProfile?.lastHealthCheckStatus,
  };

  if (!baseResult.configured) {
    return {
      ...baseResult,
      failureReason: '当前未配置可用 AI 运行时。',
    };
  }

  try {
    await params.unifiedAiExecutionService.invokeStructured({
      system: '你是 CRM 智能分析系统的部署前结构化连通性检查器。',
      prompt: '请返回 {"status":"OK"}',
      outputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['OK'],
          },
        },
      },
      requestOverrides: {
        timeoutMs: Number(process.env.VERIFY_RUNTIME_AI_TIMEOUT_MS ?? '15000'),
      },
    });

    return {
      ...baseResult,
      connected: true,
    };
  } catch (error) {
    return {
      ...baseResult,
      connected: false,
      failureReason: summarizeError(error),
    };
  }
}

/**
 * 检查联软标准 OpenAPI 是否可用。
 *
 * 参数说明：`client` 为联软标准 OpenAPI 客户端。
 * 返回值说明：返回配置完整度、远端连通性、绑定用户和权限范围摘要。
 */
async function verifyStandardApi(params: {
  connectionConfigService: LianruanCrmConnectionConfigService;
  client: LianruanCrmOpenApiClient;
}): Promise<StandardApiCheckResult> {
  const config = params.connectionConfigService.getEffectiveRuntimeConfig();
  const baseResult: StandardApiCheckResult = {
    configured: config.enabled,
    baseUrlPresent: Boolean(config.baseUrl),
    appKeyPresent: Boolean(config.appKey),
    appSecretPresent: Boolean(config.appSecret),
    connected: false,
  };

  if (!params.client.isEnabled()) {
    return baseResult;
  }

  try {
    const [context, permissionScope] = await Promise.all([
      params.client.getCurrentContext(),
      params.client.getPermissionScope(),
    ]);

    return {
      ...baseResult,
      connected: true,
      boundUserId: context.user.id,
      boundUserName: context.user.name,
      scopeType: permissionScope.scopeType,
    };
  } catch (error) {
    return {
      ...baseResult,
      failureReason: summarizeError(error),
    };
  }
}

/**
 * 读取 CRM 真实登录配置摘要。
 *
 * 参数说明：`configService` 为本地运行配置服务。
 * 返回值说明：返回真实登录配置完整度，不发起真实账号密码请求。
 */
function verifyCrmAuthConfig(
  configService: LocalRuntimeConfigService,
): CrmAuthCheckResult {
  const config = configService.getCrmAuthConfig();
  return {
    configured: config.enabled,
    baseUrlPresent: Boolean(config.baseUrl),
    loginPath: config.loginPath,
    corpIdPresent: Boolean(config.corpId),
    device: config.device,
    versionCode: config.versionCode,
    timeoutMs: config.timeoutMs,
    mockEnabled: config.mockEnabled,
  };
}

/**
 * 检查真实登录后的身份查询 API 配置，并在安全条件满足时做一次只读探测。
 *
 * 参数说明：
 * - `configService`：运行配置服务；
 * - `identityApiService`：身份查询 API 服务；
 * - `standardApiBoundUserId`：标准 API 当前绑定用户，可作为无 token 模式下的探测用户。
 * 返回值说明：返回配置、是否探测、探测结果和失败原因。
 */
async function verifyIdentityApi(params: {
  configService: LocalRuntimeConfigService;
  identityApiService: CrmLoginIdentityApiService;
  standardApiBoundUserId?: string;
}): Promise<IdentityApiCheckResult> {
  const config = params.configService.getCrmAuthIdentityApiConfig();
  const baseResult: IdentityApiCheckResult = {
    configured: config.enabled,
    baseUrlPresent: Boolean(config.baseUrl),
    userPathTemplate: config.userPathTemplate,
    authMode: config.authMode,
    timeoutMs: config.timeoutMs,
  };

  if (!config.enabled) {
    return baseResult;
  }

  const probeUserId =
    process.env.VERIFY_RUNTIME_IDENTITY_USER_ID?.trim() ||
    params.standardApiBoundUserId;
  const probeToken = process.env.VERIFY_RUNTIME_IDENTITY_TOKEN?.trim();
  if (!probeUserId) {
    return {
      ...baseResult,
      checkSkippedReason: '缺少可用于身份 API 探测的 userId。',
    };
  }

  if (config.authMode === 'crm-token' && !probeToken) {
    return {
      ...baseResult,
      checkedUserId: probeUserId,
      checkSkippedReason:
        '身份 API 当前为 crm-token 鉴权，未提供 VERIFY_RUNTIME_IDENTITY_TOKEN，已跳过连通探测。',
    };
  }

  try {
    const user = await params.identityApiService.getUserById(
      probeUserId,
      probeToken,
    );

    return {
      ...baseResult,
      connected: Boolean(user),
      checkedUserId: probeUserId,
      ...(user ? {} : { failureReason: '身份 API 未返回有效用户。' }),
    };
  } catch (error) {
    return {
      ...baseResult,
      connected: false,
      checkedUserId: probeUserId,
      failureReason: summarizeError(error),
    };
  }
}

/**
 * 组装并执行部署前运行态检查。
 *
 * 参数说明：无。
 * 返回值说明：无；检查结果以 JSON 输出到标准输出。
 */
async function main(): Promise<void> {
  const configService = new LocalRuntimeConfigService();
  const logger = new AnalysisLoggerService();
  const appStorageService = new AppStorageService(configService);
  const aiSecretCryptoService = new AiSecretCryptoService(configService);
  const aiRuntimeConfigResolver = new AiRuntimeConfigResolver(
    appStorageService,
    configService,
    aiSecretCryptoService,
  );
  const aiProviderRegistryService = new AiProviderRegistryService([
    new OpenAiCompatibleHttpAdapter(),
    new CodexProviderAdapter(),
    new ClaudeProviderAdapter(),
  ]);
  const unifiedAiExecutionService = new UnifiedAiExecutionService(
    aiRuntimeConfigResolver,
    aiProviderRegistryService,
  );
  // 部署检查脚本只读取联软 OpenAPI 生效配置，不进入治理写入权限分支。
  const lianruanCrmConnectionConfigService = new LianruanCrmConnectionConfigService(
    appStorageService,
    configService,
    { ensureAction: () => undefined } as never,
  );
  const lianruanCrmOpenApiClient = new LianruanCrmOpenApiClient(
    lianruanCrmConnectionConfigService,
    logger,
  );
  const identityApiService = new CrmLoginIdentityApiService(
    configService,
    logger,
  );

  const dbConfig = configService.getCrmReadonlyDbConfig();
  const aiRuntime = await verifyAiRuntime({
    resolver: aiRuntimeConfigResolver,
    unifiedAiExecutionService,
    appStorageService,
  });
  const standardApi = await verifyStandardApi({
    connectionConfigService: lianruanCrmConnectionConfigService,
    client: lianruanCrmOpenApiClient,
  });
  const crmAuth = verifyCrmAuthConfig(configService);
  const identityApi = await verifyIdentityApi({
    configService,
    identityApiService,
    standardApiBoundUserId: standardApi.boundUserId,
  });

  console.log(
    JSON.stringify(
      {
        aiConfigured: aiRuntime.configured,
        aiConnected: aiRuntime.connected,
        aiRuntime,
        databaseConfigured: dbConfig.enabled,
        databaseHostPresent: Boolean(dbConfig.host),
        databaseNamePresent: Boolean(dbConfig.database),
        databaseUserPresent: Boolean(dbConfig.user),
        standardApiConfigured: standardApi.configured,
        standardApiBaseUrlPresent: standardApi.baseUrlPresent,
        standardApiConnected: standardApi.connected,
        standardApiBoundUserId: standardApi.boundUserId,
        standardApiScopeType: standardApi.scopeType,
        standardApi,
        crmAuthConfigured: crmAuth.configured,
        crmAuthMockEnabled: crmAuth.mockEnabled,
        crmAuth,
        identityApiConfigured: identityApi.configured,
        identityApiConnected: identityApi.connected,
        identityApi,
      },
      null,
      2,
    ),
  );
}

void main();
