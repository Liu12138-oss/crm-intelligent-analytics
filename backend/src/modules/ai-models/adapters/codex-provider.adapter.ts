import { Injectable } from '@nestjs/common';
import type {
  AiExecutableProfile,
  AiProviderAdapter,
  AiProviderHealthCheckResult,
} from './ai-provider.adapter';

const CODEX_MIGRATION_MESSAGE =
  '历史 Codex SDK Profile 已停用主运行时，请复制并迁移为 OpenAI 兼容 HTTP Profile 后重新测试激活。';

/**
 * 历史 Codex SDK Profile 的迁移占位 adapter。
 *
 * 设计原因：
 * 1. 旧数据仍可能包含 `codex-sdk`，治理页需要给出明确迁移提示；
 * 2. 新版主运行时不得再动态导入 Codex SDK、启动本地 CLI 或依赖线程状态；
 * 3. 所有新模型接入必须通过 OpenAI 兼容 HTTP adapter 或单独新增受控 adapter。
 */
@Injectable()
export class CodexProviderAdapter implements AiProviderAdapter {
  readonly sdkType = 'codex-sdk' as const;

  /**
   * 旧 Codex Profile 不再允许作为可执行运行时。
   */
  validateProfile(): void {
    throw new Error(CODEX_MIGRATION_MESSAGE);
  }

  /**
   * 健康检查直接返回迁移提示，不拉起任何本地 SDK 或 CLI。
   */
  async healthCheck(profile: AiExecutableProfile): Promise<AiProviderHealthCheckResult> {
    return {
      status: 'FAILED',
      latencyMs: 0,
      failureStage: 'STATIC_VALIDATION',
      failureReason: CODEX_MIGRATION_MESSAGE,
      providerSummary: `${profile.providerCode}:${profile.model}`,
    };
  }

  /**
   * 旧 Codex 文本调用已下线，避免业务链路绕过统一 HTTP 运行时。
   */
  async invokeText(): Promise<string> {
    throw new Error(CODEX_MIGRATION_MESSAGE);
  }

  /**
   * 旧 Codex 结构化调用已下线，结构化能力由 HTTP adapter 本地校验兜底。
   */
  async invokeStructured(): Promise<unknown> {
    throw new Error(CODEX_MIGRATION_MESSAGE);
  }
}
