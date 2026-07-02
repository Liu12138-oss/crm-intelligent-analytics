## ADDED Requirements

### Requirement: 系统必须将合同审核基础访问与扩展访问统一收口到权限矩阵
系统 MUST 将合同审核能力拆分为“基础访问资格”和“扩展访问资格”两层。合同审核工作台、本人任务列表和本人任务详情 MUST 命中统一权限矩阵定义的合同审核基础访问资格；上传新合同 MUST 命中 `contract.review.upload`；查看他人任务详情 MUST 命中 `contract.review.cross_view`；下载他人审核产物 MUST 命中 `contract.review.cross_download`。系统 MUST 不得再只靠前端菜单显隐或“任务属于自己”作为唯一放行条件。

#### Scenario: 用户失去合同审核基础访问资格后本人任务入口被阻断
- **WHEN** 某用户被撤销合同审核基础访问资格后尝试访问合同审核工作台或本人任务详情
- **THEN** 系统必须拒绝该访问
- **THEN** 不得因为该任务历史上由该用户创建就继续默认放行

#### Scenario: 用户具备上传权限但不具备跨任务查看权限
- **WHEN** 某用户被授予 `contract.review.upload`，但未被授予 `contract.review.cross_view`
- **THEN** 系统必须允许其上传新合同并查看符合自身资格的任务
- **THEN** 系统必须拒绝其查看他人创建的合同审核任务详情

### Requirement: 系统必须对合同审核跨任务下载执行实时二次鉴权
系统 MUST 在每次合同审核产物下载时重新校验当前用户是否拥有 `contract.review.cross_download` 或符合当前基础访问资格，而不是仅依赖页面上已经展示的下载按钮。权限撤销后，历史页面中的旧链接和旧按钮 MUST 立即失效。

#### Scenario: 权限撤销后旧下载链接立即失效
- **WHEN** 某用户之前具备 `contract.review.cross_download`，后来该权限被撤销，并尝试再次使用旧的产物下载链接
- **THEN** 系统必须拒绝下载
- **THEN** 不得因为该链接是历史页面生成的就继续放行

#### Scenario: 上传者下载自己的产物仍需命中当前访问资格
- **WHEN** 上传者尝试下载自己任务生成的审核产物
- **THEN** 系统必须按当前合同审核基础访问资格或当前下载资格校验
- **THEN** 不得在用户被整体撤销合同审核访问资格后继续默认允许下载
