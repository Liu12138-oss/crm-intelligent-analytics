import { Injectable } from '@nestjs/common';
import type {
  AiExecutableProfile,
  AiProviderAdapter,
  AiProviderHealthCheckResult,
} from './ai-provider.adapter';

const CLAUDE_MIGRATION_MESSAGE =
  '历史 Claude Agent SDK Profile 已停用主运行时，请复制并迁移为 OpenAI 兼容 HTTP Profile 后重新测试激活；Claude CLI、MCP 和工具白名单字段不会进入新版 HTTP 运行时。';

/**
 * 历史 Claude Agent SDK Profile 的迁移占位 adapter。
 *
 * 该类只负责给旧档案返回明确迁移提示，不再执行本地 Claude CLI、
 * MCP 连接校验或 Agent 工具调用。
 */
@Injectable()
export class ClaudeProviderAdapter implements AiProviderAdapter {
  readonly sdkType = 'claude-agent-sdk' as const;

  /**
   * 旧 Claude Agent Profile 不再允许作为可执行运行时。
   */
  validateProfile(): void {
    throw new Error(CLAUDE_MIGRATION_MESSAGE);
  }

  /**
   * 健康检查直接返回迁移提示，不读取 MCP 配置、不拉起本地 CLI。
   */
  async healthCheck(profile: AiExecutableProfile): Promise<AiProviderHealthCheckResult> {
    return {
      status: 'FAILED',
      latencyMs: 0,
      failureStage: 'STATIC_VALIDATION',
      failureReason: CLAUDE_MIGRATION_MESSAGE,
      providerSummary: `${profile.providerCode}:${profile.model}`,
    };
  }

  /**
   * 旧 Claude 文本调用已下线，避免业务链路继续依赖 provider 会话状态。
   */
  async invokeText(): Promise<string> {
    throw new Error(CLAUDE_MIGRATION_MESSAGE);
  }

  /**
   * 旧 Claude 结构化调用已下线，统一改由 HTTP adapter 执行并本地校验。
   */
  async invokeStructured(): Promise<unknown> {
    throw new Error(CLAUDE_MIGRATION_MESSAGE);
  }
}
