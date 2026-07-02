import { BadRequestException } from '@nestjs/common';
import { AnalysisRouteConfigService } from '../../../src/modules/analysis/analysis-route-config.service';

describe('AnalysisRouteConfigService', () => {
  it('正式分析路线只应暴露 OpenAPI Markdown 快照主链', () => {
    const service = new AnalysisRouteConfigService();

    expect(service.getDefaultRoute()).toBe('OPENAPI');
    expect(service.getRouteOptions()).toEqual([
      {
        route: 'OPENAPI',
        label: 'OpenAPI Markdown 快照',
        enabled: true,
        description: '正式分析只读本地 Markdown 快照；OpenAPI 仅用于刷新快照文件。',
      },
    ]);
  });

  it('请求 SQLite 只读库路线时应直接拒绝', () => {
    const service = new AnalysisRouteConfigService();

    expect(() => service.resolveRoute('SQLITE_READONLY')).toThrow(BadRequestException);
    expect(() => service.resolveRoute('sqlite')).toThrow(
      '当前正式分析只启用 OpenAPI Markdown 快照主链',
    );
  });
});
