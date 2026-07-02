import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildAnthropicDirectBenchmarkBody,
  buildAnthropicDirectHeaders,
  resolveAnthropicMessagesUrl,
} from '../src/shared/utils/anthropic-direct-benchmark.util';

type CodexReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
type ClaudeDirectEffort = 'low' | 'medium' | 'high' | 'max';
type CodexClient = {
  startThread(options?: {
    model?: string;
    sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
    workingDirectory?: string;
    skipGitRepoCheck?: boolean;
    modelReasoningEffort?: CodexReasoningEffort;
    networkAccessEnabled?: boolean;
    approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
    webSearchEnabled?: boolean;
  }): {
    run(input: string): Promise<{ finalResponse: string }>;
  };
};

const DEFAULT_PROMPT = '请判断 104729 是否为质数，只返回 YES 或 NO。';

async function importCodexSdk(): Promise<{
  Codex: new (options?: Record<string, unknown>) => CodexClient;
}> {
  return (new Function(
    'specifier',
    'return import(specifier);',
  )('@openai/codex-sdk')) as Promise<{
    Codex: new (options?: Record<string, unknown>) => CodexClient;
  }>;
}

function loadLocalEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/gu, '');
    process.env[key] ??= value;
  }
}

function loadLocalEnv(): void {
  const backendDir = process.cwd();
  const repoRoot = resolve(backendDir, '..');
  loadLocalEnvFile(join(repoRoot, '.env.local'));
  loadLocalEnvFile(join(backendDir, '.env.local'));
}

function toBool(value?: string, fallback?: boolean): boolean | undefined {
  if (value == null || value === '') {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function extractPrompt(): string {
  const promptIndex = process.argv.findIndex((item) => item === '--prompt');
  if (promptIndex >= 0 && process.argv[promptIndex + 1]) {
    return process.argv[promptIndex + 1];
  }

  return DEFAULT_PROMPT;
}

async function benchmarkCodex(prompt: string) {
  const model = process.env.ANALYSIS_AI_MODEL;
  const baseUrl = process.env.ANALYSIS_AI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const provider = process.env.ANALYSIS_AI_MODEL_PROVIDER;
  if (!model || !baseUrl || !apiKey || !provider) {
    throw new Error('缺少 Codex benchmark 所需环境变量。');
  }

  const sdkModule = await importCodexSdk();
  const codex = new sdkModule.Codex({
    apiKey,
    baseUrl,
    config: {
      disable_response_storage: toBool(
        process.env.ANALYSIS_AI_DISABLE_RESPONSE_STORAGE,
        true,
      ),
      model_provider: provider,
      model_providers: {
        [provider]: {
          name: provider,
          base_url: baseUrl,
          wire_api: process.env.ANALYSIS_AI_WIRE_API ?? 'responses',
          requires_openai_auth: toBool(
            process.env.ANALYSIS_AI_REQUIRES_OPENAI_AUTH,
            true,
          ),
        },
      },
    },
  });

  const levels: CodexReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh'];
  const results: Array<{
    level: CodexReasoningEffort;
    durationMs: number;
    response: string;
  }> = [];

  for (const level of levels) {
    const thread = codex.startThread({
      model,
      sandboxMode: 'read-only',
      workingDirectory: resolve(process.cwd(), '..'),
      skipGitRepoCheck: true,
      networkAccessEnabled: false,
      approvalPolicy: 'never',
      webSearchEnabled: false,
      modelReasoningEffort: level,
    });
    const startedAt = Date.now();
    const result = await thread.run(prompt);
    results.push({
      level,
      durationMs: Date.now() - startedAt,
      response: String(result.finalResponse ?? '').trim(),
    });
  }

  return {
    model,
    levels: results,
  };
}

async function benchmarkClaudeDirect(prompt: string) {
  const model = process.env.ANTHROPIC_MODEL;
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;

  if (!model || !baseUrl || (!apiKey && !authToken)) {
    throw new Error('缺少 Claude 直连 benchmark 所需环境变量。');
  }

  const url = resolveAnthropicMessagesUrl(baseUrl);
  const headers = buildAnthropicDirectHeaders({ apiKey, authToken });
  const levels: ClaudeDirectEffort[] = ['low', 'medium', 'high', 'max'];
  const results: Array<{
    level: ClaudeDirectEffort;
    durationMs: number;
    response: string;
  }> = [];

  for (const level of levels) {
    const startedAt = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        buildAnthropicDirectBenchmarkBody({
          model,
          prompt,
          effort: level,
        }),
      ),
    });

    if (!response.ok) {
      const failureText = await response.text();
      throw new Error(
        `Claude 直连 API 请求失败：${response.status} ${response.statusText} ${failureText}`,
      );
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const textBlock = payload.content?.find((item) => item.type === 'text');

    results.push({
      level,
      durationMs: Date.now() - startedAt,
      response: textBlock?.text?.trim() ?? '',
    });
  }

  return {
    model,
    url,
    levels: results,
  };
}

async function main() {
  loadLocalEnv();
  const prompt = extractPrompt();
  const startedAt = Date.now();

  const result = {
    measuredAt: new Date().toISOString(),
    prompt,
    codex: await benchmarkCodex(prompt),
    claudeDirect: await benchmarkClaudeDirect(prompt),
    totalDurationMs: Date.now() - startedAt,
  };

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
