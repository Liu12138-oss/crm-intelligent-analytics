import { BadRequestException, Injectable } from '@nestjs/common';
import type { AnalysisRoute } from '../../shared/types/domain';

export interface AnalysisRouteOption {
  route: AnalysisRoute;
  label: string;
  enabled: boolean;
  description: string;
}

@Injectable()
export class AnalysisRouteConfigService {
  /**
   * 解析本次请求最终使用的分析路线。
   *
   * 参数说明：`requestedRoute` 为 Web 请求体或其它入口传入的路线值。
   * 返回值说明：返回可执行的分析路线。
   * 可能抛出的异常：当请求了 SQLite、MySQL 或受控 SQL 历史路线时抛出业务异常。
   * 调用注意事项：不能静默回退历史路线，否则用户无法判断当前结果是否来自正式快照主链。
   */
  resolveRoute(requestedRoute?: unknown): AnalysisRoute {
    const route = this.normalizeRoute(requestedRoute) ?? this.getDefaultRoute();
    this.ensureRouteAvailable(route);
    return route;
  }

  /**
   * 返回后端默认分析路线。
   *
   * 参数说明：无。
   * 返回值说明：固定返回 OpenAPI Markdown 快照主链。
   * 调用注意事项：环境变量中的历史路线配置当前不会影响正式问答主链。
   */
  getDefaultRoute(): AnalysisRoute {
    return 'OPENAPI';
  }

  /**
   * 返回 Web 能展示的路线选项。
   *
   * 参数说明：无。
   * 返回值说明：包含路线、中文标签、启用状态和简要说明。
   * 调用注意事项：该快照只表达入口能力，真实执行仍以请求时配置校验为准。
   */
  getRouteOptions(): AnalysisRouteOption[] {
    return [
      {
        route: 'OPENAPI',
        label: 'OpenAPI Markdown 快照',
        enabled: true,
        description: '正式分析只读本地 Markdown 快照；OpenAPI 仅用于刷新快照文件。',
      },
    ];
  }

  /**
   * 校验指定路线当前是否可执行。
   *
   * 参数说明：`route` 为已归一化分析路线。
   * 返回值说明：无返回值，校验通过即表示可以进入对应主链。
   * 可能抛出的异常：历史路线被请求时抛出业务异常。
   */
  private ensureRouteAvailable(route: AnalysisRoute): void {
    if (route === 'OPENAPI') {
      return;
    }

    throw new BadRequestException(
      '当前正式分析只启用 OpenAPI Markdown 快照主链，SQLite、MySQL、受控 SQL 等历史兜底路线已临时停用。',
    );
  }

  /**
   * 归一化外部传入路线。
   *
   * 参数说明：`value` 允许来自 Web 表单、历史记录或空值。
   * 返回值说明：可识别时返回路线；空值返回 `undefined`，无效值直接抛出。
   */
  private normalizeRoute(value?: unknown): AnalysisRoute | undefined {
    if (value === undefined || value === null || value === '' || value === 'DEFAULT') {
      return undefined;
    }

    const normalizedValue = String(value).trim().toUpperCase();
    if (normalizedValue === 'OPENAPI') {
      return 'OPENAPI';
    }

    if (
      normalizedValue === 'SQLITE_READONLY' ||
      normalizedValue === 'SQLITE-READONLY' ||
      normalizedValue === 'SQLITE'
    ) {
      throw new BadRequestException(
        '当前正式分析只启用 OpenAPI Markdown 快照主链，SQLite 只读库路线已临时停用。',
      );
    }

    throw new BadRequestException('未知的分析路线，请重新选择后再提交。');
  }
}
