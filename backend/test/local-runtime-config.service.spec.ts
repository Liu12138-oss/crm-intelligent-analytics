import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalRuntimeConfigService } from '../src/shared/config/local-runtime-config.service';

describe('LocalRuntimeConfigService', () => {
  const trackedEnvKeys = [
    'CRM_READONLY_DB_HOST',
    'CRM_READONLY_DB_PORT',
    'CRM_READONLY_DB_NAME',
    'CRM_READONLY_DB_USER',
    'CRM_READONLY_DB_PASSWORD',
    'CRM_WRITEBACK_DB_HOST',
    'CRM_WRITEBACK_DB_PORT',
    'CRM_WRITEBACK_DB_NAME',
    'CRM_WRITEBACK_DB_USER',
    'CRM_WRITEBACK_DB_PASSWORD',
    'CRM_STANDARD_OPEN_API_BASE_URL',
    'CRM_STANDARD_OPEN_API_APP_KEY',
    'CRM_STANDARD_OPEN_API_APP_SECRET',
    'CRM_STANDARD_OPEN_API_TIMEOUT_MS',
    'CRM_STANDARD_OPEN_API_TOKEN_CACHE_BUFFER_SECONDS',
    'CRM_OPEN_API_BASE_URL',
    'CRM_OPEN_API_LOGIN_PATH',
    'CRM_OPEN_API_TIMEOUT_MS',
    'CRM_OPEN_API_VERSION_CODE',
    'CRM_OPEN_API_DEVICE',
    'CRM_AUTH_MOCK_ENABLED',
    'CRM_AUTH_IDENTITY_API_BASE_URL',
    'CRM_AUTH_IDENTITY_API_USER_PATH',
    'CRM_AUTH_IDENTITY_API_TIMEOUT_MS',
    'CRM_AUTH_IDENTITY_API_AUTH_MODE',
    'WECOM_BOT_TRANSPORT_MODE',
    'WECOM_ENABLE_SDK_TRANSPORT',
    'OPENAI_API_KEY',
    'ANALYSIS_AI_BASE_URL',
    'ANALYSIS_AI_MODEL_PROVIDER',
    'ANALYSIS_AI_MODEL',
    'ANALYSIS_AI_REASONING_EFFORT',
    'ANALYSIS_AI_SERVICE_TIER',
    'ANALYSIS_AI_WIRE_API',
    'ANALYSIS_AI_STRUCTURED_OUTPUT_MODE',
    'ANALYSIS_AI_REQUIRES_OPENAI_AUTH',
    'ANALYSIS_AI_DISABLE_RESPONSE_STORAGE',
    'ANALYSIS_AI_CODEX_PATH',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'NO_PROXY',
    'APP_WEB_BASE_URL',
    'WECOM_WEB_BASE_URL',
    'npm_lifecycle_event',
    'DAILY_REPORT_ENABLED',
    'DAILY_REPORT_INTERNAL_SCHEDULER_ENABLED',
    'DAILY_REPORT_SCHEDULER_ACTOR_USER_ID',
    'DAILY_REPORT_REMINDER_TIME',
    'DAILY_REPORT_CLOSE_TIME',
    'DAILY_REPORT_SUMMARY_TIME',
    'WECOM_NOTIFY_REAL_MESSAGE_ENABLED',
    'WECOM_NOTIFY_TEST_USER_ID',
  ] as const;

  let originalCwd: string;
  let originalEnv: Record<string, string | undefined>;
  let originalNodeEnv: string | undefined;
  let tempRepoRoot: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalEnv = Object.fromEntries(
      trackedEnvKeys.map((key) => [key, process.env[key]]),
    );
    originalNodeEnv = process.env.NODE_ENV;
    tempRepoRoot = mkdtempSync(join(tmpdir(), 'crm-ai-config-'));

    mkdirSync(join(tempRepoRoot, 'specs'), { recursive: true });
    mkdirSync(join(tempRepoRoot, '配置', 'codex配置'), { recursive: true });
    mkdirSync(join(tempRepoRoot, 'backend'), { recursive: true });

    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      [
        'OPENAI_API_KEY=mock-local-key',
        'ANALYSIS_AI_BASE_URL=https://api.example.com/v1',
        'ANALYSIS_AI_MODEL_PROVIDER=aicodex_codex_codex',
        'ANALYSIS_AI_MODEL=gpt-5.4',
        'ANALYSIS_AI_REASONING_EFFORT=high',
        'ANALYSIS_AI_SERVICE_TIER=fast',
        'ANALYSIS_AI_WIRE_API=responses',
        'ANALYSIS_AI_STRUCTURED_OUTPUT_MODE=json_schema',
        'ANALYSIS_AI_REQUIRES_OPENAI_AUTH=true',
        'ANALYSIS_AI_DISABLE_RESPONSE_STORAGE=true',
        'ANALYSIS_AI_CODEX_PATH=codex',
        'HTTPS_PROXY=http://127.0.0.1:7890',
        'NO_PROXY=127.0.0.1,localhost',
        '',
      ].join('\n'),
      'utf8',
    );

    for (const key of trackedEnvKeys) {
      delete process.env[key];
    }

    process.chdir(tempRepoRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.NODE_ENV = originalNodeEnv;

    for (const key of trackedEnvKeys) {
      const value = originalEnv[key];
      if (typeof value === 'string') {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    rmSync(tempRepoRoot, { recursive: true, force: true });
  });

  it('应从 backend/.env.local 读取 AI 核心配置', () => {
    const service = new LocalRuntimeConfigService();
    const config = service.getAiConfig();

    expect(config).toMatchObject({
      enabled: true,
      source: 'env',
      apiKey: 'mock-local-key',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-5.4',
      providerCode: 'aicodex_codex_codex',
      sdkType: 'openai-compatible-http',
      modelProvider: 'aicodex_codex_codex',
      reasoningEffort: 'high',
      serviceTier: 'fast',
      wireApi: 'responses',
      structuredOutputMode: 'json_schema',
      requiresOpenaiAuth: true,
      disableResponseStorage: true,
      proxyEnv: {
        HTTPS_PROXY: 'http://127.0.0.1:7890',
        NO_PROXY: '127.0.0.1,localhost',
      },
    });
    expect(config.sdkOptions).toMatchObject({
      wireApi: 'responses',
      structuredOutputMode: 'json_schema',
      requiresOpenaiAuth: true,
      disableResponseStorage: true,
      modelProvider: 'aicodex_codex_codex',
      proxyEnv: {
        HTTPS_PROXY: 'http://127.0.0.1:7890',
        NO_PROXY: '127.0.0.1,localhost',
      },
    });
  });

  it('仅声明 model provider 时，也应回退到 OpenAI 兼容 HTTP 默认协议、结构化模式与禁用落盘配置', () => {
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      [
        'OPENAI_API_KEY=mock-local-key',
        'ANALYSIS_AI_BASE_URL=https://api.example.com/v1',
        'ANALYSIS_AI_MODEL_PROVIDER=aicodex_codex_codex',
        'ANALYSIS_AI_MODEL=gpt-5.4',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();
    const config = service.getAiConfig();

    expect(config.wireApi).toBe('responses');
    expect(config.structuredOutputMode).toBe('json_schema');
    expect(config.disableResponseStorage).toBe(true);
    expect(config.reasoningEffort).toBe('low');
  });

  it('Chat Completions 环境协议未声明结构化模式时应默认使用 json_object', () => {
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      [
        'OPENAI_API_KEY=mock-local-key',
        'ANALYSIS_AI_BASE_URL=https://api.example.com/v1',
        'ANALYSIS_AI_MODEL_PROVIDER=deepseek',
        'ANALYSIS_AI_MODEL=deepseek-chat',
        'ANALYSIS_AI_WIRE_API=chat_completions',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();
    const config = service.getAiConfig();

    expect(config.sdkType).toBe('openai-compatible-http');
    expect(config.wireApi).toBe('chat_completions');
    expect(config.structuredOutputMode).toBe('json_object');
  });

  it('在当前仓库布局下应能从 backend 目录回溯到仓库根', () => {
    const fallbackRepoRoot = mkdtempSync(join(tmpdir(), 'crm-repo-root-'));
    const previousCwd = process.cwd();

    try {
      mkdirSync(join(fallbackRepoRoot, 'specs'), { recursive: true });
      mkdirSync(join(fallbackRepoRoot, 'backend'), { recursive: true });
      mkdirSync(join(fallbackRepoRoot, 'frontend'), { recursive: true });
      writeFileSync(join(fallbackRepoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - backend\n', 'utf8');

      process.chdir(join(fallbackRepoRoot, 'backend'));

      const service = new LocalRuntimeConfigService();

      expect(realpathSync(service.getRepoRoot())).toBe(realpathSync(fallbackRepoRoot));
    } finally {
      process.chdir(previousCwd);
      rmSync(fallbackRepoRoot, { recursive: true, force: true });
    }
  });

  it('生产发布包缺少 specs 目录时也应从 backend 目录回溯到发布根', () => {
    const releaseRoot = mkdtempSync(join(tmpdir(), 'crm-release-root-'));
    const previousCwd = process.cwd();

    try {
      mkdirSync(join(releaseRoot, 'backend'), { recursive: true });
      mkdirSync(join(releaseRoot, 'frontend'), { recursive: true });
      writeFileSync(join(releaseRoot, 'pnpm-workspace.yaml'), 'packages:\n  - backend\n', 'utf8');

      process.chdir(join(releaseRoot, 'backend'));

      const service = new LocalRuntimeConfigService();

      expect(realpathSync(service.getRepoRoot())).toBe(realpathSync(releaseRoot));
    } finally {
      process.chdir(previousCwd);
      rmSync(releaseRoot, { recursive: true, force: true });
    }
  });

  it('开发环境默认使用企业微信 mock transport，显式开启时才使用 SDK', () => {
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      ['OPENAI_API_KEY=mock-local-key', ''].join('\n'),
      'utf8',
    );
    process.env.WECOM_BOT_TRANSPORT_MODE = 'mock';
    process.env.NODE_ENV = 'development';

    const service = new LocalRuntimeConfigService();
    const config = service.getWecomRuntimeConfig();

    expect(config.botTransportMode).toBe('mock');

    process.env.WECOM_ENABLE_SDK_TRANSPORT = 'true';
    const sdkService = new LocalRuntimeConfigService();

    expect(sdkService.getWecomRuntimeConfig().botTransportMode).toBe('sdk');
  });

  it('开发环境应优先读取 backend/.env.development.local，再回退通用本地配置', () => {
    process.env.NODE_ENV = 'development';
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.development.local'),
      [
        'OPENAI_API_KEY=mock-development-key',
        'ANALYSIS_AI_BASE_URL=https://dev.example.com/v1',
        'ANALYSIS_AI_MODEL_PROVIDER=development-provider',
        'ANALYSIS_AI_MODEL=gpt-dev',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();
    const config = service.getAiConfig();

    expect(config.apiKey).toBe('mock-development-key');
    expect(config.baseUrl).toBe('https://dev.example.com/v1');
    expect(config.modelProvider).toBe('development-provider');
    expect(config.model).toBe('gpt-dev');
  });

  it('通过后端 dev 脚本启动且未声明 NODE_ENV 时，应读取开发环境 Web 地址', () => {
    delete process.env.NODE_ENV;
    process.env.npm_lifecycle_event = 'dev';
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.development.local'),
      [
        'APP_WEB_BASE_URL=http://10.20.13.53:5173',
        'WECOM_WEB_LOGIN_CALLBACK_URL=http://10.20.13.53:3000/api/v1/auth/wecom/callback',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();
    const config = service.getWecomRuntimeConfig();

    expect(config.webBaseUrl).toBe('http://10.20.13.53:5173');
    expect(config.loginCallbackUrl).toBe(
      'http://10.20.13.53:3000/api/v1/auth/wecom/callback',
    );
  });

  it('生产环境不应继续读取仓库中的 backend/.env.local', () => {
    process.env.NODE_ENV = 'production';
    process.env.WECOM_WEB_LOGIN_CALLBACK_URL =
      'http://10.10.3.241/api/v1/auth/wecom/callback';
    process.env.APP_WEB_BASE_URL = 'http://10.10.3.241';

    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      [
        'WECOM_WEB_LOGIN_CALLBACK_URL=http://10.20.13.53:3000/api/v1/auth/wecom/callback',
        'APP_WEB_BASE_URL=http://10.20.13.53:5173',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();
    const config = service.getWecomRuntimeConfig();

    expect(config.loginCallbackUrl).toBe(
      'http://10.10.3.241/api/v1/auth/wecom/callback',
    );
    expect(config.webBaseUrl).toBe('http://10.10.3.241');
  });

  it('未显式配置写回库 host 时，应回退到只读库 host 作为企业微信原生映射写入数据源', () => {
    process.env.CRM_READONLY_DB_HOST = '192.168.248.241';
    process.env.CRM_READONLY_DB_PORT = '3306';
    process.env.CRM_READONLY_DB_NAME = 'vcooline_ikcrm_production';
    process.env.CRM_READONLY_DB_USER = 'crm_ai_analysis';
    process.env.CRM_READONLY_DB_PASSWORD = 'readonly-password';
    delete process.env.CRM_WRITEBACK_DB_HOST;
    delete process.env.CRM_WRITEBACK_DB_PORT;
    delete process.env.CRM_WRITEBACK_DB_NAME;
    delete process.env.CRM_WRITEBACK_DB_USER;
    delete process.env.CRM_WRITEBACK_DB_PASSWORD;

    const service = new LocalRuntimeConfigService();
    const config = service.getCrmWritebackDbConfig();

    expect(config).toMatchObject({
      enabled: true,
      host: '192.168.248.241',
      port: 3306,
      database: 'vcooline_ikcrm_production',
      user: 'crm_ai_analysis',
      password: 'readonly-password',
    });
  });

  it('应读取联软标准 OpenAPI 运行时配置，并统一裁剪基址末尾斜杠', () => {
    process.env.CRM_STANDARD_OPEN_API_BASE_URL = 'https://crm.example.com/api/open/v1/';
    process.env.CRM_STANDARD_OPEN_API_APP_KEY = 'oak_test';
    process.env.CRM_STANDARD_OPEN_API_APP_SECRET = 'oas_test';
    process.env.CRM_STANDARD_OPEN_API_TIMEOUT_MS = '15000';
    process.env.CRM_STANDARD_OPEN_API_TOKEN_CACHE_BUFFER_SECONDS = '120';

    const service = new LocalRuntimeConfigService();
    const config = service.getCrmStandardOpenApiConfig();

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://crm.example.com/api/open/v1',
      appKey: 'oak_test',
      appSecret: 'oas_test',
      timeoutMs: 15000,
      tokenCacheBufferSeconds: 120,
    });
  });

  it('应读取真实登录主配置，并兼容自定义登录路径', () => {
    process.env.CRM_OPEN_API_BASE_URL = 'https://crm.example.com/';
    process.env.CRM_OPEN_API_LOGIN_PATH = 'custom/auth/login/';
    process.env.CRM_OPEN_API_TIMEOUT_MS = '9000';
    process.env.CRM_OPEN_API_VERSION_CODE = '10.2.1';
    process.env.CRM_OPEN_API_DEVICE = 'crm_h5';

    const service = new LocalRuntimeConfigService();
    const config = service.getCrmAuthConfig();

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://crm.example.com/',
      loginPath: '/custom/auth/login',
      timeoutMs: 9000,
      versionCode: '10.2.1',
      device: 'crm_h5',
    });
  });

  it('进程环境显式关闭 mock 时，应覆盖本地环境文件中的 mock 开关', () => {
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.local'),
      [
        'CRM_AUTH_MOCK_ENABLED=true',
        '',
      ].join('\n'),
      'utf8',
    );
    process.env.CRM_AUTH_MOCK_ENABLED = 'false';
    process.env.CRM_OPEN_API_BASE_URL = 'https://crm.example.com';

    const service = new LocalRuntimeConfigService();
    const config = service.getCrmAuthConfig();

    expect(config.mockEnabled).toBe(false);
  });

  it('应读取真实登录身份查询 API 配置，并兼容默认路径与鉴权模式', () => {
    process.env.CRM_AUTH_IDENTITY_API_BASE_URL =
      'https://crm.example.com/';
    process.env.CRM_AUTH_IDENTITY_API_USER_PATH =
      '/api/open/v1/identity/users/{userId}';
    process.env.CRM_AUTH_IDENTITY_API_TIMEOUT_MS = '9000';
    process.env.CRM_AUTH_IDENTITY_API_AUTH_MODE = 'none';

    const service = new LocalRuntimeConfigService();
    const config = service.getCrmAuthIdentityApiConfig();

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://crm.example.com',
      userPathTemplate: '/api/open/v1/identity/users/{userId}',
      timeoutMs: 9000,
      authMode: 'none',
    });
  });

  it('生产日报启用时应默认开启内置调度，并保留测试接收人改投保护', () => {
    process.env.NODE_ENV = 'production';
    writeFileSync(
      join(tempRepoRoot, 'backend', '.env.production.local'),
      [
        'DAILY_REPORT_ENABLED=true',
        'DAILY_REPORT_SCHEDULER_ACTOR_USER_ID=user_admin',
        'WECOM_NOTIFY_REAL_MESSAGE_ENABLED=false',
        'WECOM_NOTIFY_TEST_USER_ID=WangLiang02',
        '',
      ].join('\n'),
      'utf8',
    );

    const service = new LocalRuntimeConfigService();

    expect(service.getDailyReportConfig()).toMatchObject({
      enabled: true,
      internalSchedulerEnabled: true,
      schedulerActorUserId: 'user_admin',
      reminderTime: '22:00',
      closeTime: '23:59',
      summaryTime: '08:00',
    });
    expect(service.getWecomNotifyConfig()).toMatchObject({
      realMessageEnabled: false,
      testReceiverUserId: 'WangLiang02',
    });
  });
});
