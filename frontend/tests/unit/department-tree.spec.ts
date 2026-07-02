import { describe, expect, it } from 'vitest';
import { buildDepartmentTree } from '@/utils/department-tree';

describe('department tree utility', () => {
  it('应按父子关系递归构造成多级部门树', () => {
    const tree = buildDepartmentTree([
      { id: 'all-company', label: '全公司' },
      { id: 'dept_sales', label: '销售部', parentDepartmentId: 'all-company' },
      { id: 'dept_region_east', label: '华东销售部', parentDepartmentId: 'dept_sales' },
      { id: 'dept_branch_sh', label: '上海宇辰科技发展有限公司', parentDepartmentId: 'dept_region_east' },
    ]);

    expect(tree).toEqual([
      expect.objectContaining({
        id: 'all-company',
        children: [
          expect.objectContaining({
            id: 'dept_sales',
            children: [
              expect.objectContaining({
                id: 'dept_region_east',
                children: [
                  expect.objectContaining({
                    id: 'dept_branch_sh',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]);
  });
});
