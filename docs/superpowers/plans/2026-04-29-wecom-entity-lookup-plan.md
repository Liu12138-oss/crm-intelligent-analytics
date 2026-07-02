# 企业微信客户商机列表与详情查询 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在企业微信机器人中新增 AI-first 的客户/商机列表与详情查询能力，支持直接查询和基于上一轮列表继续查看详情，同时不影响现有问数、跟进、日报、创建与候选确认链路。

**Architecture:** 复用现有 `AI entry intent -> orchestration -> WecomBotService` 主链，在 AI 理解层新增 `ENTITY_LOOKUP` 结构化意图；在会话工作记忆中新增独立的 `entityLookupMemory`；再通过独立的 `WecomEntityLookupService` 统一承接列表查询、唯一命中详情、上一轮列表选择详情、权限收口和回复格式化，避免继续把逻辑堆入 `WecomBotService`。

**Tech Stack:** NestJS、TypeScript、Jest、Supertest、企业微信会话工作记忆 `WecomConversationContextRepository`、现有 CRM 查询服务 `CrmCustomerApiService` / `CrmOpportunityApiService`

---

## 文件结构与职责

### 新增文件

- `backend/src/modules/wecom/wecom-entity-lookup.service.ts`
  - 统一承接企业微信客户/商机列表与详情查询执行。
  - 负责按 AI 输出动作路由为 `LIST | DETAIL | SELECT_FROM_LAST_LIST`。
  - 负责调用客户/商机查询服务，并强制使用“当前用户可跟进范围”。
- `backend/src/modules/wecom/wecom-entity-lookup.helper.ts`
  - 只负责格式化列表回复、详情回复、序号越界提示、列表态失效提示。
  - 避免 `WecomBotService` 再增长一组大段字符串拼接逻辑。
- `backend/test/modules/wecom/wecom-entity-lookup.service.spec.ts`
  - 单测 `WecomEntityLookupService` 的列表、唯一详情、多命中降级、列表态选择详情和异常边界。

### 需要修改的核心文件

- `backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts`
  - 扩展空闲态 AI 输出 schema，新增 `ENTITY_LOOKUP` 和动作字段。
- `backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts`
  - 扩展活跃任务切换目标，允许显式切到 `ENTITY_LOOKUP`。
- `backend/src/modules/analysis/capability-packs/fixtures/wecom-idle-entry.fixtures.ts`
  - 增加列表/详情/上一轮列表选择的 fixture。
- `backend/src/modules/analysis/capability-packs/provider-tuning/qwen.provider.ts`
  - 加入 `ENTITY_LOOKUP` few-shot。
- `backend/src/modules/analysis/ai-gateway.service.ts`
  - 扩展 AI 输出类型定义和统一入口分类的 fallback 结构。
- `backend/src/shared/types/domain.ts`
  - 新增 `WecomEntityLookupMemory`、`WecomEntityLookupListItem` 等类型。
- `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`
  - 新增 `ENTITY_LOOKUP` 决策字段与 `entityLookupMemory` 的更新/清理方法。
- `backend/src/modules/wecom/wecom-bot.service.ts`
  - 接入新的 `ENTITY_LOOKUP` 执行分支。
  - 保证现有跟进、创建、日报活跃任务优先。
- `backend/src/app.module.ts`
  - 注册 `WecomEntityLookupService`。
- `backend/src/modules/wecom/wecom-ai-prompt.config.ts`
  - 更新帮助提示，展示“查客户/查商机/看详情”能力。
- `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`
  - 覆盖 `ENTITY_LOOKUP` 决策和活跃任务不被抢占。
- `backend/test/modules/analysis/wecom-active-task-reply.pack.spec.ts`
  - 覆盖显式任务切换到 `ENTITY_LOOKUP`。
- `backend/test/modules/wecom/wecom-ai-prompt.config.spec.ts`
  - 覆盖帮助提示中新增列表/详情能力。
- `backend/test/integration/wecom-ai-conversation.integration-spec.ts`
  - 覆盖列表、详情、上一轮列表选详情、活跃任务优先、多命中退列表、列表态过期。
