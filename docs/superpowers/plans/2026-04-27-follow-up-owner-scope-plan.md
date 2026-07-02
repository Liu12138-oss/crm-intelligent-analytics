# 跟进客户/跟进商机对象级权限收口实施方案

> 适用范围：本方案只覆盖企业微信 `跟进客户`、`跟进商机`、`今日跟进` 三类跟进入口及其后续受控写回链路，不调整登录、统一鉴权、基础问数权限和 Web 主工作台通用能力。

## 1. 目标

- 把企业微信跟进写回权限从“只有功能点权限”收紧到“功能点权限 + 目标对象关系权限”双门闩。
- 目标对象关系权限首版按“负责人本人、负责人所在小组、负责人上面的各层领导”执行。
- 继续优先复用 CRM 官方接口 `POST /api/v2/revisit_logs`，不新增数据库直写路径。
- 把当前“规格仍写 Opportunity 单对象、代码已部分支持 Customer”这一不一致显式收口，避免后续继续半开半关。

## 2. 现状结论

### 2.1 当前代码能力与规格口径不一致

- 主规格与快速开始仍把“查询后受控跟进写回”写成 `唯一 Opportunity 查询后` 才允许进入正式写回。
- 但现有代码已经支持 `跟进客户` 主题入口，并可生成 `objectType = Customer` 的待写回草稿与成功写回测试。
- `openapi.yaml` 里的 `WecomFollowUpWritebackPayload.objectType` 仍只声明 `Opportunity`，与当前代码和测试不一致。
- `data-model.md` 的 `PendingFollowUpWriteback` 仍使用 `opportunityId / opportunityTitle` 命名，已经不适合表达客户跟进。

### 2.2 当前权限只校验“有没有功能”，没有校验“能不能跟这个对象”

- 现有企业微信链路只校验 `wecom.followup.writeback` 这个动作权限。
- 只要动作权限通过，当前用户就可以把已命中的客户或商机草稿推进到正式写回。
- 这不足以满足“只有负责人本人、同组成员、上级领导可跟进”的新要求。

### 2.3 当前查数权限与最终写回身份不是同一个主体

- 跟进对象识别阶段，客户/商机会先按当前用户可见范围查询。
- 最终写回阶段，系统会切换到受控内置 CRM 账号调用 `POST /api/v2/revisit_logs`。
- 这意味着不能只依赖“查到了就能写”，必须在写回前额外做一次对象级关系权限校验。

### 2.4 现有组织范围能力只覆盖“本人 + 下属”，还没有“目标负责人同组 + 上行领导链”判定

- `OrganizationScopeService` 当前核心能力是把当前用户可见范围解析为“本人或团队 ownerIds”。
- 日报预览场景里有少量“负责人本人 / 上级 / 白名单”判断，但没有可直接复用的“目标对象负责人所在小组 + 递归上级”授权服务。
- 本次需求需要补一个独立、可复用的组织关系授权层，而不是继续把判断散落在 `WecomBotService`。

## 3. CRM 官方 API 可用性检查结论

- 已核对 CRM 官方文档“写跟进”：`/api/v2/revisit_logs`。
- 官方参数 `revisit_log[loggable_type]` 明确支持 `Lead、Customer、Contact、Contract、Opportunity`。
- 这意味着“客户跟进写回”在接口能力上可行，不需要因为对象类型是 `Customer` 就退回数据库或自建写库。

结论：

- 如果业务确认“跟进客户”应允许正式写回 CRM，那么仍可继续走官方 API 主路径。
- 本次主要新增的是“对象级权限收口”，不是“接口能力补洞”。

参考来源：

- CRM 官方 API 文档：<https://apidoc.weiwenjia.com/docs/crm_open_api/revisit_create>

## 4. 推荐口径

### 4.1 总门闩保持两层

首版建议保留双层门闩，不把现有权限中心能力废掉：

1. **功能权限门闩**
   仍要求当前用户具备 `wecom.followup.writeback`。
2. **对象关系门闩**
   仅当用户与目标对象负责人满足以下任一关系时，才允许继续：
   - 负责人本人
   - 负责人所在小组成员
   - 负责人递归上级领导
   - 系统管理员

这样做的原因：

- `wecom.followup.writeback` 继续充当全局开关，方便治理后台统一停开。
- 新增对象关系门闩负责落业务边界，避免“有权限的人可跟任何对象”。

### 4.2 “负责人”建议按目标对象类型取值

这是本次最关键的业务口径，推荐如下：

- `跟进客户`
  负责人取 **客户当前负责人**。
- `跟进商机`
  负责人取 **商机当前负责人**。
- `今日跟进 / 自由文本`
  先完成对象识别；最终选中的是客户就按客户负责人，选中的是商机就按商机负责人。

推荐原因：

