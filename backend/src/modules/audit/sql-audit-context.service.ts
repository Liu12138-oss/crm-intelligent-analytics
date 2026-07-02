import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  AnalysisExecutionMode,
  AnalysisExecutionSource,
  ChannelType,
  SqlAuditModuleKey,
} from '../../shared/types/domain';

export interface SqlAuditContextValue {
  actorId: string;
  actorRoleIds: string[];
  channel?: ChannelType;
  sessionId?: string;
  requestId?: string;
  moduleKey?: SqlAuditModuleKey;
  programName?: string;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  fallbackReason?: string;
}

@Injectable()
export class SqlAuditContextService {
  private readonly storage = new AsyncLocalStorage<SqlAuditContextValue>();

  /**
   * 在当前异步链路中注入 SQL 审计上下文，参数为增量上下文字段和待执行处理函数。
   */
  run<T>(
    context: Partial<SqlAuditContextValue>,
    handler: () => Promise<T>,
  ): Promise<T> {
    const nextContext = this.mergeContext(context);
    return this.storage.run(nextContext, handler);
  }

  /**
   * 读取当前异步链路中的 SQL 审计上下文；若未设置则返回空值。
   */
  getContext(): SqlAuditContextValue | undefined {
    return this.storage.getStore();
  }

  /**
   * 合并显式上下文与系统默认值，避免后台任务或兜底路径丢失责任主体。
   */
  resolveContext(
    overrides: Partial<SqlAuditContextValue> = {},
  ): SqlAuditContextValue {
    return this.mergeContext(overrides);
  }

  /**
   * 统一生成下一层上下文快照，优先继承上层链路，再补系统默认值。
   */
  private mergeContext(
    overrides: Partial<SqlAuditContextValue>,
  ): SqlAuditContextValue {
    const current = this.storage.getStore();
    return {
      actorId: overrides.actorId ?? current?.actorId ?? 'system:crm-intelligent-analytics',
      actorRoleIds: overrides.actorRoleIds ?? current?.actorRoleIds ?? [],
      channel: overrides.channel ?? current?.channel,
      sessionId: overrides.sessionId ?? current?.sessionId,
      requestId: overrides.requestId ?? current?.requestId,
      moduleKey: overrides.moduleKey ?? current?.moduleKey ?? 'system',
      programName: overrides.programName ?? current?.programName ?? 'system',
      executionMode: overrides.executionMode ?? current?.executionMode,
      executionSource: overrides.executionSource ?? current?.executionSource,
      matchedAdapter: overrides.matchedAdapter ?? current?.matchedAdapter,
      fallbackReason: overrides.fallbackReason ?? current?.fallbackReason,
    };
  }
}
