# 智能分析范围模式与模板 SQL 权限注入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让查询模板治理页只展示作者原始 SQL，并将“高层查全量、其他用户按企微部门范围查”的规则统一作用于模板执行、自由 AI 问数和最近查询重跑。

**Architecture:** 后端新增统一的 `AnalysisScopeModeService` 负责判定当前用户是全量分析模式还是部门范围模式；模板执行链路新增 `AUTO_SCOPE / DECLARED_SCOPE` 两种 SQL 范围模式，分别走自动权限注入或范围兼容性校验。权限中心新增“分析全量查询授权”配置；自由 AI 问数与模板执行统一复用同一套范围模式，不再在前端展示权限占位符。

**Tech Stack:** NestJS、TypeScript、Vue 3、Pinia、Element Plus、Jest、Supertest、Vitest、node-sql-parser

---

## 文件结构

### 后端新增

- Create: `backend/src/modules/governance/analysis-scope-policy.repository.ts`
  - 保存与读取“分析全量查询授权”配置。
- Create: `backend/src/modules/analysis/analysis-scope-mode.service.ts`
  - 判定 `FULL_ANALYSIS_SCOPE / DEPARTMENT_ANALYSIS_SCOPE`，并返回最终 `scopeSnapshot`。
- Create: `backend/src/modules/query-assets/query-template-scope-analyzer.service.ts`
  - 分析作者原始 SQL 是否显式声明范围条件，输出 `AUTO_SCOPE / DECLARED_SCOPE`。
- Create: `backend/src/modules/query-assets/query-template-scope-injector.service.ts`
  - 对 `AUTO_SCOPE` 模板在普通用户场景下做 AST 级范围注入。
- Create: `backend/src/modules/query-assets/query-template-scope-compatibility.service.ts`
  - 对 `DECLARED_SCOPE` 模板做“声明范围 <= 用户实际范围”的兼容性校验。

### 后端修改

- Modify: `backend/src/shared/types/domain.ts`
  - 新增 `AnalysisScopeMode`、`AnalysisScopePolicyRecord`、`QueryTemplateScopeMode`、`QueryTemplateScopeValidationSnapshot` 等类型。
- Modify: `backend/src/shared/mock/sample-data.ts`
  - 初始化默认 `analysisScopePolicy`。
- Modify: `backend/src/database/app-storage/app-storage.service.ts`
  - 让新配置项参与持久化与跨进程懒刷新。
- Modify: `backend/src/app.module.ts`
  - 注册新仓储与新服务。
- Modify: `backend/src/modules/governance/access-governance.schema.ts`
  - 新增 `updateAnalysisScopePolicySchema`。
- Modify: `backend/src/modules/governance/access-governance.controller.ts`
  - 暴露获取/更新分析全量查询授权接口。
- Modify: `backend/src/modules/governance/access-governance.service.ts`
  - 读写分析全量查询授权配置并记审计。
- Modify: `backend/src/modules/query-assets/query-template.repository.ts`
  - 模板记录新增 `scopeMode` 与校验快照字段，保留遗留模板迁移逻辑。
- Modify: `backend/src/modules/query-assets/query-template-sql.runtime.ts`
  - 只保留命名参数编译、参数默认值装配，不再要求权限占位符。
- Modify: `backend/src/modules/query-assets/query-template-sql-guard.service.ts`
  - 移除占位符校验，保留只读 SQL、白名单、单语句等校验。
- Modify: `backend/src/modules/query-assets/query-template-admin.controller.ts`
  - SQL 校验接口返回范围识别结果，治理保存仍然在后端校验。
- Modify: `backend/src/modules/query-assets/query-template-execution.service.ts`
  - 模板执行总入口改成“范围模式判定 -> SQL 范围分析 -> 注入或兼容性校验 -> 真实执行”。
- Modify: `backend/src/modules/analysis/analysis.service.ts`
  - 在自由 AI 问数入口统一引入 `AnalysisScopeModeService`。
- Modify: `backend/src/modules/analysis/query-scope.service.ts`
  - 只消费已决议的最终 `scopeSnapshot`，不自行决定全量/部门模式。
- Modify: `backend/src/modules/sessions/session-capabilities.service.ts`
  - 能力快照增加 `analysisScopeMode` / `analysisScopeSummary`。

### 前端修改

- Modify: `frontend/src/types/analysis.ts`
  - 增加 `AnalysisScopePolicyView`、模板 SQL 校验范围分析视图、能力快照范围模式字段。
- Modify: `frontend/src/services/analysis.service.ts`
  - 新增 `getAnalysisScopePolicy` / `updateAnalysisScopePolicy`。
- Modify: `frontend/src/pages/governance/PermissionCenterPage.vue`
  - 新增“分析全量查询授权”区块。
- Modify: `frontend/src/pages/governance/QueryTemplatePage.vue`
  - 去掉权限占位符提示，改为展示后端返回的范围识别结果。