- `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
  - 扩展企业微信响应状态枚举。
- `specs/001-crm-intelligent-analytics/quickstart.md`
  - 增加客户/商机列表与详情浏览验收场景。
- `README.md`
  - 更新“企业微信机器人当前支持能力”。

---

### Task 1: 扩展 AI 入口分类与活跃任务切换 schema

**Files:**
- Modify: `backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts`
- Modify: `backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts`
- Modify: `backend/src/modules/analysis/capability-packs/fixtures/wecom-idle-entry.fixtures.ts`
- Modify: `backend/src/modules/analysis/capability-packs/provider-tuning/qwen.provider.ts`
- Modify: `backend/src/modules/analysis/ai-gateway.service.ts`
- Test: `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`
- Test: `backend/test/modules/analysis/wecom-active-task-reply.pack.spec.ts`

- [ ] **Step 1: 先写失败测试，固定 `ENTITY_LOOKUP` 的 AI 输出与显式任务切换**

```ts
// backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts
it('空闲态客户列表查询应优先走统一 AI semantic lane 判断', async () => {
  const service = createService();
  const aiGateway = service['aiGatewayService'] as unknown as {
    classifyWecomIdleConversationIntent: jest.Mock;
  };
  aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
    intent: 'ENTITY_LOOKUP',
    entityLookupAction: 'LIST',
    entityType: 'Customer',
    queryText: '我当前跟进的客户',
    confidence: 'HIGH',
    referenceTarget: 'NONE',
  });

  const decision = await service.decideNextAction(
    {
      turns: [],
      workMemory: {
        metrics: [],
        dimensions: [],
        filters: {},
        pendingSlots: [],
      },
    } as never,
    {
      messageText: '查我当前跟进的客户',
    } as never,
    {
      scopeSummary: '测试权限范围',
    } as never,
  );

  expect(decision.action).toBe('ENTITY_LOOKUP');
  expect(decision.entityLookupAction).toBe('LIST');
  expect(decision.entityLookupEntityType).toBe('Customer');
  expect(decision.entityLookupQueryText).toBe('我当前跟进的客户');
});
```

```ts
// backend/test/modules/analysis/wecom-active-task-reply.pack.spec.ts
it('显式切换去查客户列表时，应允许 TASK_SWITCH 到 ENTITY_LOOKUP', async () => {
  const { wecomActiveTaskReplyPack } = await import(
    '../../../src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack'
  );

  const validation = wecomActiveTaskReplyPack.validate({
    intent: 'TASK_SWITCH',
    target: 'ENTITY_LOOKUP',
  });

  expect(validation).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试，确认当前 schema 还不支持 `ENTITY_LOOKUP`**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts test/modules/analysis/wecom-active-task-reply.pack.spec.ts
```

Expected:
- FAIL，`WecomConversationDecision.action` 里没有 `ENTITY_LOOKUP`
- FAIL，`TASK_SWITCH.target` 的 enum 里没有 `ENTITY_LOOKUP`

- [ ] **Step 3: 最小实现 AI 输出 schema 与编排层动作映射**

```ts
// backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts
type WecomIdleEntryRawOutput = {
  intent?: string;
  helpScene?: string | null;
  dailyReportPrompt?: string | null;
  leaderNameQuery?: string | null;
  lookupText?: string | null;
  entityLookupAction?: string | null;
  entityType?: string | null;
  queryText?: string | null;
  selectionIndex?: number | null;
  referenceTarget?: string | null;
  confidence?: string | null;
};

export interface WecomIdleEntryPackOutput {
  intent:
    | 'HELP_GUIDANCE'
    | 'DAILY_REPORT'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'OPPORTUNITY_LOOKUP'
    | 'ENTITY_LOOKUP'
    | 'EXPLAIN_RESULT'
    | 'FOLLOW_UP_ANALYZE'
    | 'ANALYZE'
    | 'NONE';
  entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityType?: 'Customer' | 'Opportunity' | 'Unknown';
  queryText?: string;
  selectionIndex?: number;
  referenceTarget?: 'LAST_LIST' | 'NONE';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

```ts
// backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts
export interface WecomActiveTaskReplyPackOutput {
  intent:
    | 'HELP_GUIDANCE'
    | 'TASK_CANCEL'
    | 'TASK_SWITCH'
    | 'DIRECT_SUBMIT'
    | 'CONTINUE_EXECUTION'
    | 'MODIFY_CONTENT'
    | 'NONE';
  target?:
    | 'DAILY_REPORT_ENTRY'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'FOLLOW_UP_TEMPLATE'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'ENTITY_LOOKUP';
}
```

```ts
// backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts
export interface WecomConversationDecision {
  action:
    | 'ANALYZE'
    | 'CLARIFICATION_REPLY'
    | 'FOLLOW_UP_ANALYZE'
    | 'EXPLAIN_RESULT'
    | 'DAILY_REPORT'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'OPPORTUNITY_LOOKUP'
    | 'ENTITY_LOOKUP'
    | 'HELP_GUIDANCE';
  entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityLookupEntityType?: 'Customer' | 'Opportunity' | 'Unknown';
  entityLookupQueryText?: string;
  entityLookupSelectionIndex?: number;
  effectiveQuestionText?: string;
  leaderNameQuery?: string;
  directReply?: string;
  entryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
  workflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
  context: WecomConversationContextRecord;
}
```

- [ ] **Step 4: 回跑定向测试，确认 `ENTITY_LOOKUP` 已经能从 AI 输出流入决策层**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts test/modules/analysis/wecom-active-task-reply.pack.spec.ts
```

Expected:
- PASS，`decision.action === 'ENTITY_LOOKUP'`
- PASS，`TASK_SWITCH.target === 'ENTITY_LOOKUP'` 合法

- [ ] **Step 5: 提交 AI 入口 schema 改动**

```bash
git add backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts backend/src/modules/analysis/capability-packs/fixtures/wecom-idle-entry.fixtures.ts backend/src/modules/analysis/capability-packs/provider-tuning/qwen.provider.ts backend/src/modules/analysis/ai-gateway.service.ts backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts backend/test/modules/analysis/wecom-active-task-reply.pack.spec.ts
git commit -m "feat: 扩展企业微信 AI 入口支持实体列表与详情查询"
```

### Task 2: 增加 `entityLookupMemory` 并固化会话状态读写

**Files:**
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`
- Test: `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`

- [ ] **Step 1: 先写失败测试，固定列表态写入、详情态覆盖与清空边界**

```ts
it('应能写入并清理 entityLookupMemory，且不污染现有跟进草稿状态', () => {
  const service = createService();
  const context = service.loadOrCreateContext(
    {
      id: 'session_entity_lookup',
      requesterId: 'user_sales_director',
    } as never,
    {
      externalConversationId: 'conv_entity_lookup',
      senderId: 'wx_sales_director',
      receivedAt: '2026-04-29T10:00:00.000Z',
    } as never,
  );

  const withListMemory = service.updateEntityLookupMemory(context, {
    mode: 'LIST_RETURNED',
    entityType: 'Customer',
    queryText: '查我的客户列表',
    listItems: [
      {
        id: 'cus_001',
        entityType: 'Customer',
        displayTitle: '山东农信',
        ownerName: '销售总监',
        summaryFields: ['重点客户'],
      },
    ],
    source: 'DIRECT_QUERY',
    expiresAt: '2026-04-29T10:30:00.000Z',
  });

  expect(withListMemory.workMemory.entityLookupMemory).toMatchObject({
    mode: 'LIST_RETURNED',
    entityType: 'Customer',
    queryText: '查我的客户列表',
  });

  const cleared = service.clearEntityLookupMemory(withListMemory);
  expect(cleared.workMemory.entityLookupMemory).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试，确认 `workMemory` 里还没有 `entityLookupMemory`**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts
```

Expected:
- FAIL，`updateEntityLookupMemory` / `clearEntityLookupMemory` 不存在
- FAIL，`workMemory.entityLookupMemory` 类型不存在

- [ ] **Step 3: 最小实现 `entityLookupMemory` 类型与编排服务读写方法**

```ts
// backend/src/shared/types/domain.ts
export interface WecomEntityLookupListItem {
  id: string;
  entityType: 'Customer' | 'Opportunity';
  displayTitle: string;
  ownerName?: string;
  summaryFields: string[];
}

export interface WecomEntityLookupMemory {
  mode: 'IDLE' | 'LIST_RETURNED' | 'DETAIL_RETURNED';
  entityType?: 'Customer' | 'Opportunity';
  queryText?: string;
  listItems: WecomEntityLookupListItem[];
  selectedItemId?: string;
  source?: 'DIRECT_QUERY' | 'AI_SELECTION_FROM_LAST_LIST';
  expiresAt?: string;
}

export interface WecomConversationWorkMemory {
  // 保留现有字段
  entityLookupMemory?: WecomEntityLookupMemory;
}
```

```ts
// backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts
updateEntityLookupMemory(
  context: WecomConversationContextRecord,
  params: Omit<WecomEntityLookupMemory, 'listItems'> & {
    listItems?: WecomEntityLookupListItem[];
  },
): WecomConversationContextRecord {
  return this.wecomConversationContextRepository.save({
    ...context,
    workMemory: {
      ...context.workMemory,
      entityLookupMemory: {
        mode: params.mode,
        entityType: params.entityType,
        queryText: params.queryText,
        listItems: params.listItems ?? [],
        selectedItemId: params.selectedItemId,
        source: params.source,
        expiresAt: params.expiresAt,
      },
    },
    updatedAt: new Date().toISOString(),
  });
}

clearEntityLookupMemory(
  context: WecomConversationContextRecord,
): WecomConversationContextRecord {
  const { entityLookupMemory: _removed, ...rest } = context.workMemory;
  return this.wecomConversationContextRepository.save({
    ...context,
    workMemory: rest,
    updatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: 回跑编排服务单测，确认列表态可写、可清、且不影响旧工作记忆**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts
```

Expected:
- PASS，`entityLookupMemory` 可写入和清空
- PASS，现有帮助/日报/创建/跟进决策测试保持通过

- [ ] **Step 5: 提交会话记忆结构改动**

```bash
git add backend/src/shared/types/domain.ts backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts
git commit -m "feat: 新增企业微信实体查询会话记忆"
```

### Task 3: 新建 `WecomEntityLookupService` 承接列表/详情执行与回复格式化

**Files:**
- Create: `backend/src/modules/wecom/wecom-entity-lookup.helper.ts`
- Create: `backend/src/modules/wecom/wecom-entity-lookup.service.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/modules/wecom/wecom-entity-lookup.service.spec.ts`

- [ ] **Step 1: 先写失败单测，固定列表、唯一详情、多命中退列表、上一轮列表选详情四条主链**

```ts
import { WecomEntityLookupService } from '../../../src/modules/wecom/wecom-entity-lookup.service';

describe('WecomEntityLookupService', () => {
  it('直接详情查询多命中时应返回列表态，而不是默认选第一项', async () => {
    const service = createLookupService({
      customers: [],
      opportunities: [
        {
          id: 'opp_001',
          title: '安恒信息-AH001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerName: '销售总监',
          ownerId: 'user_sales_director',
          stage: '方案',
          expectAmount: 100000,
        },
        {
          id: 'opp_002',
          title: '安恒信息-AH002',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerName: '销售总监',
          ownerId: 'user_sales_director',
          stage: '谈判',
          expectAmount: 150000,
        },
      ],
    });

    const result = await service.execute({
      user: mockUser,
      accessToken: 'mock-token',
      entityLookupAction: 'DETAIL',
      entityType: 'Opportunity',
      queryText: '安恒信息详情',
    });

    expect(result.status).toBe('LIST_RETURNED');
    expect(result.listItems).toHaveLength(2);
    expect(result.replyText).toContain('先给你前 2 条');
  });
});
```

- [ ] **Step 2: 运行单测，确认执行器与格式化 helper 尚不存在**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-entity-lookup.service.spec.ts
```

Expected:
- FAIL，`WecomEntityLookupService` 或 `wecom-entity-lookup.helper.ts` 不存在

- [ ] **Step 3: 最小实现执行器与回复 helper**

```ts
// backend/src/modules/wecom/wecom-entity-lookup.helper.ts
export function buildEntityLookupListReply(params: {
  entityType: 'Customer' | 'Opportunity';
  queryText: string;
  totalCount: number;
  items: Array<{ displayTitle: string; summaryFields: string[] }>;
}): string {
  const objectLabel = params.entityType === 'Customer' ? '客户' : '商机';
  const lines = params.items.map((item, index) => {
    const detailText = item.summaryFields.filter(Boolean).join('｜');
    return detailText
      ? `候选${index + 1}：${item.displayTitle}（${detailText}）`
      : `候选${index + 1}：${item.displayTitle}`;
  });

  return [
    `已找到 ${params.totalCount} 条${objectLabel}，先给你前 ${params.items.length} 条：`,
    ...lines,
    `如需看详情，请直接回复“第 2 个详情”或“候选2”。`,
  ].join('\n');
}
```

```ts
// backend/src/modules/wecom/wecom-entity-lookup.service.ts
@Injectable()
export class WecomEntityLookupService {
  constructor(
    private readonly customerLookupService: CrmCustomerApiService,
    private readonly opportunityLookupService: CrmOpportunityApiService,
  ) {}

  async execute(params: {
    user: CrmUser;
    accessToken: string;
    entityLookupAction: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
    entityType: 'Customer' | 'Opportunity' | 'Unknown';
    queryText?: string;
    selectionIndex?: number;
    memory?: WecomEntityLookupMemory;
  }): Promise<{
    status: 'LIST_RETURNED' | 'DETAIL_RETURNED' | 'CLARIFICATION_REQUIRED';
    replyText: string;
    listItems: WecomEntityLookupListItem[];
    selectedItemId?: string;
  }> {
    if (params.entityLookupAction === 'LIST') {
      return await this.handleList(params);
    }
    if (params.entityLookupAction === 'DETAIL') {
      return await this.handleDetail(params);
    }
    return await this.handleSelectFromLastList(params);
  }
}
```

- [ ] **Step 4: 回跑单测，确认执行器四条主链已稳定**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-entity-lookup.service.spec.ts
```

Expected:
- PASS，列表、唯一详情、多命中退列表、上一轮列表选详情都通过

- [ ] **Step 5: 提交实体查询执行器**

```bash
git add backend/src/modules/wecom/wecom-entity-lookup.helper.ts backend/src/modules/wecom/wecom-entity-lookup.service.ts backend/src/app.module.ts backend/test/modules/wecom/wecom-entity-lookup.service.spec.ts
git commit -m "feat: 新增企业微信实体列表详情查询执行器"
```

### Task 4: 在 `WecomBotService` 中接入 AI-first 列表/详情执行分支

**Files:**
- Modify: `backend/src/modules/wecom/wecom-bot.service.ts`
- Modify: `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`
- Test: `backend/test/integration/wecom-ai-conversation.integration-spec.ts`

- [ ] **Step 1: 先写失败的集成测试，锁定三条关键会话链路**

```ts
it('客户列表返回后，回复第2个详情应读取上一轮列表并返回详情', async () => {
  const conversationId = 'conv_entity_lookup_customer_list_then_detail_001';

  await request(app.getHttpServer())
    .post('/api/v1/wecom/messages')
    .set('x-wecom-signature', 'test-signature')
    .set('x-wecom-source', 'wecom-bot')
    .send({
      externalConversationId: conversationId,
      senderId: 'wx_sales_director',
      messageId: 'msg_entity_lookup_customer_list_001',
      messageText: '查我当前跟进的客户',
    })
    .expect(202);

  const detailResponse = await request(app.getHttpServer())
    .post('/api/v1/wecom/messages')
    .set('x-wecom-signature', 'test-signature')
    .set('x-wecom-source', 'wecom-bot')
    .send({
      externalConversationId: conversationId,
      senderId: 'wx_sales_director',
      messageId: 'msg_entity_lookup_customer_detail_001',
      messageText: '看第2个详情',
    })
    .expect(202);

  expect(detailResponse.body.status).toBe('ENTITY_LOOKUP_DETAIL_RETURNED');
});

it('直接查商机详情且多命中时，应退回列表而不是抢占跟进写回逻辑', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/wecom/messages')
    .set('x-wecom-signature', 'test-signature')
    .set('x-wecom-source', 'wecom-bot')
    .send({
      externalConversationId: 'conv_entity_lookup_opp_detail_multi_001',
      senderId: 'wx_sales_director',
      messageId: 'msg_entity_lookup_opp_detail_multi_001',
      messageText: '安恒信息这个商机详情',
    })
    .expect(202);

  expect(response.body.status).toBe('ENTITY_LOOKUP_LIST_RETURNED');
});

it('当前处于跟进模板补充中时，查看第二个详情应优先按当前任务理解，不得被新能力抢占', async () => {
  // 先进入跟进客户模板收集中，再发送“看第二个详情”
  // 断言仍返回 DAILY_REPORT_PROMPTED 或 FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION，而不是 ENTITY_LOOKUP_*。
});
```

- [ ] **Step 2: 运行集成测试，确认当前机器人尚未暴露 `ENTITY_LOOKUP` 状态**

Run:

```bash
pnpm --dir backend test -- test/integration/wecom-ai-conversation.integration-spec.ts
```

Expected:
- FAIL，当前结果状态中没有 `ENTITY_LOOKUP_LIST_RETURNED`
- FAIL，`看第2个详情` 不会从上一轮列表继续

- [ ] **Step 3: 最小接入执行分支、灰度开关与状态清理**

```ts
// backend/src/modules/wecom/wecom-bot.service.ts
if (conversationDecision.action === 'ENTITY_LOOKUP') {
  const entityLookupEnabled = process.env.WECOM_AI_ENTITY_LOOKUP_ENABLED !== 'false';
  if (!entityLookupEnabled) {
    return this.buildHelpGuidanceResult({
      user,
      session,
      receipt,
      inboundMessage,
      conversationContext,
      replyText: '当前企业微信列表与详情查询能力尚未开启，请先使用现有经营问数、跟进或创建能力。',
    });
  }

  const accessToken = await this.resolveWecomCrmAccessToken(user);
  const lookupResult = await this.wecomEntityLookupService.execute({
    user,
    accessToken,
    entityLookupAction: conversationDecision.entityLookupAction!,
    entityType: conversationDecision.entityLookupEntityType!,
    queryText: conversationDecision.entityLookupQueryText,
    selectionIndex: conversationDecision.entityLookupSelectionIndex,
    memory: conversationContext.workMemory.entityLookupMemory,
  });

  conversationContext =
    lookupResult.status === 'LIST_RETURNED'
      ? this.wecomAiConversationOrchestrationService.updateEntityLookupMemory(
          conversationContext,
          {
            mode: 'LIST_RETURNED',
            entityType:
              conversationDecision.entityLookupEntityType === 'Unknown'
                ? undefined
                : conversationDecision.entityLookupEntityType,
            queryText: conversationDecision.entityLookupQueryText,
            listItems: lookupResult.listItems,
            source:
              conversationDecision.entityLookupAction === 'SELECT_FROM_LAST_LIST'
                ? 'AI_SELECTION_FROM_LAST_LIST'
                : 'DIRECT_QUERY',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        )
      : this.wecomAiConversationOrchestrationService.updateEntityLookupMemory(
          conversationContext,
          {
            mode: 'DETAIL_RETURNED',
            entityType:
              conversationDecision.entityLookupEntityType === 'Unknown'
                ? undefined
                : conversationDecision.entityLookupEntityType,
            queryText: conversationDecision.entityLookupQueryText,
            listItems: conversationContext.workMemory.entityLookupMemory?.listItems ?? [],
            selectedItemId: lookupResult.selectedItemId,
            source:
              conversationDecision.entityLookupAction === 'SELECT_FROM_LAST_LIST'
                ? 'AI_SELECTION_FROM_LAST_LIST'
                : 'DIRECT_QUERY',
            expiresAt: conversationContext.workMemory.entityLookupMemory?.expiresAt,
          },
        );
}
```

```ts
// backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts
private buildClearedTaskWorkMemory(): Partial<WecomConversationContextRecord['workMemory']> {
  return {
    followUpTemplateDraft: undefined,
    activeFollowUpWritebackId: undefined,
    crmCreateStatus: undefined,
    entityLookupMemory: undefined,
  };
}
```

- [ ] **Step 4: 回跑集成测试，确认新能力是加法、旧任务优先级不变**

Run:

```bash
pnpm --dir backend test -- test/integration/wecom-ai-conversation.integration-spec.ts
```

Expected:
- PASS，新增列表/详情用例通过
- PASS，既有跟进、日报、创建、问数会话用例不回归

- [ ] **Step 5: 提交机器人执行层接入**

```bash
git add backend/src/modules/wecom/wecom-bot.service.ts backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts backend/test/integration/wecom-ai-conversation.integration-spec.ts
git commit -m "feat: 接入企业微信实体列表与详情查询会话流"
```

### Task 5: 同步帮助提示、契约和用户可见能力清单

**Files:**
- Modify: `backend/src/modules/wecom/wecom-ai-prompt.config.ts`
- Modify: `backend/test/modules/wecom/wecom-ai-prompt.config.spec.ts`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Modify: `specs/001-crm-intelligent-analytics/quickstart.md`
- Modify: `README.md`

- [ ] **Step 1: 先写失败测试，锁定帮助提示必须包含新能力**

```ts
it('企微帮助提示应展示客户商机列表与详情查询能力', () => {
  const prompt = buildWecomHelpPrompt({
    scene: 'CAPABILITY',
  });

  expect(prompt).toContain('查询客户列表');
  expect(prompt).toContain('查看某个客户或商机的详情');
  expect(prompt).toContain('看第2个详情');
});
```

- [ ] **Step 2: 运行帮助提示测试，确认现有提示尚未包含该能力**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-prompt.config.spec.ts
```

Expected:
- FAIL，现有帮助提示没有“客户/商机列表与详情”

- [ ] **Step 3: 最小实现帮助提示与契约同步**

```ts
// backend/src/modules/wecom/wecom-ai-prompt.config.ts
export function buildWecomHelpPrompt(params: { scene: 'GREETING' | 'CAPABILITY' }): string {
  return [
    '你好，我是 CRM 智能助手。',
    '当前支持的企业微信能力包括：',
    '1. 经营分析问数，例如“本月各销售负责人新增商机金额排名”。',
    '2. 跟进客户 / 跟进商机 / 今日跟进。',
    '3. 新增客户 / 新增商机。',
    '4. 查询客户列表、商机列表，以及查看某个客户或商机的详情。',
    '5. 列表返回后，可继续回复“看第2个详情”或“候选2”。',
  ].join('\n');
}
```

```yaml
# specs/001-crm-intelligent-analytics/contracts/openapi.yaml
WecomReceiveMessageResponse:
  properties:
    status:
      enum:
        - RETURNED
        - CLARIFICATION_REQUIRED
        - OPPORTUNITY_LOOKUP_RETURNED
        - ENTITY_LOOKUP_LIST_RETURNED
        - ENTITY_LOOKUP_DETAIL_RETURNED
        - FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION
```

```md
<!-- README.md -->
- 企业微信机器人当前支持能力新增：
  - 查询客户列表
  - 查询商机列表
  - 查看客户详情
  - 查看商机详情
  - 基于上一轮列表继续查看第 N 项详情
```

- [ ] **Step 4: 回跑帮助提示测试并检查文档格式**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-ai-prompt.config.spec.ts
pnpm exec prettier --check README.md specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/quickstart.md
```

Expected:
- PASS，帮助提示测试通过
- PASS 或仅提示可格式化，不应出现 YAML 结构错误

- [ ] **Step 5: 提交契约与用户可见能力同步**

```bash
git add backend/src/modules/wecom/wecom-ai-prompt.config.ts backend/test/modules/wecom/wecom-ai-prompt.config.spec.ts specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/quickstart.md README.md
git commit -m "docs: 同步企业微信实体列表与详情查询能力说明"
```

### Task 6: 执行后端全链路回归并验证灰度边界

**Files:**
- Test: `backend/test/integration/wecom-ai-conversation.integration-spec.ts`
- Test: `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`
- Test: `backend/test/modules/wecom/wecom-ai-prompt.config.spec.ts`
- Test: `backend/test/modules/analysis/wecom-active-task-reply.pack.spec.ts`
- Test: `backend/test/modules/wecom/wecom-entity-lookup.service.spec.ts`
- Test: `backend/test/modules/opportunities/customer-lookup.service.spec.ts`
- Test: `backend/test/modules/opportunities/opportunity-lookup.service.spec.ts`

- [ ] **Step 1: 跑新增能力的定向回归**

Run:

```bash
pnpm --dir backend test -- test/modules/wecom/wecom-entity-lookup.service.spec.ts test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts test/modules/wecom/wecom-ai-prompt.config.spec.ts test/modules/analysis/wecom-active-task-reply.pack.spec.ts
```

Expected:
- PASS，新增 AI schema、会话记忆、帮助提示和执行器单测全部通过

- [ ] **Step 2: 跑企业微信主集成回归**

Run:

```bash
pnpm --dir backend test -- test/integration/wecom-ai-conversation.integration-spec.ts
```

Expected:
- PASS，新增列表/详情用例通过
- PASS，既有跟进、日报、创建、问数对话全部不回归

- [ ] **Step 3: 跑完整后端测试，确认没有隐性回归**

Run:

```bash
pnpm --dir backend build
pnpm --dir backend test
```

Expected:
- PASS，`tsc` 通过
- PASS，完整后端测试通过

- [ ] **Step 4: 人工灰度验证开关边界**

Run:

```bash
$env:WECOM_AI_ENTITY_LOOKUP_ENABLED='false'
pnpm --dir backend test -- test/integration/wecom-ai-conversation.integration-spec.ts
```

Expected:
- 与列表/详情新增能力相关的用例应调整为 feature flag 条件运行；
- 关闭开关时，现有问数、跟进、创建链路仍保持通过；
- 手工联调时，列表/详情请求会返回帮助或降级提示，而不是误入旧关键词逻辑。

- [ ] **Step 5: 提交最终回归结论**

```bash
git add backend/test/integration/wecom-ai-conversation.integration-spec.ts
git commit -m "test: 覆盖企业微信实体列表与详情查询回归"
```

## Self-Review

### Spec coverage

- 设计稿中的 `AI 理解优先` 由 Task 1 覆盖。
- `entityLookupMemory` 与上一轮列表引用由 Task 2、Task 4 覆盖。
- `当前用户可跟进范围` 列表与详情执行由 Task 3 覆盖。
- `不影响现有功能` 的主回归由 Task 4、Task 6 覆盖。
- `帮助提示 / README / quickstart / openapi` 的用户可见同步由 Task 5 覆盖。

### Placeholder scan

- 所有任务都给出了明确文件路径、测试命令、目标状态和核心代码片段。
- 没有 `TODO`、`TBD`、`后续补充` 之类占位语。

### Type consistency

- 统一使用 `ENTITY_LOOKUP` 作为 AI intent。
- 统一使用 `LIST | DETAIL | SELECT_FROM_LAST_LIST` 作为查询动作。
- 统一使用 `WecomEntityLookupMemory` / `WecomEntityLookupListItem` 作为会话记忆类型。
- 统一使用 `ENTITY_LOOKUP_LIST_RETURNED` / `ENTITY_LOOKUP_DETAIL_RETURNED` 作为响应状态。