- 这与用户正在操作的业务对象一致，解释成本最低。
- 如果客户与其下挂商机负责人不同，仍能清楚说明“你跟的是谁，就继承谁的负责人权限边界”。
- 可以避免“客户跟进却拿商机负责人判权”这类歧义。

### 4.3 “负责人所在小组”建议按企业微信当前直属上级事实定义

推荐定义：

- 先通过企业微信同步事实找到“目标负责人”的当前 `directLeaderUserids`。
- 取其**最小直属团队**作为“负责人所在小组”：
  - 目标负责人本人
  - 与其共享同一直属上级的成员
  - 可选包含该直属上级本人

不建议直接按 CRM 页面上的“所属部门中文名”做权限判断，原因有三点：

- 页面展示部门路径不一定等于实际汇报线。
- 同部门可能有多个销售小组，直接按部门会放大权限。
- 企业微信同步数据里已经有更接近真实汇报关系的 `directLeaderUserids`，应优先复用。

### 4.4 “负责人上面的各层领导”建议按企业微信直属上级链递归向上

推荐定义：

- 从目标负责人的 `directLeaderUserids` 出发递归向上查找。
- 任一层直属上级映射到 CRM 用户后，均可获得该对象的跟进资格。

这样可直接满足“负责人上面的各层领导能跟进”的要求，也与现有目录同步事实最一致。

### 4.5 权限校验必须按实时对象负责人重算

推荐在以下两个阶段都做校验：

1. **草稿创建前**
   防止用户刚进入对象确认就拿到不该写的草稿。
2. **最终写回前**
   防止负责人在确认期间发生转移后，旧草稿仍被放行。

推荐在最终写回前重新读取目标客户/商机的最新负责人，而不是只信任草稿快照。

## 5. 实现方案

### 5.1 新增独立的跟进授权服务

建议新增：

- `backend/src/modules/opportunities/follow-up-authorization.service.ts`

职责：

- 输入：操作者、目标对象类型、目标对象 ID、目标对象当前负责人 ID。
- 输出：
  - 是否允许写回
  - 命中的关系类型
  - 参与判定的团队负责人、上级链、映射缺失原因
  - 面向审计和提示文案的中文原因

建议返回的关系类型：

- `ADMIN`
- `OWNER_SELF`
- `OWNER_GROUP_MEMBER`
- `OWNER_GROUP_LEADER`
- `DENIED`
- `OWNER_MAPPING_MISSING`
- `OWNER_RELATION_AMBIGUOUS`

### 5.2 把组织关系判定从范围服务里抽成可复用能力

建议补齐以下底层能力，放在 `OrganizationScopeService` 或新建 `WecomOrgRelationService`：

- `resolveWxUseridByCrmUserId(crmUserId)`
- `resolveCrmUserIdByWxUserid(wxUserid)`
- `collectDirectLeaderWxUserids(wxUserid)`
- `collectAncestorLeaderWxUserids(wxUserid)`
- `collectSiblingCrmUserIdsByDirectLeader(wxUserid)`

建议：

- 如果当前会话用户、目标负责人、上级链任一关键节点缺少企业微信映射，默认按**不放权**处理。
- 这种场景返回明确提示，并写审计，不要静默退回“只要有功能权限就放行”。

### 5.3 在企业微信写回链路的三个阶段接线

至少要在以下位置补校验：

1. **跟进模板命中唯一对象、准备创建待写回草稿时**
   - `dispatchFollowUpTemplateWritebackConfirmation`
2. **日报 / 今日跟进 / 自由文本补名称后，准备创建待写回草稿时**
   - 所有 `save pending writeback` 分支
3. **最终确认写回、失败后重试再次写回时**
   - `executeFollowUpWriteback`

行为要求：

- 草稿创建阶段不通过：不创建 `PendingFollowUpWritebackRecord`，只保留模板草稿与对象识别上下文。
- 最终确认阶段不通过：保留待写回草稿，但阻断正式写回。

### 5.4 调整待写回对象模型，去掉“只有 Opportunity”的历史命名

建议调整：

- `PendingFollowUpWritebackRecord`
- `WecomConversationWorkMemory`
- `WecomFollowUpWritebackPayload`

推荐改法：

- 新增中性字段：
  - `targetObjectType`
  - `targetObjectId`
  - `targetObjectTitle`
- 旧字段 `opportunityId / opportunityTitle` 先保留一版兼容读取，再逐步清理。

原因：

- 当前客户跟进已经存在，继续用 `opportunityId` 表达客户对象只会让后续权限、审计、接口契约越来越难维护。

### 5.5 文案与审计要求

新增阻断文案建议：

- 草稿创建前阻断：
  `当前仅负责人本人、负责人所在小组成员及其上级领导可跟进该客户/商机。`
- 最终写回前阻断：
  `该对象负责人或组织关系已变化，你当前不再具备跟进权限，请重新确认。`