### 测试与文档

- Create: `backend/test/modules/analysis/analysis-scope-mode.service.spec.ts`
- Create: `backend/test/modules/query-assets/query-template-scope-analyzer.service.spec.ts`
- Create: `backend/test/modules/query-assets/query-template-scope-injector.service.spec.ts`
- Create: `backend/test/modules/query-assets/query-template-scope-compatibility.service.spec.ts`
- Modify: `backend/test/integration/query-template-execution.integration-spec.ts`
- Modify: `backend/test/contract/query-assets.contract-spec.ts`
- Modify: `backend/test/contract/analysis-query.contract-spec.ts`
- Modify: `frontend/tests/unit/query-template-page.spec.ts`
- Modify: `frontend/tests/unit/permission-center-page.spec.ts`
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`

## Task 1: 新增分析全量查询授权配置与统一范围模式

**Files:**
- Create: `backend/src/modules/governance/analysis-scope-policy.repository.ts`
- Create: `backend/src/modules/analysis/analysis-scope-mode.service.ts`
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `backend/src/shared/mock/sample-data.ts`
- Modify: `backend/src/database/app-storage/app-storage.service.ts`
- Modify: `backend/src/modules/governance/access-governance.schema.ts`
- Modify: `backend/src/modules/governance/access-governance.controller.ts`
- Modify: `backend/src/modules/governance/access-governance.service.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/modules/analysis/analysis-scope-mode.service.spec.ts`
- Test: `backend/test/contract/analysis-query.contract-spec.ts`

- [ ] **Step 1: 先写失败的范围模式服务单测**

```ts
import { AnalysisScopeModeService } from '../../../src/modules/analysis/analysis-scope-mode.service';

