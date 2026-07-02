## 1. 规格与文档对齐

- [x] 1.1 完成 OpenSpec proposal、design 和 capability specs，明确 CRM 官方 API 优先、数据库兜底受控与认证链路冻结边界
- [x] 1.2 更新 `README.md`、`AGENTS.md` 与 `docs/architecture/crm-intelligent-analytics.md`，固化仓库级协作约束
- [x] 1.3 更新 `specs/001-crm-intelligent-analytics/spec.md`、`plan.md`、`quickstart.md`，并确认 `data-model.md`、`contracts/openapi.yaml` 当前无需改动

## 2. 存量非认证能力盘点

- [x] 2.1 盘点 `analysis`、`wecom`、`query-assets`、`governance`、`audit`、`export` 等非认证模块的 CRM 接入方式
- [x] 2.2 为每项存量能力标记当前属于“官方 API / 自建接口 / 数据库路径”的哪一种，并补充收敛建议
- [x] 2.3 输出首批需要优先整改的存量非认证能力名单，明确本轮不调整 `auth` 模块

## 3. 后续变更执行门槛

- [x] 3.1 为后续需求建立“CRM 官方 API 可用性检查 + 兜底说明”模板
- [x] 3.2 在新增或改造非认证功能前，补充 API 缺口、权限继承、审计与回退方案
- [x] 3.3 在方案评审中增加校验项，防止继续新增无说明的 CRM 数据库直连路径
