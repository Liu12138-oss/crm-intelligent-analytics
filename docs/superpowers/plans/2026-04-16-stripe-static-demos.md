# Stripe 静态 Demo 实现计划

> **供后续协作代理参考：** 本计划面向 `frontend/demos/stripe-workbench/` 下的纯静态 HTML/CSS 设计演示页，步骤使用复选框语法便于后续继续拆分执行。

**目标：** 基于新版 `DESIGN.md` 产出一组可直接预览的 Stripe 风格静态页面 demo，用于验证视觉方向、页面结构和关键组件语法。

**架构：** 在 `frontend` 下新增独立 demo 目录，使用一份共享样式文件承载设计 token、布局、卡片、表格、标签、按钮和页面骨架，再以 5 个独立静态页面分别表达登录、工作台首页、分析结果、治理审计和合同审核场景。demo 不复用现有 Vue 页面代码，也不污染当前 `main.css` 的旧样式体系。

**技术栈：** HTML5、CSS3、静态 SVG、相对路径资源组织

---

### 任务 1：搭建 demo 目录和共享样式

**文件：**
- 新建：`frontend/demos/stripe-workbench/assets/crm-stripe-demo.css`
- 新建：`frontend/demos/stripe-workbench/index.html`

- [ ] 定义共享设计 token，包括浅色主背景、品牌紫蓝、状态色、圆角、阴影、间距和排版层级。
- [ ] 定义共享布局骨架，包括总览页、应用壳层、顶部栏、侧边导航、卡片、指标卡、筛选条、表格和状态标签。
- [ ] 编写 demo 总览页，提供 5 个页面入口和每页用途说明。

### 任务 2：实现首页与登录页 demo

**文件：**
- 新建：`frontend/demos/stripe-workbench/login.html`
- 新建：`frontend/demos/stripe-workbench/workbench.html`

- [ ] 编写登录页，体现 Stripe 式浅色品牌入口、双登录方式、辅助说明和柔和渐变背景。
- [ ] 编写工作台首页，体现“经营工作台优先”的新版 DESIGN，包括头部摘要、AI 问数模块、经营概览和资产复用区。
- [ ] 保持两页共享同一套 token 和组件语法，但让登录页更偏设计稿质感、工作台更偏产品首页。

### 任务 3：实现结果页、治理页与合同审核页 demo

**文件：**
- 新建：`frontend/demos/stripe-workbench/result.html`
- 新建：`frontend/demos/stripe-workbench/audit.html`
- 新建：`frontend/demos/stripe-workbench/contract-review.html`

- [ ] 编写分析结果页，突出结论优先、证据随后、边界持续可见。
- [ ] 编写治理审计页，突出摘要卡、筛选、事件表和风险详情的秩序感。
- [ ] 编写合同审核页，突出风险优先、审核模式区分和浅色阅读面板。

### 任务 4：静态检查与预览验证

**文件：**
- 检查：`frontend/demos/stripe-workbench/*.html`
- 检查：`frontend/demos/stripe-workbench/assets/crm-stripe-demo.css`

- [ ] 启动本地静态服务预览 demo 页面。
- [ ] 检查相对路径、页面切换、样式加载和基础响应式是否正常。
- [ ] 人工复核是否符合新版 `DESIGN.md` 中的 Stripe 化、浅色主导和经营工作台优先原则。
