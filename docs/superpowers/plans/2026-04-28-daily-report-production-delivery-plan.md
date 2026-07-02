# 日报生产发送 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地销售日报生产发送链路，使系统默认按企业微信组织架构解析销售小组与区域负责人，并允许后台配置部门启停、收件人覆盖和发送预览。

**Architecture:** 在现有 `daily-report` 模块上新增“部门启停 + 收件规则”核心模型与解析服务；在现有 `governance` 后台上挂接配置与预览接口；最后把 `runReminderSweep`、`runSummarySweep` 与前端权限中心页面改为消费新的解析结果，而不是继续依赖 `ownerIds + supervisorId` 的简化判断。

**Tech Stack:** NestJS、TypeScript、Zod、Element Plus、Vue 3、Vitest、Playwright、Supertest、应用内存态 `AppStorageService`

---

### Task 1: 扩展日报发送策略模型与持久化仓储

**Files:**
- Create: `backend/src/modules/daily-report/daily-report-delivery-policy.repository.ts`
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `backend/src/shared/mock/sample-data.ts`
- Modify: `backend/src/modules/daily-report/daily-report.module.ts`
- Modify: `frontend/src/types/analysis.ts`
- Test: `backend/test/modules/daily-report/daily-report-delivery-policy.repository.spec.ts`

- [ ] **Step 1: 先写失败的仓储单测，定义最小数据模型边界**

```ts
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { DailyReportDeliveryPolicyRepository } from '../../../src/modules/daily-report/daily-report-delivery-policy.repository';

describe('DailyReportDeliveryPolicyRepository', () => {
  it('保存并更新部门日报策略与收件人覆盖', () => {
    const appStorage = {
      state: createDefaultAppStorageState(),
      persist: vi.fn(),
    };
    const repository = new DailyReportDeliveryPolicyRepository(appStorage as never);

    repository.saveDepartmentPolicy({
      departmentId: 'dept_sd_sales',
      departmentName: '山东销售',
      status: 'ENABLED',
      departmentType: 'SALES',
      applyToChildren: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-04-28T10:00:00.000Z',
      reason: '销售团队默认启用日报',
    });

    repository.saveRecipientOverride({
      departmentId: 'dept_sd_region',
      departmentName: '山东区',
      scopeType: 'REGION',
      crmUserId: '2224755',
      recipientName: '牛劲',
      updatedBy: 'user_admin',
      updatedAt: '2026-04-28T10:05:00.000Z',
      reason: '区域负责人承接销售组汇总',
    });

    expect(repository.listDepartmentPolicies()).toEqual([
      expect.objectContaining({
        departmentId: 'dept_sd_sales',
        status: 'ENABLED',
      }),
    ]);
    expect(repository.listRecipientOverrides()).toEqual([
      expect.objectContaining({
        departmentId: 'dept_sd_region',
        crmUserId: '2224755',
      }),
    ]);
    expect(appStorage.persist).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑单测确认当前仓库没有这些类型和仓储**

Run:

```bash
pnpm --dir backend test -- daily-report-delivery-policy.repository.spec.ts
```

Expected: FAIL，提示 `DailyReportDeliveryPolicyRepository` 或新增策略类型不存在。

- [ ] **Step 3: 增加后端/前端共享类型，并创建日报发送策略仓储**

```ts
// backend/src/shared/types/domain.ts
export type DailyReportDepartmentPolicyStatus = 'ENABLED' | 'DISABLED' | 'INHERIT';
export type DailyReportDepartmentType = 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
export type DailyReportRecipientOverrideScopeType = 'REGION' | 'SALES_GROUP';

