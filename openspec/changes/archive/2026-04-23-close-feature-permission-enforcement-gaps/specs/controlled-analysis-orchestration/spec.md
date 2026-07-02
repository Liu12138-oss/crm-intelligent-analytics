## ADDED Requirements

### Requirement: 系统必须对首次问数与继续追问执行独立动作校验
系统 MUST 对分析首次问数和继续追问执行独立动作校验。首次问数 MUST 以 `analysis.use` 作为最终放行条件；解释型追问、条件改写追问和基于既有结果包继续发起的新分析请求 MUST 以 `analysis.follow_up` 作为继续追问放行条件。系统 MUST 不得因为用户已经拥有首次问数资格就自动放开继续追问能力。

#### Scenario: 用户无首次问数权限时被阻断
- **WHEN** 某用户访问 Web 分析入口并提交新的经营分析问题，但未被授予 `analysis.use`
- **THEN** 系统必须拒绝本次分析执行
- **THEN** 不得仅因为其已登录或拥有分析页菜单资格而继续进入受控分析链路

#### Scenario: 用户无继续追问权限时不能基于已有结果继续分析
- **WHEN** 某用户拥有 `analysis.use`，但未被授予 `analysis.follow_up`，并在已有结果后继续输入解释型或改条件追问
- **THEN** 系统必须拒绝该追问执行
- **THEN** 不得因为其已经拿到上一轮结果而默认放开继续追问

### Requirement: 系统必须对导出结果执行统一动作与阈值双重校验
系统 MUST 在导出接口中先校验 `analysis.export` 与统一角色矩阵导出资格，再校验全局导出行数和次数阈值。旧的 `policy.exportRoleIds` 与 `user.exportAllowed` 若在迁移期继续存在，只可作为兼容附加条件，不得绕过统一动作权限结果。

#### Scenario: 用户缺少 analysis.export 时导出被阻断
- **WHEN** 某用户已完成分析，但未被授予 `analysis.export`
- **THEN** 系统必须拒绝其发起导出
- **THEN** 不得因为旧的导出角色配置或历史导出资格残留而继续放行

#### Scenario: 用户拥有 analysis.export 但超过阈值时仍被阻断
- **WHEN** 某用户已被授予 `analysis.export`，但本次导出超过单次行数上限或每日次数上限
- **THEN** 系统必须拒绝导出
- **THEN** 拒绝原因必须明确区分“权限不足”和“阈值超限”

### Requirement: 系统必须以 template.view 作为分析模板列表入口资格
系统 MUST 将分析页模板列表的可见性分成两层：用户是否有资格请求模板列表由 `template.view` 判定；某个模板资源是否对该用户可见仍由模板资源自身的 `visibleRoleIds`、状态等资源级条件判定。系统 MUST 不得继续仅凭旧的全局启用角色集合放行模板列表。

#### Scenario: 缺少 template.view 的用户模板列表为空
- **WHEN** 某用户未被授予 `template.view`，但请求分析页模板列表
- **THEN** 系统必须返回空模板结果或明确拒绝
- **THEN** 不得因为模板资源自身可见角色命中就返回模板列表

#### Scenario: 用户具备 template.view 但只看到资源级可见模板
- **WHEN** 某用户被授予 `template.view`，但部分模板资源并未将其角色包含在 `visibleRoleIds` 中
- **THEN** 系统必须只返回该用户在资源级也可见的模板
- **THEN** 不得因为用户具备模板查看动作就越过模板资源可见性边界
