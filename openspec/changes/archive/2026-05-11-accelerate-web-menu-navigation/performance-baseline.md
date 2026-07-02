# 菜单切换性能基线

## 记录说明

本文件记录 `accelerate-web-menu-navigation` 变更在当前阶段已经落地并通过自动化验证的性能基线样本，作为后续性能退化对比依据。

- 记录日期：2026-05-11
- 记录范围：前端一级菜单热切换、重页面首屏请求集、后端会话解析与能力快照缓存
- 记录环境：本地 mocked E2E / 集成测试环境

## 目标口径

### 一级菜单热切换目标

- 已登录、同一页签、最近已完成一次有效会话与能力校验时：
  - 路由确认必须是毫秒级
  - 壳层骨架展示必须是毫秒级
  - 菜单点击不得再次把 `auth/session` 或 `analysis/capabilities` 放回同步热路径
- 首次硬刷新进入受保护页面时：
  - 允许执行实时会话校验
  - 但页面必须优先展示壳层和过渡骨架，重数据随后补齐

### 首批纳入优化的页面

- `analysis`
- `management-report`
- `contract-review`
- `governance/policies`
- `governance/access`
- `governance/templates`
- `governance/connections`
- `governance/ai-models`
- `audit`

## 埋点与日志字段

### 前端埋点字段

- `menu_click`
- `route_confirmed`
- `shell_visible`
- `page_data_ready`
- `targetPath`
- `traceId`

### 后端日志字段

- `sessionId`
- `userId`
- `requesterId`
- `identitySource`
- `cacheHit`
- `durationMs`
- `reportId`
- `departmentId`
- `templateCount`
- `visibleMenuCount`
- `actionKeyCount`
- `sectionCount`

## 采样命令

### 前端热切换与页面请求基线

```bash
pnpm --dir frontend test:e2e -- navigation-performance.e2e-spec.ts
pnpm --dir frontend test:e2e -- governance-capability-refresh.e2e-spec.ts
pnpm --dir frontend test:e2e -- management-report-page.e2e-spec.ts
pnpm --dir frontend test:unit -- permission-center-page.spec.ts contract-review-flow.spec.ts analysis-page-layout.spec.ts app-view-cache.spec.ts router-access-guard.spec.ts
```

### 后端会话与能力快照基线

```bash
pnpm --dir backend test -- auth-session.integration-spec.ts
pnpm --dir backend test -- access-governance.integration-spec.ts
pnpm --dir backend test -- management-report.integration-spec.ts
```

## 基线样本

### 1. 一级菜单热切换网络基线

采样路径：

- `analysis -> management-report -> contract-review -> analysis`

当前基线：

- 同一页签内仅触发 `1` 次 `GET /api/v1/auth/session`
- 同一页签内仅触发 `1` 次 `GET /api/v1/analysis/capabilities`
- 再次切回已访问的一页时，不允许因为菜单点击而重新命中上述两个接口

对应验证：

- `frontend/tests/e2e/navigation-performance.e2e-spec.ts`

### 2. 治理保存后权限刷新基线

采样路径：

- 打开 `治理策略`
- 首次能力快照不包含 `经营报表`
- 点击保存治理
- 下一次导航立即出现 `经营报表` 菜单并可成功进入

当前基线：

- 第 `1` 次能力快照使用旧菜单结果
- 第 `2` 次能力快照必须立即反映新菜单结果
- 保存治理后，下一次菜单点击不得继续沿用旧能力快照

对应验证：

- `frontend/tests/e2e/governance-capability-refresh.e2e-spec.ts`

### 3. 经营报表首屏请求集基线

采样路径：

- 打开 `经营报表`
- 观察首屏总览与经营摘要
- 再点击 `收款情况`

当前基线：

- 页面初始化阶段不请求 `/management-report/sections/:sectionKey`
- 点击专题前，专题详情请求数为 `0`
- 点击 `收款情况` 后，请求数变为 `1`

对应验证：

- `frontend/tests/e2e/management-report-page.e2e-spec.ts`

### 4. 权限中心首屏请求集基线

采样路径：

- 打开 `权限中心`

当前基线：

- 首屏立即请求：
  - `getAccessGovernanceOverview`
  - `getWecomPilotPolicy`
  - `listAccessOptions`
  - `listRolePermissions`
- 首屏不立即请求：
  - `listDataScopeGrants`
  - `listIdentityMappings`
  - `listDailyReportDeliveryDepartments`
  - `previewDailyReportDelivery`
- 上述延迟区块请求应在下一帧补发

对应验证：

- `frontend/tests/unit/permission-center-page.spec.ts`

### 5. 合同审核首页首屏请求集基线

采样路径：

- 打开 `智能合同`

当前基线：

- 首屏立即请求 `listPendingApprovalContracts`
- 首屏不立即请求 `listRecentTasks`
- `listRecentTasks` 应在下一帧延迟补发

对应验证：

- `frontend/tests/unit/contract-review-flow.spec.ts`

### 6. 后端会话解析缓存基线

采样路径：

- 数据库身份会话连续访问：
  - `GET /auth/session`
  - `GET /analysis/capabilities`
  - `GET /analysis/templates`

当前基线：

- `crmReadonlyService.getUserById()` 仅命中 `1` 次

对应验证：

- `backend/test/integration/auth-session.integration-spec.ts`

### 7. 后端能力快照缓存基线

采样路径：

- 同一会话连续两次读取 `GET /analysis/capabilities`

当前基线：

- 模板可见数计算仅命中 `1` 次
- 第二次能力请求必须命中短时会话级能力快照

对应验证：

- `backend/test/integration/auth-session.integration-spec.ts`

### 8. 后端敏感接口实时权限校验基线

采样路径：

- 用户先拿到允许导出的经营报表能力
- 管理员撤销 `management.report.export`
- 用户直接请求经营报表导出接口

当前基线：

- 导出接口必须立即返回 `403`
- 不允许因为旧能力快照仍可见而继续放行导出

对应验证：

- `backend/test/integration/management-report.integration-spec.ts`

## 基线使用方式

后续若再次优化或重构菜单切换、页面初始化、权限快照或治理刷新链路，至少需要重新执行本文件中的采样命令，并逐项比对：

- 请求次数是否回退
- 延迟区块是否被重新塞回首屏热路径
- 权限治理保存后是否仍会短时间使用旧菜单结果
- 敏感接口是否仍坚持后端实时权限校验

若任何一项不再满足本基线，应视为性能或权限行为退化，必须先修复再继续提交。