export interface DailyReportDepartmentPolicyRecord {
  departmentId: string;
  departmentName: string;
  status: DailyReportDepartmentPolicyStatus;
  departmentType: DailyReportDepartmentType;
  applyToChildren: boolean;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface DailyReportRecipientOverrideRecord {
  departmentId: string;
  departmentName: string;
  scopeType: DailyReportRecipientOverrideScopeType;
  crmUserId: string;
  recipientName?: string;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface DailyReportResolvedRecipientRecord {
  crmUserId?: string;
  recipientName?: string;
  wecomUserId?: string;
  resolutionStatus: 'READY' | 'MISSING_OWNER' | 'MISSING_WECom_MAPPING';
  resolutionReason?: string;
  source: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE';
}

// AppStorageState 新增
dailyReportDepartmentPolicies: DailyReportDepartmentPolicyRecord[];
dailyReportRecipientOverrides: DailyReportRecipientOverrideRecord[];
```

```ts
// backend/src/modules/daily-report/daily-report-delivery-policy.repository.ts
@Injectable()
export class DailyReportDeliveryPolicyRepository {
  constructor(@Inject(AppStorageService) private readonly appStorage: AppStorageService) {}

  listDepartmentPolicies(): DailyReportDepartmentPolicyRecord[] {
    return [...this.appStorage.state.dailyReportDepartmentPolicies];
  }

  saveDepartmentPolicy(record: DailyReportDepartmentPolicyRecord): DailyReportDepartmentPolicyRecord {
    const index = this.appStorage.state.dailyReportDepartmentPolicies.findIndex(
      (item) => item.departmentId === record.departmentId,
    );
    if (index >= 0) {
      this.appStorage.state.dailyReportDepartmentPolicies[index] = record;
    } else {
      this.appStorage.state.dailyReportDepartmentPolicies.unshift(record);
    }
    this.appStorage.persist();
    return record;
  }

  listRecipientOverrides(): DailyReportRecipientOverrideRecord[] {
    return [...this.appStorage.state.dailyReportRecipientOverrides];
  }

  saveRecipientOverride(record: DailyReportRecipientOverrideRecord): DailyReportRecipientOverrideRecord {
    const index = this.appStorage.state.dailyReportRecipientOverrides.findIndex(
      (item) => item.departmentId === record.departmentId && item.scopeType === record.scopeType,
    );
    if (index >= 0) {
      this.appStorage.state.dailyReportRecipientOverrides[index] = record;
    } else {
      this.appStorage.state.dailyReportRecipientOverrides.unshift(record);
    }
    this.appStorage.persist();
    return record;
  }
}
```

```ts
// frontend/src/types/analysis.ts
export interface DailyReportDepartmentPolicyItem {
  departmentId: string;
  departmentName: string;
  parentDepartmentId?: string;
  status: 'ENABLED' | 'DISABLED' | 'INHERIT';
  departmentType: 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
  applyToChildren: boolean;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}
```

- [ ] **Step 4: 回跑仓储单测，确认模型和持久化边界稳定**

Run:

```bash
pnpm --dir backend test -- daily-report-delivery-policy.repository.spec.ts
```

Expected: PASS，仓储可保存、更新并调用 `persist`。

- [ ] **Step 5: 提交这一层基础模型改动**

```bash
git add backend/src/shared/types/domain.ts backend/src/shared/mock/sample-data.ts backend/src/modules/daily-report/daily-report-delivery-policy.repository.ts backend/src/modules/daily-report/daily-report.module.ts frontend/src/types/analysis.ts backend/test/modules/daily-report/daily-report-delivery-policy.repository.spec.ts
git commit -m "feat-20260428:新增日报发送策略基础模型"
```

### Task 2: 实现销售小组识别与默认收件人解析服务

**Files:**
- Create: `backend/src/modules/daily-report/daily-report-delivery-routing.service.ts`
- Modify: `backend/src/modules/daily-report/daily-report.module.ts`
- Modify: `backend/src/modules/daily-report/sales-leader-mapping.service.ts`
- Test: `backend/test/modules/daily-report/daily-report-delivery-routing.service.spec.ts`

- [ ] **Step 1: 先写失败的解析服务单测，固定 `山东销售 -> 牛劲` 这条主规则**

```ts
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { DailyReportDeliveryRoutingService } from '../../../src/modules/daily-report/daily-report-delivery-routing.service';

describe('DailyReportDeliveryRoutingService', () => {
  it('按区域负责人自动解析销售小组收件人，并排除非销售部门', async () => {
    const state = createDefaultAppStorageState();
    state.wecomSyncedDepartments = [
      { wxDepartmentId: 'dept_sd_region', departmentName: '山东区', parentDepartmentId: 'dept_north', order: 1, leaderUserids: ['NiuJin'], createdAt: '2026-04-28T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' },
      { wxDepartmentId: 'dept_sd_sales', departmentName: '山东销售', parentDepartmentId: 'dept_sd_region', order: 1, leaderUserids: [], createdAt: '2026-04-28T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' },
      { wxDepartmentId: 'dept_sd_tech', departmentName: '山东技术团队', parentDepartmentId: 'dept_sd_region', order: 2, leaderUserids: [], createdAt: '2026-04-28T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' },
    ];
    state.wecomSyncedUsers = [
      { wxUserid: 'NiuJin', name: '牛劲', departmentIds: ['dept_sd_region'], directLeaderUserids: [], syncStatus: 'ACTIVE', updatedAt: '2026-04-28T09:00:00.000Z', createdAt: '2026-04-28T09:00:00.000Z' },
      { wxUserid: 'sales_a', name: '陈一鸣', departmentIds: ['dept_sd_sales'], directLeaderUserids: ['NiuJin'], syncStatus: 'ACTIVE', updatedAt: '2026-04-28T09:00:00.000Z', createdAt: '2026-04-28T09:00:00.000Z' },
    ];
    state.crmWxUsers.push({ id: 'wx_niujin', wxOrganizationId: 'wx_org_mock', userid: 'NiuJin', originUserid: 'NiuJin', name: '牛劲', departmentIds: ['dept_sd_region'], createdAt: '2026-04-28T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' });
    state.crmWxUserMaps.push({ id: 'map_niujin', wxOrganizationId: 'wx_org_mock', wxUserId: 'wx_niujin', crmUserId: '2224755', createdAt: '2026-04-28T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' });

    const service = buildRoutingService(state);
    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual([
      expect.objectContaining({
        groupDepartmentId: 'dept_sd_sales',
        groupDepartmentName: '山东销售',
        resolvedRecipient: expect.objectContaining({
          crmUserId: '2224755',
          recipientName: '牛劲',
          source: 'AUTO',
        }),
      }),
    ]);
    expect(groups.find((item) => item.groupDepartmentId === 'dept_sd_tech')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑解析服务单测确认当前服务不存在**

Run:

```bash
pnpm --dir backend test -- daily-report-delivery-routing.service.spec.ts
```

Expected: FAIL，提示 `DailyReportDeliveryRoutingService` 不存在或缺少 `listResolvedSalesGroups`。

- [ ] **Step 3: 实现日报发送路由服务，统一负责部门分类、继承与收件人解析**

```ts
// backend/src/modules/daily-report/daily-report-delivery-routing.service.ts
@Injectable()
export class DailyReportDeliveryRoutingService {
  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly organizationScopeService: OrganizationScopeService,
    private readonly policyRepository: DailyReportDeliveryPolicyRepository,
    @Inject(AppStorageService) private readonly appStorage: AppStorageService,
  ) {}

  async listResolvedSalesGroups(): Promise<Array<{
    groupDepartmentId: string;
    groupDepartmentName: string;
    regionDepartmentId?: string;
    regionDepartmentName?: string;
    effectivePolicy: DailyReportDepartmentPolicyStatus;
    resolvedRecipient: DailyReportResolvedRecipientRecord;
    memberCrmUserIds: string[];
    blockedReason?: string;
  }>> {
    const departments = this.appStorage.state.wecomSyncedDepartments;
    const policies = new Map(
      this.policyRepository.listDepartmentPolicies().map((item) => [item.departmentId, item] as const),
    );
    const overrides = this.policyRepository.listRecipientOverrides();

    return await Promise.all(
      departments
        .filter((item) => this.classifyDepartmentType(item.departmentName, policies.get(item.wxDepartmentId)) === 'SALES')
        .map(async (department) => {
          const effectivePolicy = this.resolveEffectivePolicy(department.wxDepartmentId, policies);
          const region = departments.find((item) => item.wxDepartmentId === department.parentDepartmentId);
          const resolvedRecipient = await this.resolveRecipientForDepartment({
            salesDepartmentId: department.wxDepartmentId,
            regionDepartmentId: region?.wxDepartmentId,
            regionLeaderUserids: region?.leaderUserids ?? [],
            overrides,
          });

          return {
            groupDepartmentId: department.wxDepartmentId,
            groupDepartmentName: department.departmentName,
            regionDepartmentId: region?.wxDepartmentId,
            regionDepartmentName: region?.departmentName,
            effectivePolicy,
            resolvedRecipient,
            memberCrmUserIds: this.resolveDepartmentMemberCrmUserIds(department.wxDepartmentId),
            blockedReason: effectivePolicy === 'DISABLED' ? '该销售小组已被停用。' : resolvedRecipient.resolutionReason,
          };
        }),
    );
  }
}
```

- [ ] **Step 4: 回跑解析服务单测，确认自动规则与排除规则都已生效**

Run:

```bash
pnpm --dir backend test -- daily-report-delivery-routing.service.spec.ts
```

Expected: PASS，`山东销售` 命中 `牛劲`，`山东技术团队` 被排除。

- [ ] **Step 5: 提交日报发送路由服务**

```bash
git add backend/src/modules/daily-report/daily-report-delivery-routing.service.ts backend/src/modules/daily-report/daily-report.module.ts backend/src/modules/daily-report/sales-leader-mapping.service.ts backend/test/modules/daily-report/daily-report-delivery-routing.service.spec.ts
git commit -m "feat-20260428:新增日报发送路由解析服务"
```

### Task 3: 重构日报运行时，按销售小组启停和收件规则执行 22:00 / 08:00 链路

**Files:**
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `backend/src/modules/daily-report/daily-report.service.ts`
- Modify: `backend/src/modules/daily-report/daily-report-dispatcher.service.ts`
- Modify: `backend/src/modules/daily-report/daily-report.repository.ts`
- Test: `backend/test/integration/daily-report.integration-spec.ts`

- [ ] **Step 1: 先补失败的日报集成测试，锁定“只发启用销售组、保留真实收件目标”的行为**

```ts
it('次日 08:00 只为启用销售小组生成汇总，并保留真实目标收件人', async () => {
  await arrangeShandongDepartments(app);
  await enableDailyReportForSalesOnly(app);
  await seedFollowUpForSalesMember(app, { crmUserId: 'user_sales_director', businessDate: '2026-04-27' });

  const response = await request(app.getHttpServer())
    .post('/api/v1/daily-reports/cron/summaries')
    .set('x-test-user', 'user_admin')
    .send({ businessDate: '2026-04-27', generatedAt: '2026-04-28T08:00:00.000Z' })
    .expect(200);

  expect(response.body.groupSummaries).toEqual([
    expect.objectContaining({
      groupDepartmentName: '山东销售',
      recipientName: '牛劲',
      ruleSource: 'REGION_OVERRIDE',
    }),
  ]);
  expect(response.body.groupSummaries.find((item: { groupDepartmentName: string }) => item.groupDepartmentName === '山东技术团队')).toBeUndefined();
});
```

- [ ] **Step 2: 跑日报集成测试，确认当前实现仍然按 `supervisorId` 和测试改投逻辑工作**

Run:

```bash
pnpm --dir backend test -- daily-report.integration-spec.ts
```

Expected: FAIL，当前 `summaryBatch` 结构中不存在 `groupSummaries`，且团队汇总仍按旧的 `recipientIds + testReceiver` 合并逻辑工作。

- [ ] **Step 3: 在 `DailyReportService` 和 `DailyReportDispatcherService` 中接入新的销售组解析结果**

```ts
// backend/src/shared/types/domain.ts
export interface DailyReportSummaryGroupRecord {
  groupDepartmentId: string;
  groupDepartmentName: string;
  regionDepartmentId?: string;
  regionDepartmentName?: string;
  recipientCrmUserId?: string;
  recipientName?: string;
  recipientWecomUserId?: string;
  ruleSource: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE';
  deliveryStatus: 'READY' | 'BLOCKED' | 'SENT' | 'FAILED';
  deliveryReason?: string;
  memberRequesterIds: string[];
  memberCount: number;
  summaryText: string;
}

export interface DailyReportSummaryBatchRecord {
  // 保留现有字段
  groupSummaries: DailyReportSummaryGroupRecord[];
}
```

```ts
// backend/src/modules/daily-report/daily-report.service.ts
private async resolveReminderTargets(user: CrmUser): Promise<CrmUser[]> {
  const groups = await this.dailyReportDeliveryRoutingService.listResolvedSalesGroups();
  const enabledMemberIds = new Set(
    groups
      .filter((item) => item.effectivePolicy !== 'DISABLED')
      .flatMap((item) => item.memberCrmUserIds),
  );

  if (!user.isAdmin) {
    return enabledMemberIds.has(user.id)
      ? [user]
      : [];
  }

  const users = await this.crmReadonlyService.listDailyReportUsers();
  return users.filter((item) => enabledMemberIds.has(item.id));
}

async runSummarySweep(...) {
  const groups = await this.dailyReportDeliveryRoutingService.listResolvedSalesGroups();
  const enabledGroups = groups.filter((item) => item.effectivePolicy !== 'DISABLED');
  const groupSummaries = await Promise.all(enabledGroups.map(async (group) => {
    const memberSnapshots = await this.collectSummaryMemberSnapshotsByRequesterIds(
      user,
      normalizedDate,
      generatedAt,
      group.memberCrmUserIds,
    );
    return {
      groupDepartmentId: group.groupDepartmentId,
      groupDepartmentName: group.groupDepartmentName,
      recipientCrmUserId: group.resolvedRecipient.crmUserId,
      recipientName: group.resolvedRecipient.recipientName,
      ruleSource: group.resolvedRecipient.source,
      deliveryStatus: group.resolvedRecipient.resolutionStatus === 'READY' ? 'READY' : 'BLOCKED',
      deliveryReason: group.blockedReason,
      memberRequesterIds: memberSnapshots.map((item) => item.requesterId),
      memberCount: memberSnapshots.length,
      summaryText: await this.buildTeamSummaryMessage(
        { id: group.resolvedRecipient.crmUserId ?? 'unknown', name: group.resolvedRecipient.recipientName ?? '未配置收件人', roleIds: [], roleNames: [], organizationIds: [], departmentIds: [], ownerIds: [], isAdmin: false, exportAllowed: false, channels: ['web-console'] },
        memberSnapshots,
      ),
    };
  }));
}
```

```ts
// backend/src/modules/daily-report/daily-report-dispatcher.service.ts
async dispatchSummaryBatch(batch, recipientSummaries, actor) {
  const deliveries: DailyReportDeliveryRecord[] = [];
  for (const group of batch.groupSummaries) {
    if (group.deliveryStatus === 'BLOCKED') {
      deliveries.push({
        id: buildEntityId('daily_report_summary_delivery'),
        deliveryType: 'SUMMARY_BATCH',
        targetUserId: group.recipientCrmUserId ?? group.groupDepartmentId,
        targetUserName: group.recipientName,
        status: 'FAILED',
        contentPreview: group.summaryText.slice(0, 120),
        failureReason: group.deliveryReason,
      });
      continue;
    }

    const task = await this.proactiveNotificationService.dispatch({
      actor,
      sceneKey: 'daily-report.team-summary',
      title: `${batch.businessDate} 销售组汇总`,
      audience: { type: 'CRM_USER', crmUserIds: [group.recipientCrmUserId!] },
      dedupeKey: `${group.groupDepartmentId}:${batch.businessDate}:team-summary`,
      metadata: {
        suppressActionHints: true,
        dailyReportGroupDepartmentId: group.groupDepartmentId,
        dailyReportRecipientName: group.recipientName,
      },
      message: { msgtype: 'markdown', content: group.summaryText },
    });
    // delivery 继续按单组落记录；真实发送开关关闭时，由通知底座改投测试接收人，但 batch.groupSummaries 仍保留真实目标
  }
}
```

- [ ] **Step 4: 回跑日报集成测试，确认启停规则、组汇总和收件解析一致**

Run:

```bash
pnpm --dir backend test -- daily-report.integration-spec.ts
```

Expected: PASS，新测试通过，旧的 22:00 / 23:59 / 08:00 回归用例仍然通过。

- [ ] **Step 5: 提交日报运行时重构**

```bash
git add backend/src/shared/types/domain.ts backend/src/modules/daily-report/daily-report.service.ts backend/src/modules/daily-report/daily-report-dispatcher.service.ts backend/src/modules/daily-report/daily-report.repository.ts backend/test/integration/daily-report.integration-spec.ts
git commit -m "feat-20260428:接入日报部门启停与组汇总发送规则"
```

### Task 4: 为治理后台补齐日报部门启停、收件规则和发送预览接口

**Files:**
- Modify: `backend/src/modules/governance/access-governance.controller.ts`
- Modify: `backend/src/modules/governance/access-governance.service.ts`
- Modify: `backend/src/modules/governance/access-governance.schema.ts`
- Modify: `backend/src/modules/governance/feature-permission-catalog.ts`
- Test: `backend/test/integration/access-governance.integration-spec.ts`

- [ ] **Step 1: 先写失败的治理集成测试，锁定接口与权限门闩**

```ts
it('允许管理员配置日报部门启停并预览发送结果', async () => {
  await request(app.getHttpServer())
    .put('/api/v1/governance/daily-report-delivery/departments/dept_sd_sales')
    .set('x-test-user', 'user_admin')
    .send({
      status: 'ENABLED',
      departmentType: 'SALES',
      applyToChildren: false,
      overrideRecipientCrmUserId: '2224755',
      reason: '山东销售参与日报汇总',
    })
    .expect(200);

  const listResponse = await request(app.getHttpServer())
    .get('/api/v1/governance/daily-report-delivery/departments')
    .set('x-test-user', 'user_admin')
    .expect(200);

  expect(listResponse.body.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        departmentId: 'dept_sd_sales',
        status: 'ENABLED',
      }),
    ]),
  );

  const previewResponse = await request(app.getHttpServer())
    .post('/api/v1/governance/daily-report-delivery/preview')
    .set('x-test-user', 'user_admin')
    .send({ businessDate: '2026-04-27' })
    .expect(200);

  expect(previewResponse.body.groups).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        groupDepartmentName: '山东销售',
      }),
    ]),
  );
});
```

- [ ] **Step 2: 跑治理集成测试，确认新接口尚未接入**

Run:

```bash
pnpm --dir backend test -- access-governance.integration-spec.ts
```

Expected: FAIL，`/governance/daily-report-delivery/*` 路由不存在。

- [ ] **Step 3: 扩展治理 schema、controller 和 service**

```ts
// backend/src/modules/governance/access-governance.schema.ts
export const updateDailyReportDepartmentPolicySchema = z.object({
  status: z.enum(['ENABLED', 'DISABLED', 'INHERIT']),
  departmentType: z.enum(['REGION', 'SALES', 'NON_SALES', 'UNCLASSIFIED']),
  applyToChildren: z.boolean(),
  overrideRecipientCrmUserId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).max(200),
});

export const dailyReportDeliveryPreviewSchema = z.object({
  businessDate: z.string().trim().min(10),
});
```

```ts
// backend/src/modules/governance/access-governance.controller.ts
@Get('daily-report-delivery/departments')
listDailyReportDepartments(@Req() request: Request & { crmUser: any }) {
  return this.accessGovernanceService.listDailyReportDepartments(request.crmUser);
}

@Put('daily-report-delivery/departments/:departmentId')
updateDailyReportDepartmentPolicy(
  @Req() request: Request & { crmUser: any },
  @Param('departmentId') departmentId: string,
  @Body() body: Record<string, unknown>,
) {
  return this.accessGovernanceService.updateDailyReportDepartmentPolicy(
    request.crmUser,
    departmentId,
    body,
  );
}

@Post('daily-report-delivery/preview')
@HttpCode(200)
previewDailyReportDelivery(
  @Req() request: Request & { crmUser: any },
  @Body() body: Record<string, unknown>,
) {
  return this.accessGovernanceService.previewDailyReportDelivery(request.crmUser, body);
}
```

```ts
// backend/src/modules/governance/access-governance.service.ts
async listDailyReportDepartments(user: CrmUser) {
  this.ensureGovernanceAccess(user);
  return {
    items: await this.dailyReportDeliveryRoutingService.listDepartmentConfigurationTree(),
  };
}

updateDailyReportDepartmentPolicy(user: CrmUser, departmentId: string, payload: unknown) {
  this.ensureGovernanceAccess(user);
  const parsed = updateDailyReportDepartmentPolicySchema.parse(payload);
  const savedPolicy = this.dailyReportDeliveryPolicyRepository.saveDepartmentPolicy({
    departmentId,
    departmentName: this.dailyReportDeliveryRoutingService.resolveDepartmentName(departmentId),
    status: parsed.status,
    departmentType: parsed.departmentType,
    applyToChildren: parsed.applyToChildren,
    updatedBy: user.id,
    updatedAt: new Date().toISOString(),
    reason: parsed.reason,
  });
  if (parsed.overrideRecipientCrmUserId) {
    this.dailyReportDeliveryPolicyRepository.saveRecipientOverride({
      departmentId,
      departmentName: savedPolicy.departmentName,
      scopeType: parsed.departmentType === 'REGION' ? 'REGION' : 'SALES_GROUP',
      crmUserId: parsed.overrideRecipientCrmUserId,
      updatedBy: user.id,
      updatedAt: savedPolicy.updatedAt,
      reason: parsed.reason,
    });
  }
  return savedPolicy;
}
```

- [ ] **Step 4: 回跑治理集成测试，确认管理员可配置、普通用户会被拦截**

Run:

```bash
pnpm --dir backend test -- access-governance.integration-spec.ts
```

Expected: PASS，新接口返回结构稳定，治理访问继续受 `governance.policy.manage` 保护。

- [ ] **Step 5: 提交治理接口改造**

```bash
git add backend/src/modules/governance/access-governance.controller.ts backend/src/modules/governance/access-governance.service.ts backend/src/modules/governance/access-governance.schema.ts backend/src/modules/governance/feature-permission-catalog.ts backend/test/integration/access-governance.integration-spec.ts
git commit -m "feat-20260428:新增日报发送治理接口与预览"
```

### Task 5: 在权限中心页面接入日报部门启停、收件规则和发送预览

**Files:**
- Modify: `frontend/src/services/analysis.service.ts`
- Modify: `frontend/src/types/analysis.ts`
- Modify: `frontend/src/pages/governance/PermissionCenterPage.vue`
- Test: `frontend/tests/unit/permission-center-page.spec.ts`
- Test: `frontend/tests/e2e/element-plus-pages.e2e-spec.ts`

- [ ] **Step 1: 先写失败的前端单测，锁定页面新分区和预览结果展示**

```ts
it('展示日报部门启停与发送预览分区', async () => {
  mockGovernanceApis({
    dailyReportDepartments: {
      items: [
        {
          departmentId: 'dept_sd_sales',
          departmentName: '山东销售',
          parentDepartmentId: 'dept_sd_region',
          status: 'ENABLED',
          departmentType: 'SALES',
          applyToChildren: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '销售类默认启用',
          resolvedRecipientName: '牛劲',
        },
      ],
    },
    dailyReportPreview: {
      groups: [
        {
          groupDepartmentName: '山东销售',
          recipientName: '牛劲',
          deliveryStatus: 'READY',
        },
      ],
    },
  });

  const wrapper = mount(PermissionCenterPage);
  await flushPromises();

  expect(wrapper.text()).toContain('日报部门启用');
  expect(wrapper.text()).toContain('收件规则');
  expect(wrapper.text()).toContain('发送预览');
  expect(wrapper.text()).toContain('山东销售');
  expect(wrapper.text()).toContain('牛劲');
});
```

- [ ] **Step 2: 跑权限中心单测，确认页面还没有新增分区和接口调用**

Run:

```bash
pnpm --dir frontend test -- permission-center-page.spec.ts
```

Expected: FAIL，当前页面仅有角色权限、灰度、数据范围和映射诊断分区。

- [ ] **Step 3: 扩展前端服务与页面状态，挂接部门启停表、收件规则表和发送预览卡片**

```ts
// frontend/src/services/analysis.service.ts
listDailyReportDeliveryDepartments(): Promise<{ items: DailyReportDepartmentPolicyItem[] }> {
  return httpClient.get('/governance/daily-report-delivery/departments');
},
updateDailyReportDeliveryDepartment(
  departmentId: string,
  payload: Record<string, unknown>,
): Promise<DailyReportDepartmentPolicyItem> {
  return httpClient.put(`/governance/daily-report-delivery/departments/${departmentId}`, payload);
},
previewDailyReportDelivery(payload: Record<string, unknown>): Promise<DailyReportDeliveryPreviewView> {
  return httpClient.post('/governance/daily-report-delivery/preview', payload);
},
```

```ts
// frontend/src/pages/governance/PermissionCenterPage.vue
const dailyReportDepartments = ref<DailyReportDepartmentPolicyItem[]>([]);
const dailyReportPreview = ref<DailyReportDeliveryPreviewView | null>(null);
const dailyReportDraft = reactive({
  departmentId: '',
  status: 'INHERIT' as DailyReportDepartmentPolicyItem['status'],
  departmentType: 'UNCLASSIFIED' as DailyReportDepartmentPolicyItem['departmentType'],
  applyToChildren: false,
  overrideRecipientCrmUserId: '',
  reason: '',
});

async function loadDailyReportDepartments(): Promise<void> {
  const response = await analysisService.listDailyReportDeliveryDepartments();
  dailyReportDepartments.value = response.items;
}

async function saveDailyReportDepartment(): Promise<void> {
  await analysisService.updateDailyReportDeliveryDepartment(dailyReportDraft.departmentId, {
    status: dailyReportDraft.status,
    departmentType: dailyReportDraft.departmentType,
    applyToChildren: dailyReportDraft.applyToChildren,
    overrideRecipientCrmUserId: dailyReportDraft.overrideRecipientCrmUserId || undefined,
    reason: dailyReportDraft.reason,
  });
  await loadDailyReportDepartments();
}
```

- [ ] **Step 4: 回跑单测和 E2E，确认页面分区、接口联动和文案都稳定**

Run:

```bash
pnpm --dir frontend test -- permission-center-page.spec.ts
pnpm --dir frontend test:e2e -- element-plus-pages.e2e-spec.ts
```

Expected: PASS，权限中心新分区可渲染，Mock API 可返回部门树和发送预览结果。

- [ ] **Step 5: 提交前端治理页改造**

```bash
git add frontend/src/services/analysis.service.ts frontend/src/types/analysis.ts frontend/src/pages/governance/PermissionCenterPage.vue frontend/tests/unit/permission-center-page.spec.ts frontend/tests/e2e/element-plus-pages.e2e-spec.ts
git commit -m "feat-20260428:新增日报发送后台配置与预览页面"
```

### Task 6: 同步 OpenAPI、验收文档与部署说明

**Files:**
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Modify: `specs/001-crm-intelligent-analytics/quickstart.md`
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `docs/architecture/生产部署指南.md`
- Modify: `docs/testing/feature-permission-enforcement-matrix.md`

- [ ] **Step 1: 先写最小文档差异，保证接口、字段和运维口径一致**

```yaml
# specs/001-crm-intelligent-analytics/contracts/openapi.yaml
/api/v1/governance/daily-report-delivery/departments:
  get:
    summary: 获取日报部门启停与收件规则树
/api/v1/governance/daily-report-delivery/departments/{departmentId}:
  put:
    summary: 更新指定部门的日报启停与收件覆盖规则
/api/v1/governance/daily-report-delivery/preview:
  post:
    summary: 预览指定业务日期的日报发送结果
```

```md
<!-- specs/001-crm-intelligent-analytics/quickstart.md -->
### 场景 20B：后台按部门启用日报并预览发送目标

1. 进入权限中心，确认 `山东销售` 已启用，`山东技术团队` 已停用。
2. 为 `山东区` 配置默认收件人 `牛劲`。
3. 执行发送预览，验证 `山东销售 -> 牛劲`，且 `山东技术团队` 不出现在预览结果中。
```

- [ ] **Step 2: 跑一次文档相关检查，确认 YAML 和 Markdown 不存在明显语法错误**

Run:

```bash
pnpm exec prettier --check specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/quickstart.md specs/001-crm-intelligent-analytics/data-model.md docs/architecture/生产部署指南.md docs/testing/feature-permission-enforcement-matrix.md
```

Expected: PASS 或仅出现格式化建议，不应出现语法错误。

- [ ] **Step 3: 完整写入字段说明与部署口径**

```md
<!-- specs/001-crm-intelligent-analytics/data-model.md -->
| dailyReportDepartmentPolicies | 日报部门启停策略 | 是 | 存储部门是否参与日报链路、是否对子部门生效 |
| dailyReportRecipientOverrides | 日报收件人覆盖规则 | 是 | 存储区域或销售小组的覆盖收件人 |
| DailyReportSummaryGroupRecord | 销售小组汇总快照 | 是 | 记录每个销售小组的最终收件人、规则来源、成员数与发送状态 |
```

```md
<!-- docs/architecture/生产部署指南.md -->
- 生产环境必须在 22:00 reminders 和 08:00 summaries 之前先执行企业微信目录同步。
- 当真实发送开关关闭时，规则预览与审计仍保留真实目标收件人，测试改投只影响投递层。
```

- [ ] **Step 4: 再跑一遍格式化检查，确保交付前文档一致**

Run:

```bash
pnpm exec prettier --write specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/quickstart.md specs/001-crm-intelligent-analytics/data-model.md docs/architecture/生产部署指南.md docs/testing/feature-permission-enforcement-matrix.md
```

Expected: PASS，文档被统一格式化。

- [ ] **Step 5: 提交契约与文档同步**

```bash
git add specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/quickstart.md specs/001-crm-intelligent-analytics/data-model.md docs/architecture/生产部署指南.md docs/testing/feature-permission-enforcement-matrix.md
git commit -m "docs-20260428:补充日报生产发送契约与验收口径"
```

### Task 7: 执行最终回归与上线前验证

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-daily-report-production-delivery-design.md`（仅在实现偏离设计稿时回填）
- Test: `backend/test/integration/daily-report.integration-spec.ts`
- Test: `backend/test/integration/access-governance.integration-spec.ts`
- Test: `backend/test/integration/wecom-directory-sync.integration-spec.ts`
- Test: `frontend/tests/unit/permission-center-page.spec.ts`
- Test: `frontend/tests/e2e/element-plus-pages.e2e-spec.ts`

- [ ] **Step 1: 跑后端日报与治理回归**

Run:

```bash
pnpm --dir backend test -- daily-report.integration-spec.ts
pnpm --dir backend test -- access-governance.integration-spec.ts
pnpm --dir backend test -- wecom-directory-sync.integration-spec.ts
```

Expected: PASS，日报、治理与目录同步相关回归全部通过。

- [ ] **Step 2: 跑前端权限中心回归**

Run:

```bash
pnpm --dir frontend test -- permission-center-page.spec.ts
pnpm --dir frontend test:e2e -- element-plus-pages.e2e-spec.ts
```

Expected: PASS，治理页单测与 E2E 通过。

- [ ] **Step 3: 用真实运行时数据做一次人工演练**

```bash
curl -X POST http://localhost:3001/api/v1/governance/daily-report-delivery/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d "{\"businessDate\":\"2026-04-27\"}"
```

Expected: 返回至少一条类似下述结果：

```json
{
  "groups": [
    {
      "groupDepartmentName": "山东销售",
      "recipientName": "牛劲",
      "deliveryStatus": "READY"
    }
  ]
}
```

- [ ] **Step 4: 若实现与设计稿有偏差，先回填设计稿再准备上线**

```md
- 若最终实现把 `区域节点负责人` 改成了 `直属上级负责人链首节点`，必须同步回填设计稿和 quickstart。
- 若最终没有实现“规则预览保留真实收件人”，不得直接上线真实发送。
```

- [ ] **Step 5: 提交最终回归与必要设计回填**

```bash
git add docs/superpowers/specs/2026-04-28-daily-report-production-delivery-design.md
git commit -m "docs-20260428:校准日报生产发送设计与回归结论"
```

## Self-Review

### Spec coverage

- 设计稿中的“默认按企微组织树自动收件”由 Task 2 和 Task 3 覆盖。
- “后台可配置部门启停、区域/销售小组覆盖收件人”由 Task 1、Task 4、Task 5 覆盖。
- “发送预览与异常提示”由 Task 4、Task 5、Task 7 覆盖。
- “22:00 / 08:00 调度与验收口径”由 Task 3、Task 6、Task 7 覆盖。

### Placeholder scan

- 本计划中的新增接口、类型、仓储、测试与命令都给了明确路径和示例。
- 每个新增接口、类型、仓储、测试文件都给了明确路径和示例代码。

### Type consistency

- 后端统一使用 `DailyReportDepartmentPolicyRecord`、`DailyReportRecipientOverrideRecord`、`DailyReportResolvedRecipientRecord`、`DailyReportSummaryGroupRecord`。
- 前端统一使用 `DailyReportDepartmentPolicyItem` 和 `DailyReportDeliveryPreviewView`，避免后续出现字段名分叉。
