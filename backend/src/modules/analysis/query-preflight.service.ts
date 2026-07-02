import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type { CompiledQuery } from './query-compiler.service';
import { QueryPreflightError } from './analysis.errors';

@Injectable()
export class QueryPreflightService {
  constructor(private readonly crmReadonlyService: CrmReadonlyService) {}

  async validate(sql: string, params: unknown[], compiledQuery: CompiledQuery): Promise<void> {
    if (!this.hasScopeFilters(compiledQuery.plan.filters)) {
      throw new QueryPreflightError('执行前预检失败，当前查询缺少必要的权限或时间范围限制。');
    }

    this.validateTemporalSlot(compiledQuery);

    if (!this.crmReadonlyService.canUseLiveQuery()) {
      return;
    }

    await this.crmReadonlyService.preflightQuery(sql, params, {
      timeoutMs: compiledQuery.timeoutMs,
    });
  }

  private hasScopeFilters(filters: Record<string, unknown>): boolean {
    const organizationIds = Array.isArray(filters.organizationIds) ? filters.organizationIds.length : 0;
    const departmentIds = Array.isArray(filters.departmentIds) ? filters.departmentIds.length : 0;
    const ownerIds = Array.isArray(filters.ownerIds) ? filters.ownerIds.length : 0;
    const hasTimeRange = typeof filters.startAt === 'string' && filters.startAt.length > 0;
    return organizationIds > 0 || departmentIds > 0 || ownerIds > 0 || hasTimeRange;
  }

  /**
   * 执行前校验标准时间槽的确定性边界。
   *
   * 参数说明：`compiledQuery` 是已编译的只读查询任务。
   * 返回值：无；时间槽低置信、缺边界、时区错误或窗口过宽时抛出 `QueryPreflightError`。
   * 调用注意：这里不做自然语言解析，只验证 AI 时间槽已经被固定为可执行边界。
   */
  private validateTemporalSlot(compiledQuery: CompiledQuery): void {
    const temporalSlot = compiledQuery.plan.temporalSlot;
    if (!temporalSlot) {
      return;
    }

    if (temporalSlot.confidence === 'LOW') {
      throw new QueryPreflightError('执行前预检失败，时间槽置信度过低，需要先补充时间范围。');
    }

    if (!temporalSlot.startAt || !temporalSlot.endAt) {
      throw new QueryPreflightError('执行前预检失败，时间槽缺少可执行起止边界。');
    }

    if (compiledQuery.plan.filters.startAt !== temporalSlot.startAt ||
      compiledQuery.plan.filters.endAt !== temporalSlot.endAt) {
      throw new QueryPreflightError('执行前预检失败，查询参数与标准时间槽边界不一致。');
    }

    if (temporalSlot.timezone !== 'Asia/Shanghai') {
      throw new QueryPreflightError('执行前预检失败，时间槽时区不在允许范围内。');
    }

    const startAt = Date.parse(temporalSlot.startAt);
    const endAt = Date.parse(temporalSlot.endAt);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      throw new QueryPreflightError('执行前预检失败，时间槽边界不是有效时间窗口。');
    }

    const maxWindowMs = 366 * 24 * 60 * 60 * 1000;
    if (endAt - startAt > maxWindowMs) {
      throw new QueryPreflightError('执行前预检失败，时间窗口超过系统允许上限。');
    }
  }
}