- 映射缺失阻断：
  `当前无法确认该对象负责人的组织关系，暂不能执行跟进写回，请联系管理员同步企业微信目录后重试。`

审计要求：

- 继续复用 `ACCESS_ACTION_DENIED` 记录权限阻断。
- `resourceType` 建议新增细分值：
  - `follow-up-writeback-draft-scope`
  - `follow-up-writeback-execute-scope`
- `sessionSnapshot` 建议记录：
  - `objectType`
  - `objectId`
  - `ownerUserId`
  - `matchedRelation`
  - `groupLeaderUserIds`
  - `ancestorLeaderUserIds`
  - `deniedReason`

### 5.6 规格与契约同步

如果最终确认允许“客户跟进正式写回”，则至少要同步以下文档：

- `specs/001-crm-intelligent-analytics/spec.md`
- `specs/001-crm-intelligent-analytics/data-model.md`
- `specs/001-crm-intelligent-analytics/quickstart.md`
- `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`

建议同步点：

- `FR-041`
  补充“主题入口写回的对象级权限规则”。
- `FR-042`
  从“首版 `loggable_type` 固定为 `Opportunity`”改成“按批准对象类型写入；若本期确认包含客户，则允许 `Customer` 与 `Opportunity`”。
- `PendingFollowUpWriteback`
  从“Opportunity 专用字段”改成“通用跟进对象字段”。
- Quickstart 场景 12 / 12A
  补充“跟进客户”的正式写回验证与权限阻断验证。
- OpenAPI
  把 `WecomFollowUpWritebackPayload.objectType` 枚举改为 `[Customer, Opportunity]`。

### 5.7 测试方案

#### 单元测试

- `FollowUpAuthorizationService`
  - 负责人本人允许
  - 同直属小组成员允许
  - 直属领导允许
  - 递归上级允许
  - 其他小组成员拒绝
  - 映射缺失拒绝
  - 多直属上级场景命中任一路径即允许

#### 集成测试

- 企业微信 `跟进客户`
  - 负责人本人写回成功
  - 同小组同事写回成功
  - 上级领导写回成功
  - 非同组平级销售写回被拒绝
  - 草稿创建后负责人变更，再确认时被拒绝
- 企业微信 `跟进商机`
  - 同上覆盖一套
- 审计验证
  - 阻断时生成 `ACCESS_ACTION_DENIED`
  - 审计里能看到对象 ID、负责人 ID、命中的关系类型或拒绝原因

## 6. 推荐实施顺序

1. 先确认业务口径
   - 到底是否正式放开 `Customer` 写回
   - 小组按什么定义
2. 先补底层组织关系服务
3. 再补对象级授权服务
4. 接入草稿创建与最终写回门闩
5. 调整中性字段与 OpenAPI 契约
6. 最后补规格文档与自动化测试

## 7. 需要你拍板的确认问题

以下问题不确认，代码实现会直接分叉：

1. **负责人口径按谁算？**
   - 推荐：`跟进客户` 按客户负责人，`跟进商机` 按商机负责人。
   - 需要确认：是否接受这个口径，而不是统一只认商机负责人。

2. **是否正式允许“客户跟进”写回 CRM？**
   - 现状：代码和测试已经支持 `Customer`，但规格和 OpenAPI 仍写成 `Opportunity`。
   - 推荐：既然官方 API 支持 `Customer`，本次一起转正并补齐规格。

3. **“负责人所在的小组”怎么定义？**
   - 推荐：按企业微信当前 `directLeaderUserids` 对应的最小直属团队定义。
   - 需要确认：是否接受这个定义，而不是按 CRM 页面显示的“所属部门名称”整段放权。

4. **最终确认时是否按实时负责人重校验？**
   - 推荐：是。草稿创建后如果负责人变更，最终确认必须重新判权。
   - 不推荐继续信任草稿里的旧负责人快照。

5. **是否继续保留 `wecom.followup.writeback` 作为全局总开关？**
   - 推荐：保留。
   - 如果取消这个总开关，后续权限治理会明显变弱。

6. **历史“前负责人”是否保留跟进权限？**
   - 推荐：不保留。
   - 只有当前负责人本人、当前负责人小组、当前上级链可跟进；前负责人如仍有权限，应当是因为他仍命中当前关系，而不是因为“曾经负责过”。

## 8. 推荐结论

如果你要我直接进入实现，建议按以下组合落地：

- 允许正式写回 `Customer` 与 `Opportunity`
- `跟进客户` 按客户负责人，`跟进商机` 按商机负责人
- 小组按企业微信直属上级定义的最小团队
- 最终确认前按实时负责人重校验
- 保留 `wecom.followup.writeback` 作为总开关
- 前负责人不自动保留权限

这套组合改动面最可控，也最符合你现在提出的业务边界。