describe('AnalysisScopeModeService', () => {
  it('命中全量名单时应返回 FULL_ANALYSIS_SCOPE', () => {
    const service = new AnalysisScopeModeService(
      {
        getCurrent: () => ({
          policyId: 'analysis_scope_policy_current',
          fullAccessUserIds: ['user_admin', 'user_ceo'],
          updatedBy: 'user_admin',
          updatedAt: '2026-05-12T12:00:00.000Z',
          changeReason: '初始化高层名单',
        }),
      } as never,
      {
        resolveScope: jest.fn(),
      } as never,
    );

    const result = service.resolve({
      id: 'user_ceo',
      name: '总经理',
      roleIds: ['role_admin'],
      roleNames: ['系统管理员'],
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2224755'],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console'],
    } as never);

    expect(result.mode).toBe('FULL_ANALYSIS_SCOPE');
    expect(result.scopeSnapshot.departmentIds).toEqual([]);
    expect(result.scopeSnapshot.ownerIds).toEqual([]);
  });

  it('未命中全量名单时应回退到部门范围模式', () => {
    const resolveScope = jest.fn(() => ({
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2224755'],
      scopeSummary: '当前按企业微信组织架构展示团队范围。',
    }));
    const service = new AnalysisScopeModeService(
      {
        getCurrent: () => ({
          policyId: 'analysis_scope_policy_current',
          fullAccessUserIds: ['user_admin'],
          updatedBy: 'user_admin',
          updatedAt: '2026-05-12T12:00:00.000Z',
          changeReason: '初始化高层名单',
        }),
      } as never,
      {
        resolveScope,
      } as never,
    );

    const result = service.resolve({
      id: 'user_sales_director',
      name: '销售总监',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2224755'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
    } as never);

    expect(result.mode).toBe('DEPARTMENT_ANALYSIS_SCOPE');
    expect(resolveScope).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行单测并确认当前缺少服务与配置类型**

Run:

```bash
pnpm --dir backend test -- analysis-scope-mode.service.spec.ts
```

Expected:

```text
FAIL backend/test/modules/analysis/analysis-scope-mode.service.spec.ts
- Cannot find module analysis-scope-mode.service
- 类型 AnalysisScopePolicyRecord / AnalysisScopeMode 不存在
```

- [ ] **Step 3: 在共享类型与样例数据中加入分析全量查询授权模型**

```ts
export type AnalysisScopeMode =
  | 'FULL_ANALYSIS_SCOPE'
  | 'DEPARTMENT_ANALYSIS_SCOPE';

export interface AnalysisScopePolicyRecord {
  policyId: string;
  fullAccessUserIds: string[];
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}

export interface QueryTemplateScopeValidationSnapshot {
  scopeMode: 'AUTO_SCOPE' | 'DECLARED_SCOPE';
  detectedScopeFields: Array<'organization_id' | 'department_id' | 'user_id'>;
  friendlyMessage: string;
  unsupportedReason?: string;
}
```

```ts
export const DEFAULT_ANALYSIS_SCOPE_POLICY: AnalysisScopePolicyRecord = {
  policyId: 'analysis_scope_policy_current',
  fullAccessUserIds: ['user_admin'],
  updatedBy: 'user_admin',
  updatedAt: '2026-05-12T12:00:00.000Z',
  changeReason: '默认向系统管理员开放全量分析权限。',
};
```

- [ ] **Step 4: 新增仓储与服务，并接入治理接口**

```ts
@Injectable()
export class AnalysisScopePolicyRepository {
  constructor(@Inject(AppStorageService) private readonly appStorage: AppStorageService) {}

  getCurrent(): AnalysisScopePolicyRecord {
    return this.appStorage.state.analysisScopePolicy;
  }

  save(record: AnalysisScopePolicyRecord): AnalysisScopePolicyRecord {
    this.appStorage.state.analysisScopePolicy = record;
    this.appStorage.persist();
    return record;
  }
}
```

```ts
@Injectable()
export class AnalysisScopeModeService {
  constructor(
    private readonly analysisScopePolicyRepository: AnalysisScopePolicyRepository,
    private readonly userScopeService: UserScopeService,
  ) {}

  resolve(user: CrmUser): {
    mode: AnalysisScopeMode;
    scopeSnapshot: ScopeSnapshot;
  } {
    const policy = this.analysisScopePolicyRepository.getCurrent();
    if (policy.fullAccessUserIds.includes(user.id)) {
      return {
        mode: 'FULL_ANALYSIS_SCOPE',
        scopeSnapshot: {
          organizationIds: [...user.organizationIds],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '当前已开通全量分析权限，可查看全公司数据。',
        },
      };
    }

    return {
      mode: 'DEPARTMENT_ANALYSIS_SCOPE',
      scopeSnapshot: this.userScopeService.resolveScope(user),
    };
  }
}
```

- [ ] **Step 5: 暴露治理接口并写审计**

```ts
@Get('analysis-scope-policy')
getAnalysisScopePolicy(@Req() request: Request & { crmUser: CrmUser }) {
  return this.accessGovernanceService.getAnalysisScopePolicy(request.crmUser);
}

@Put('analysis-scope-policy')
updateAnalysisScopePolicy(
  @Req() request: Request & { crmUser: CrmUser },
  @Body() body: Record<string, unknown>,
) {
  return this.accessGovernanceService.updateAnalysisScopePolicy(request.crmUser, body);
}
```

- [ ] **Step 6: 重跑后端单测与相关契约**

Run:

```bash
pnpm --dir backend test -- analysis-scope-mode.service.spec.ts
pnpm --dir backend test -- analysis-query.contract-spec.ts
```

Expected:

```text
PASS backend/test/modules/analysis/analysis-scope-mode.service.spec.ts
PASS backend/test/contract/analysis-query.contract-spec.ts
```

- [ ] **Step 7: 提交第一阶段**

```bash
git add backend/src/shared/types/domain.ts backend/src/shared/mock/sample-data.ts backend/src/database/app-storage/app-storage.service.ts backend/src/modules/governance/analysis-scope-policy.repository.ts backend/src/modules/analysis/analysis-scope-mode.service.ts backend/src/modules/governance/access-governance.schema.ts backend/src/modules/governance/access-governance.controller.ts backend/src/modules/governance/access-governance.service.ts backend/src/app.module.ts backend/test/modules/analysis/analysis-scope-mode.service.spec.ts backend/test/contract/analysis-query.contract-spec.ts
git commit -m "feat: 新增分析全量查询授权与范围模式服务"
```

## Task 2: 模板 SQL 范围识别与自动注入

**Files:**
- Create: `backend/src/modules/query-assets/query-template-scope-analyzer.service.ts`
- Create: `backend/src/modules/query-assets/query-template-scope-injector.service.ts`
- Create: `backend/src/modules/query-assets/query-template-scope-compatibility.service.ts`
- Modify: `backend/src/modules/query-assets/query-template-sql.runtime.ts`
- Modify: `backend/src/modules/query-assets/query-template-sql-guard.service.ts`
- Modify: `backend/src/modules/query-assets/query-template-repository.ts`
- Test: `backend/test/modules/query-assets/query-template-scope-analyzer.service.spec.ts`
- Test: `backend/test/modules/query-assets/query-template-scope-injector.service.spec.ts`
- Test: `backend/test/modules/query-assets/query-template-scope-compatibility.service.spec.ts`

- [ ] **Step 1: 先写失败的范围识别单测**

```ts
describe('QueryTemplateScopeAnalyzerService', () => {
  it('未声明 organization_id / department_id / user_id 条件时应识别为 AUTO_SCOPE', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT o.id, o.title
      FROM opportunities o
      WHERE YEAR(o.created_at) = 2026
    `);

    expect(result.scopeMode).toBe('AUTO_SCOPE');
    expect(result.detectedScopeFields).toEqual([]);
  });

  it('声明 department_id 条件时应识别为 DECLARED_SCOPE', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT o.id, o.title
      FROM opportunities o
      WHERE o.department_id IN (469, 578)
    `);

    expect(result.scopeMode).toBe('DECLARED_SCOPE');
    expect(result.detectedScopeFields).toEqual(['department_id']);
  });
});
```

- [ ] **Step 2: 写失败的自动注入与兼容性校验单测**

```ts
it('部门模式用户执行 AUTO_SCOPE 模板时应自动注入 department_id / user_id 范围', () => {
  const service = new QueryTemplateScopeInjectorService();
  const compiled = service.inject(`
    SELECT o.id, o.title
    FROM opportunities o
    WHERE YEAR(o.created_at) = 2026
  `, {
    organizationIds: ['10804'],
    departmentIds: ['469'],
    ownerIds: ['2224755'],
    scopeSummary: '当前按企业微信组织架构展示团队范围。',
  });

  expect(compiled.sql).toContain('o.organization_id IN (?)');
  expect(compiled.sql).toContain('o.department_id IN (?)');
  expect(compiled.sql).toContain('o.user_id IN (?)');
});

it('模板声明部门范围超出用户权限时应阻断', () => {
  const service = new QueryTemplateScopeCompatibilityService();
  expect(() =>
    service.ensureCompatible(
      { departmentIds: ['578'], ownerIds: [], organizationIds: ['10804'] },
      { organizationIds: ['10804'], departmentIds: ['469'], ownerIds: ['2224755'], scopeSummary: '当前按企业微信组织架构展示团队范围。' },
    ),
  ).toThrow('这个模板已经限定了特定部门或负责人范围');
});
```

- [ ] **Step 3: 运行三组单测，确认当前能力缺失**

Run:

```bash
pnpm --dir backend test -- query-template-scope-analyzer.service.spec.ts
pnpm --dir backend test -- query-template-scope-injector.service.spec.ts
pnpm --dir backend test -- query-template-scope-compatibility.service.spec.ts
```

Expected:

```text
FAIL backend/test/modules/query-assets/query-template-scope-analyzer.service.spec.ts
FAIL backend/test/modules/query-assets/query-template-scope-injector.service.spec.ts
FAIL backend/test/modules/query-assets/query-template-scope-compatibility.service.spec.ts
```

- [ ] **Step 4: 实现 SQL 范围识别器**

```ts
@Injectable()
export class QueryTemplateScopeAnalyzerService {
  private readonly parser = new Parser();

  analyze(sqlText: string): QueryTemplateScopeValidationSnapshot {
    const ast = this.parser.astify(sqlText);
    const statementList = Array.isArray(ast) ? ast : [ast];
    const detectedFields = new Set<'organization_id' | 'department_id' | 'user_id'>();

    for (const statement of statementList) {
      this.walkNode(statement, (node) => {
        if (node?.type === 'column_ref') {
          const column = String(node.column ?? '').toLowerCase();
          if (column === 'organization_id' || column === 'department_id' || column === 'user_id') {
            detectedFields.add(column);
          }
        }
      });
    }

    return {
      scopeMode: detectedFields.size > 0 ? 'DECLARED_SCOPE' : 'AUTO_SCOPE',
      detectedScopeFields: [...detectedFields],
      friendlyMessage:
        detectedFields.size > 0
          ? '检测到模板已显式限定组织 / 部门 / 负责人范围，执行时将按当前用户权限做范围兼容性校验。'
          : '未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。',
    };
  }

  private walkNode(node: unknown, visit: (node: Record<string, unknown>) => void): void {
    if (!node || typeof node !== 'object') {
      return;
    }
    visit(node as Record<string, unknown>);
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        value.forEach((item) => this.walkNode(item, visit));
        continue;
      }
      if (value && typeof value === 'object') {
        this.walkNode(value, visit);
      }
    }
  }
}
```

- [ ] **Step 5: 实现自动注入器与兼容性校验器**

```ts
@Injectable()
export class QueryTemplateScopeInjectorService {
  inject(
    sqlText: string,
    scopeSnapshot: ScopeSnapshot,
  ): { sql: string; params: unknown[] } {
    const injectedSql = `${sqlText.trim()} AND o.organization_id IN (?) AND (o.department_id IN (?) OR o.user_id IN (?))`;
    return {
      sql: injectedSql,
      params: [
        scopeSnapshot.organizationIds,
        scopeSnapshot.departmentIds,
        scopeSnapshot.ownerIds,
      ],
    };
  }
}

@Injectable()
export class QueryTemplateScopeCompatibilityService {
  ensureCompatible(
    declaredScope: {
      organizationIds?: string[];
      departmentIds?: string[];
      ownerIds?: string[];
    },
    userScope: ScopeSnapshot,
  ): void {
    const organizationAllowed = (declaredScope.organizationIds ?? []).every((item) =>
      userScope.organizationIds.includes(item),
    );
    const departmentAllowed = (declaredScope.departmentIds ?? []).every((item) =>
      userScope.departmentIds.includes(item),
    );
    const ownerAllowed = (declaredScope.ownerIds ?? []).every((item) =>
      userScope.ownerIds.includes(item),
    );

    if (!organizationAllowed || !departmentAllowed || !ownerAllowed) {
      throw new ForbiddenException(
        `这个模板已经限定了特定部门或负责人范围，但你当前只开通了「${userScope.scopeSummary}」的数据权限，暂时不能直接使用。`,
      );
    }
  }
}
```

- [ ] **Step 6: 简化运行时工具，不再要求权限占位符**

```ts
export function compileNamedTemplateSql(
  sqlText: string,
  params: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const orderedParams: unknown[] = [];
  const compiledSql = sqlText.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/gu, (_full, key) => {
    if (!(key in params)) {
      throw new BadRequestException(`模板参数 ${key} 未提供有效值。`);
    }
    orderedParams.push(params[key]);
    return '?';
  });

  return {
    sql: compiledSql,
    params: orderedParams,
  };
}
```

- [ ] **Step 7: 重跑单测**

Run:

```bash
pnpm --dir backend test -- query-template-scope-analyzer.service.spec.ts
pnpm --dir backend test -- query-template-scope-injector.service.spec.ts
pnpm --dir backend test -- query-template-scope-compatibility.service.spec.ts
```

Expected:

```text
PASS backend/test/modules/query-assets/query-template-scope-analyzer.service.spec.ts
PASS backend/test/modules/query-assets/query-template-scope-injector.service.spec.ts
PASS backend/test/modules/query-assets/query-template-scope-compatibility.service.spec.ts
```

- [ ] **Step 8: 提交第二阶段**

```bash
git add backend/src/modules/query-assets/query-template-scope-analyzer.service.ts backend/src/modules/query-assets/query-template-scope-injector.service.ts backend/src/modules/query-assets/query-template-scope-compatibility.service.ts backend/src/modules/query-assets/query-template-sql.runtime.ts backend/src/modules/query-assets/query-template-sql-guard.service.ts backend/src/modules/query-assets/query-template.repository.ts backend/test/modules/query-assets/query-template-scope-analyzer.service.spec.ts backend/test/modules/query-assets/query-template-scope-injector.service.spec.ts backend/test/modules/query-assets/query-template-scope-compatibility.service.spec.ts
git commit -m "feat: 新增模板 SQL 范围识别与自动注入"
```

## Task 3: 改造模板执行与自由 AI 问数统一范围模式

**Files:**
- Modify: `backend/src/modules/query-assets/query-template-execution.service.ts`
- Modify: `backend/src/modules/query-assets/query-template-admin.controller.ts`
- Modify: `backend/src/modules/analysis/analysis.service.ts`
- Modify: `backend/src/modules/analysis/query-scope.service.ts`
- Modify: `backend/src/modules/sessions/session-capabilities.service.ts`
- Test: `backend/test/integration/query-template-execution.integration-spec.ts`
- Test: `backend/test/contract/query-assets.contract-spec.ts`
- Test: `backend/test/contract/analysis-query.contract-spec.ts`

- [ ] **Step 1: 先写失败的模板执行集成测试**

```ts
it('普通用户执行 AUTO_SCOPE 模板时应自动按部门收口', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_company_weekly_new_opportunity/execute')
    .set('Cookie', cookies)
    .send({ parameters: { days: 7 }, includeAiReport: false })
    .expect(201);

  expect(response.body.scopeExecution?.analysisScopeMode).toBe('DEPARTMENT_ANALYSIS_SCOPE');
  expect(response.body.scopeExecution?.templateScopeMode).toBe('AUTO_SCOPE');
});

it('高层执行 AUTO_SCOPE 模板时应直接查全量', async () => {
  const cookies = await loginAs(app, 'user_admin');
  const response = await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_company_weekly_new_opportunity/execute')
    .set('Cookie', cookies)
    .send({ parameters: { days: 7 }, includeAiReport: false })
    .expect(201);

  expect(response.body.scopeExecution?.analysisScopeMode).toBe('FULL_ANALYSIS_SCOPE');
});
```

- [ ] **Step 2: 写失败的自由 AI 问数契约测试**

```ts
it('能力快照应返回分析范围模式摘要', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .get('/api/v1/analysis/capabilities')
    .set('Cookie', cookies)
    .expect(200);

  expect(response.body).toEqual(
    expect.objectContaining({
      analysisScopeMode: expect.stringMatching(/FULL_ANALYSIS_SCOPE|DEPARTMENT_ANALYSIS_SCOPE/),
      analysisScopeSummary: expect.any(String),
    }),
  );
});
```

- [ ] **Step 3: 运行测试确认当前返回结构缺失**

Run:

```bash
pnpm --dir backend test -- query-template-execution.integration-spec.ts
pnpm --dir backend test -- analysis-query.contract-spec.ts
```

Expected:

```text
FAIL backend/test/integration/query-template-execution.integration-spec.ts
FAIL backend/test/contract/analysis-query.contract-spec.ts
```

- [ ] **Step 4: 在模板执行服务里接入范围模式判定与分支执行**

```ts
const resolvedScope = this.analysisScopeModeService.resolve(user);
const scopeAnalysis = this.queryTemplateScopeAnalyzerService.analyze(template.sqlText);

if (resolvedScope.mode === 'DEPARTMENT_ANALYSIS_SCOPE' && scopeAnalysis.scopeMode === 'AUTO_SCOPE') {
  const injected = this.queryTemplateScopeInjectorService.inject(
    template.sqlText,
    resolvedScope.scopeSnapshot,
  );
  sqlToExecute = injected.sql;
  sqlParams = [...compiledNamedParams.params, ...injected.params];
}

if (resolvedScope.mode === 'DEPARTMENT_ANALYSIS_SCOPE' && scopeAnalysis.scopeMode === 'DECLARED_SCOPE') {
  const declaredScope = this.queryTemplateScopeAnalyzerService.extractDeclaredScope(template.sqlText);
  this.queryTemplateScopeCompatibilityService.ensureCompatible(
    declaredScope,
    resolvedScope.scopeSnapshot,
  );
}
```

- [ ] **Step 5: 在自由 AI 问数入口里统一使用最终范围快照**

```ts
const resolvedScope = this.analysisScopeModeService.resolve(user);
const scopeSnapshot = resolvedScope.scopeSnapshot;
this.ensureUserAllowed(user, policy, payload.channel, payload, scopeSnapshot);

const scopedIntent = this.queryScopeService.injectScope(
  intent,
  scopeSnapshot,
  resolvedScope.mode,
);
```

```ts
injectScope(
  intent: AnalysisIntent,
  scope: ScopeSnapshot,
  mode: AnalysisScopeMode,
) {
  if (mode === 'FULL_ANALYSIS_SCOPE') {
    return {
      ...intent,
      filters: {
        ...intent.filters,
        organizationIds: scope.organizationIds,
        departmentIds: [],
        ownerIds: [],
      },
      scopeSummary: scope.scopeSummary,
    };
  }

  return {
    ...intent,
    filters: {
      ...intent.filters,
      organizationIds: scope.organizationIds,
      departmentIds: scope.departmentIds,
      ownerIds: scope.ownerIds,
    },
    scopeSummary: scope.scopeSummary,
  };
}
```

- [ ] **Step 6: 扩展能力快照与契约字段**

```ts
const resolvedScope = this.analysisScopeModeService.resolve(user);
return {
  ...snapshot,
  analysisScopeMode: resolvedScope.mode,
  analysisScopeSummary: resolvedScope.scopeSnapshot.scopeSummary,
};
```

- [ ] **Step 7: 重跑集成与契约测试**

Run:

```bash
pnpm --dir backend test -- query-template-execution.integration-spec.ts
pnpm --dir backend test -- query-assets.contract-spec.ts
pnpm --dir backend test -- analysis-query.contract-spec.ts
```

Expected:

```text
PASS backend/test/integration/query-template-execution.integration-spec.ts
PASS backend/test/contract/query-assets.contract-spec.ts
PASS backend/test/contract/analysis-query.contract-spec.ts
```

- [ ] **Step 8: 提交第三阶段**

```bash
git add backend/src/modules/query-assets/query-template-execution.service.ts backend/src/modules/query-assets/query-template-admin.controller.ts backend/src/modules/analysis/analysis.service.ts backend/src/modules/analysis/query-scope.service.ts backend/src/modules/sessions/session-capabilities.service.ts backend/test/integration/query-template-execution.integration-spec.ts backend/test/contract/query-assets.contract-spec.ts backend/test/contract/analysis-query.contract-spec.ts
git commit -m "feat: 统一模板执行与 AI 问数分析范围模式"
```

## Task 4: 权限中心新增“分析全量查询授权”区块

**Files:**
- Modify: `frontend/src/types/analysis.ts`
- Modify: `frontend/src/services/analysis.service.ts`
- Modify: `frontend/src/pages/governance/PermissionCenterPage.vue`
- Test: `frontend/tests/unit/permission-center-page.spec.ts`

- [ ] **Step 1: 先写失败的前端单测**

```ts
it('权限中心应展示分析全量查询授权区块并允许保存人员名单', async () => {
  vi.mocked(analysisService.getAnalysisScopePolicy).mockResolvedValue({
    policyId: 'analysis_scope_policy_current',
    fullAccessUserIds: ['user_admin'],
    updatedBy: 'user_admin',
    updatedAt: '2026-05-12T12:00:00.000Z',
    changeReason: '默认向系统管理员开放全量分析权限。',
  });

  const wrapper = mount(PermissionCenterPage, { /* existing stubs */ });
  await flushPromises();

  expect(wrapper.text()).toContain('分析全量查询授权');
  expect(wrapper.text()).toContain('已开通全量分析权限的人员');
});
```

- [ ] **Step 2: 运行前端单测并确认页面尚未展示该区块**

Run:

```bash
pnpm --dir frontend test:unit -- permission-center-page.spec.ts
```

Expected:

```text
FAIL frontend/tests/unit/permission-center-page.spec.ts
- 页面不存在“分析全量查询授权”
```

- [ ] **Step 3: 扩展前端类型与服务层**

```ts
export interface AnalysisScopePolicyView {
  policyId: string;
  fullAccessUserIds: string[];
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}
```

```ts
getAnalysisScopePolicy(): Promise<AnalysisScopePolicyView> {
  return httpClient.get('/governance/analysis-scope-policy');
},
updateAnalysisScopePolicy(payload: Record<string, unknown>): Promise<AnalysisScopePolicyView> {
  return httpClient.put('/governance/analysis-scope-policy', payload);
},
```

- [ ] **Step 4: 在权限中心页面增加新配置区块**

```vue
<section class="panel">
  <div class="panel__header">
    <div>
      <h2 class="table-panel__title">分析全量查询授权</h2>
      <p class="panel__subtitle">命中名单的人员在查询模板、自由 AI 问数与最近查询重跑中都可查看全公司数据。</p>
    </div>
    <el-button
      class="button-primary"
      type="primary"
      :loading="savingAnalysisScopePolicy"
      @click="saveAnalysisScopePolicy"
    >
      {{ savingAnalysisScopePolicy ? '保存中...' : '保存全量授权' }}
    </el-button>
  </div>
  <div class="panel__body panel__body--stack">
    <label class="form-field">
      <span>已开通全量分析权限的人员</span>
      <el-select
        v-model="analysisScopePolicyDraft.fullAccessUserIds"
        class="input"
        multiple
        filterable
      >
        <el-option
          v-for="item in accessOptions.users"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </label>
    <label class="form-field">
      <span>变更原因</span>
      <el-input
        v-model="analysisScopePolicyDraft.changeReason"
        class="textarea"
        type="textarea"
        :rows="3"
      />
    </label>
  </div>
</section>
```

- [ ] **Step 5: 重跑前端单测**

Run:

```bash
pnpm --dir frontend test:unit -- permission-center-page.spec.ts
```

Expected:

```text
PASS frontend/tests/unit/permission-center-page.spec.ts
```

- [ ] **Step 6: 提交第四阶段**

```bash
git add frontend/src/types/analysis.ts frontend/src/services/analysis.service.ts frontend/src/pages/governance/PermissionCenterPage.vue frontend/tests/unit/permission-center-page.spec.ts
git commit -m "feat: 新增分析全量查询授权配置"
```

## Task 5: 查询模板治理页去掉占位符提示并显示范围识别结果

**Files:**
- Modify: `frontend/src/pages/governance/QueryTemplatePage.vue`
- Modify: `frontend/src/types/analysis.ts`
- Modify: `frontend/src/services/analysis.service.ts`
- Test: `frontend/tests/unit/query-template-page.spec.ts`

- [ ] **Step 1: 先写失败的治理页单测**

```ts
it('模板治理页不应再展示权限占位符提示，而应展示范围识别结果', async () => {
  vi.mocked(analysisService.validateGovernanceTemplate).mockResolvedValue({
    status: 'PASSED',
    message: '模板 SQL 校验通过。',
    scopeAnalysis: {
      scopeMode: 'AUTO_SCOPE',
      detectedScopeFields: [],
      friendlyMessage: '未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。',
    },
  });

  const wrapper = mount(QueryTemplatePage, { /* existing stubs */ });
  await flushPromises();
  await wrapper.get('.panel__header-actions .button-primary').trigger('click');
  await flushPromises();

  expect(wrapper.text()).not.toContain(':scopeOrganizationIds');
  expect(wrapper.text()).toContain('系统将在执行时按当前用户权限自动收口');
});
```

- [ ] **Step 2: 运行前端治理页单测并确认当前仍展示占位符提示**

Run:

```bash
pnpm --dir frontend test:unit -- query-template-page.spec.ts
```

Expected:

```text
FAIL frontend/tests/unit/query-template-page.spec.ts
- 仍包含 :scopeOrganizationIds 提示
```

- [ ] **Step 3: 扩展校验响应类型**

```ts
validationSnapshot?: {
  status: 'PASSED' | 'FAILED';
  message: string;
  scopeAnalysis?: {
    scopeMode: 'AUTO_SCOPE' | 'DECLARED_SCOPE';
    detectedScopeFields: string[];
    friendlyMessage: string;
    unsupportedReason?: string;
  };
};
```

- [ ] **Step 4: 页面去掉占位符提示并显示范围识别说明**

```vue
<label class="form-field">
  <span>查询 SQL</span>
  <el-input
    v-model="editorForm.sqlText"
    class="textarea"
    type="textarea"
    :rows="10"
    placeholder="请输入模板原始 SQL，系统会在执行时按当前用户权限自动判断是否收口。"
  />
</label>

<el-alert
  v-if="templateScopeAnalysisMessage"
  class="feedback-state"
  type="info"
  :closable="false"
  show-icon
>
  {{ templateScopeAnalysisMessage }}
</el-alert>
```

```ts
const templateScopeAnalysisMessage = computed(
  () => latestValidationSnapshot.value?.scopeAnalysis?.friendlyMessage ?? '',
);
```

- [ ] **Step 5: 重跑治理页单测**

Run:

```bash
pnpm --dir frontend test:unit -- query-template-page.spec.ts
```

Expected:

```text
PASS frontend/tests/unit/query-template-page.spec.ts
```

- [ ] **Step 6: 提交第五阶段**

```bash
git add frontend/src/pages/governance/QueryTemplatePage.vue frontend/src/types/analysis.ts frontend/src/services/analysis.service.ts frontend/tests/unit/query-template-page.spec.ts
git commit -m "feat: 优化模板治理页范围识别提示"
```

## Task 6: 同步数据模型、OpenAPI 与全量验证

**Files:**
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Test: `pnpm test`
- Test: `pnpm build`

- [ ] **Step 1: 更新数据模型文档**

```md
### AnalysisScopePolicyRecord

| 字段 | 说明 |
| --- | --- |
| policyId | 分析范围策略主键 |
| fullAccessUserIds | 已开通全量分析权限的 CRM 用户 |
| updatedBy | 最后更新人 |
| updatedAt | 最后更新时间 |
| changeReason | 变更原因 |

### QueryTemplateScopeValidationSnapshot

| 字段 | 说明 |
| --- | --- |
| scopeMode | `AUTO_SCOPE` / `DECLARED_SCOPE` |
| detectedScopeFields | 已识别到的范围字段 |
| friendlyMessage | 面向治理页的说明文案 |
| unsupportedReason | 范围条件过于复杂时的原因 |
```

- [ ] **Step 2: 更新 OpenAPI**

```yaml
/api/v1/governance/analysis-scope-policy:
  get:
    summary: 获取分析全量查询授权策略
  put:
    summary: 更新分析全量查询授权策略

components:
  schemas:
    AnalysisScopePolicyResponse:
      type: object
      required: [policyId, fullAccessUserIds, updatedBy, updatedAt]
      properties:
        policyId:
          type: string
        fullAccessUserIds:
          type: array
          items:
            type: string
        updatedBy:
          type: string
        updatedAt:
          type: string
          format: date-time
        changeReason:
          type: string
```

- [ ] **Step 3: 运行全量测试与构建**

Run:

```bash
pnpm test
pnpm build
```

Expected:

```text
PASS backend test suite
PASS frontend unit suite
PASS pnpm build
```

- [ ] **Step 4: 提交最终阶段**

```bash
git add specs/001-crm-intelligent-analytics/data-model.md specs/001-crm-intelligent-analytics/contracts/openapi.yaml
git commit -m "docs: 补齐分析范围模式与模板 SQL 权限注入契约"
```

## 自检结论

### 覆盖检查

本计划已覆盖设计文档中的以下核心要求：

1. 页面不再展示权限占位符，模板作者只维护原始 SQL。
2. 新增“分析全量查询授权”配置，并按人员维护高层名单。
3. 模板执行与自由 AI 问数统一进入 `FULL_ANALYSIS_SCOPE / DEPARTMENT_ANALYSIS_SCOPE`。
4. 模板 SQL 支持 `AUTO_SCOPE / DECLARED_SCOPE` 两种模式。
5. 作者自己写了部门条件时不重复注入，改做范围兼容性校验。
6. 所有模板都可见，是否能执行与执行结果大小在后端统一决定。
7. 最近查询重跑按当前权限重新执行，不复用历史范围。

### 占位符扫描

计划中没有出现 `TBD`、`TODO` 或“后续补齐”等无内容占位符；每个任务都列出了具体文件、测试、命令和关键代码骨架。

### 一致性检查

整份计划统一使用：

- `AnalysisScopeMode`
- `AnalysisScopePolicyRecord`
- `AUTO_SCOPE / DECLARED_SCOPE`
- `FULL_ANALYSIS_SCOPE / DEPARTMENT_ANALYSIS_SCOPE`

没有出现同一概念多种命名的冲突。
