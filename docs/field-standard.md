# 字段规范（数据看板、CSV 与 API）

本规范以 **2026-07-17** 起的新建/导出数据为准，用于避免表单、CSV、看板、API 与数据库出现同义不同名。

## 1. 命名规则

- **前端与 API**：使用 `lowerCamelCase`，例如 `franchiseRevenue`、`totalLaborCost`。
- **PostgreSQL 列**：使用 `snake_case`，例如 `franchise_revenue`、`total_labor_cost`。
- **金额单位**：所有带 `(万)` 的数值字段单位均为人民币 **万元**；百分比字段以 `0–100` 表示，不使用 `0–1` 小数。
- **月份**：统一使用 `YYYY-MM`，例如 `2026-07`。
- `id`、`createdAt`、`updatedAt` 为系统字段；派生指标（如 `avgSalary`、环比、同比、使用率）由系统计算，不应作为人工导入的事实数据。

## 2. 业务维度

`department` 的规范值为：`总部`、`自营`、`加盟`、`线上`、`犀利工厂`；`全公司`仅用于汇总层级。

各数据表可因业务范围使用其中的子集，但不得用“代理”“代理区域”等同义值替代 `加盟`。

## 3. 指标口径

| 字段键名 | 规范展示名 | 说明 |
| --- | --- | --- |
| `totalRevenue` | 总业绩(万) | 不含工厂产值；与现有总览计算口径一致。 |
| `selfOperatedRevenue` | 自营业绩(万) | 自营板块业绩。 |
| `franchiseRevenue` | 加盟业绩(万) | 加盟板块业绩；不再使用“代理业绩”。 |
| `platformRevenue` | 线上业绩(万) | 线上板块业绩。 |
| `factoryRevenue` | 犀利产值(万) | 工厂产值；当前总业绩口径不包含该字段。 |
| `totalLaborCost` / `laborCost` | 人力成本(万) | 总览使用前者，明细使用后者。 |
| `fixedIncome` / `floatingIncome` | 固定收入(万) / 浮动收入(万) | 成本构成口径，不与业务线报表的工资拆分直接混用。 |
| `socialInsurance` | 社保公积金(万) | 成本构成口径。 |

## 4. CSV 兼容策略

CSV 模板始终从 `src/types/fieldConfig.ts` 生成，避免维护第二份列清单。导入时仍兼容 `franchiseRevenue` 的历史列名：`代理业绩`、`代理区域业绩`（含/不含 `(万)`）及英文键名。

> 兼容仅用于过渡；后续导出和人工新建文件请使用“加盟业绩(万)”。

## 5. 后端接入约束

后端 Prisma 模型固定后，不能把前端任意自定义字段直接写入业务表。若需要自由扩展字段，应单独设计 `custom_fields`/`custom_field_values` 或 JSONB 扩展字段，并制定版本化的 API 契约。
