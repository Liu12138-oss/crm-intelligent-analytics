import { BadRequestException } from '@nestjs/common';
import { QueryTemplateSqlGuardService } from '../../../src/modules/query-assets/query-template-sql-guard.service';

describe('QueryTemplateSqlGuardService', () => {
  function createService() {
    return new QueryTemplateSqlGuardService({
      getCurrent: () => ({
        allowedTables: ['opportunities', 'contracts'],
      }),
    } as never);
  }

  it('发现未授权数据表时应返回友好提示且不暴露表名', () => {
    const service = createService();

    try {
      service.validateReadonlyTemplateSql(
        'SELECT d.id, d.name FROM departments d',
      );
      throw new Error('预期应抛出 BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toContain('超出了系统允许的分析范围');
      expect((error as BadRequestException).message).toContain('联系管理员');
      expect((error as BadRequestException).message).not.toContain('departments');
    }
  });

  it('保存自由问数生成的 SQL 时应允许任务标题注释位于查询语句前', () => {
    const service = createService();

    expect(() =>
      service.validateReadonlyTemplateSql(
        `-- 新增商机金额排名 [primary-summary]
SELECT o.id, o.title
FROM opportunities o
LIMIT 20`,
      ),
    ).not.toThrow();
  });
});
