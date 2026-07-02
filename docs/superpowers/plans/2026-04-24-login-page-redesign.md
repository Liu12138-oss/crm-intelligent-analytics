# 登录页视觉升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CRM 智能业务平台实现一版“深浅融合 AI 中控感”的登录页，并把背景图、装饰图与图标素材接入项目代码。

**Architecture:** 保留现有 `LoginPage.vue` 的登录交互与状态管理逻辑，只重构登录页左侧品牌辅助区、右侧登录卡容器与登录页专属样式。背景图与图标采用项目内 `SVG` 资产，便于后续继续复用与改色。

**Tech Stack:** Vue 3、TypeScript、Element Plus、项目全局 CSS、Vitest、Playwright

---

## 文件结构

- 修改：`frontend/src/pages/auth/LoginPage.vue`
- 修改：`frontend/src/styles/main.css`
- 修改：`frontend/tests/unit/login-page.spec.ts`
- 修改：`frontend/tests/e2e/login-page-layout.e2e-spec.ts`（仅在布局约束需要时）
- 新增：`frontend/src/images/login/bg-login-command.svg`
- 新增：`frontend/src/images/login/login-scene-panel.svg`
- 新增：`frontend/src/images/login/icon-login-account.svg`
- 新增：`frontend/src/images/login/icon-login-wecom.svg`
- 新增：`frontend/src/images/login/icon-login-shield.svg`

## Task 1：落地登录页视觉素材

**Files:**
- Create: `frontend/src/images/login/bg-login-command.svg`
- Create: `frontend/src/images/login/login-scene-panel.svg`
- Create: `frontend/src/images/login/icon-login-account.svg`
- Create: `frontend/src/images/login/icon-login-wecom.svg`
- Create: `frontend/src/images/login/icon-login-shield.svg`

- [ ] 产出主背景图、装饰面板与 3 个能力图标，统一采用可维护的 `SVG`
- [ ] 保持颜色与 `DESIGN.md` 一致，主色落在紫蓝浅光体系
- [ ] 素材命名采用登录页专属前缀，避免后续被其他场景误用

## Task 2：重构登录页模板结构

**Files:**
- Modify: `frontend/src/pages/auth/LoginPage.vue`

- [ ] 在登录页左侧新增品牌辅助区与能力卡片
- [ ] 在登录页右侧登录卡中补充可信入口辅助说明，但不改动既有登录主流程
- [ ] 保留账号密码登录、企业微信扫码登录、管理员联系方式与错误反馈逻辑

## Task 3：重构登录页样式

**Files:**
- Modify: `frontend/src/styles/main.css`

- [ ] 为登录页增加双栏布局、深浅融合背景与玻璃感登录卡
- [ ] 为左侧能力卡、底部可信信息和装饰层补齐桌面端视觉样式
- [ ] 为平板与移动端补齐收缩布局，避免视觉区挤压登录表单

## Task 4：补齐回归测试

**Files:**
- Modify: `frontend/tests/unit/login-page.spec.ts`
- Test: `frontend/tests/e2e/login-page-layout.e2e-spec.ts`

- [ ] 更新单测断言，使其验证“品牌入口 + 左侧辅助区 + 登录主流程”同时成立
- [ ] 保持账号密码登录、企业微信切换、管理员信息展开等回归测试通过
- [ ] 若桌面端右侧间距规则未变，则保留现有 E2E 断言不调整

## Task 5：执行验证

**Files:**
- Test: `frontend/tests/unit/login-page.spec.ts`
- Test: `frontend/tests/e2e/login-page-layout.e2e-spec.ts`

- [ ] 运行针对登录页的单元测试
- [ ] 运行登录页布局 E2E 用例
- [ ] 如有样式或测试偏差，只修复本次登录页升级相关问题

## 自检结果

- 规格覆盖：已覆盖页面结构、视觉素材、样式适配与测试回归
- 占位检查：无 `TODO` / `TBD`
- 一致性检查：素材路径、页面路径与测试路径均与现有仓库结构一致

## 执行说明

按当前仓库协作约束，本计划不包含 `git commit` 步骤；如后续需要提交，再由你明确授权后执行。
