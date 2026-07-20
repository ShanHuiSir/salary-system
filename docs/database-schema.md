# 薪酬系统数据库表结构详细定义

> PostgreSQL 17 | 字符集 UTF-8 | 日期: 2026-07-15

---

## 目录

1. [命名规范](#1-命名规范)
2. [业务数据表](#2-业务数据表)
3. [系统表](#3-系统表)
4. [索引策略](#4-索引策略)
5. [视图与物化视图](#5-视图与物化视图)
6. [触发器](#6-触发器)
7. [初始数据脚本](#7-初始数据脚本)

---

## 1. 命名规范

| 规范 | 示例 |
|------|------|
| 表名：snake_case 复数 | `monthly_overviews` |
| 主键：`id` (UUID v7) | `id UUID PRIMARY KEY DEFAULT gen_uuid_v7()` |
| 外键：`{table_singular}_id` | `user_id` |
| 时间列：`_at` 后缀 | `created_at`, `updated_at` |
| 金额字段：`_cents` 后缀（分）或 `_wan`（万） | `total_revenue_wan` |
| 索引：`idx_{table}_{column}` | `idx_monthly_overviews_month` |

---

## 2. 业务数据表

### 2.1 monthly_overviews（月度总览）

```sql
CREATE TABLE monthly_overviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,           -- YYYY-MM
  total_revenue     DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 总业绩(万)
  self_operated_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 自营业绩(万)
  franchise_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 加盟业绩(万)
  platform_revenue  DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 线上业绩(万)
  factory_revenue   DECIMAL(12,2) DEFAULT 0,      -- 犀利产值(万)
  total_labor_cost  DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 总人力成本(万)

  -- 系统计算字段（自动生成，不可手动编辑）
  avg_salary        DECIMAL(10,2) GENERATED ALWAYS AS (
                      CASE WHEN derived_headcount > 0
                      THEN total_labor_cost / derived_headcount
                      ELSE 0 END
                    ) STORED,
  labor_cost_ratio  DECIMAL(10,4) GENERATED ALWAYS AS (
                      CASE WHEN total_revenue > 0
                      THEN (total_labor_cost / total_revenue) * 100
                      ELSE 0 END
                    ) STORED,
  per_capita_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  store_efficiency  DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- 环比/同比（由触发器或应用层计算）
  mom_revenue       DECIMAL(12,2) NOT NULL DEFAULT 0,
  yoy_revenue       DECIMAL(12,2) NOT NULL DEFAULT 0,
  mom_labor_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  yoy_labor_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 唯一约束：每月只有一条
  CONSTRAINT uq_monthly_overviews_month UNIQUE (month)
);

COMMENT ON TABLE monthly_overviews IS '月度总览数据';
```

### 2.2 departments（部门数据）

```sql
CREATE TABLE departments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  department        VARCHAR(20) NOT NULL,          -- 全公司|总部|自营|线上|犀利工厂|加盟
  headcount         INTEGER NOT NULL DEFAULT 0,    -- 人数
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0, -- 人力成本(万)

  -- 系统计算字段
  avg_salary        DECIMAL(10,2) NOT NULL DEFAULT 0,
  per_capita_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  store_efficiency  DECIMAL(10,2) DEFAULT 0,
  labor_cost_ratio  DECIMAL(10,4) NOT NULL DEFAULT 0,
  mom_labor_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  yoy_labor_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  mom_headcount     INTEGER NOT NULL DEFAULT 0,
  yoy_headcount     INTEGER NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_departments_month_dept UNIQUE (month, department)
);

COMMENT ON TABLE departments IS '部门级人力数据';
```

### 2.3 cost_compositions（成本构成）

```sql
CREATE TABLE cost_compositions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  department        VARCHAR(20) NOT NULL,          -- 总部|自营|线上|犀利工厂
  fixed_income      DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 固定收入(万)
  floating_income   DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 浮动收入(万)
  social_insurance  DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 社保公积金(万)
  severance         DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 经济补偿金(万)
  outsourcing       DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 外包费用(万)

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cost_compositions_month_dept UNIQUE (month, department)
);

COMMENT ON TABLE cost_compositions IS '各板块人力成本构成明细';
```

### 2.4 position_levels（职级数据）

```sql
CREATE TABLE position_levels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  department        VARCHAR(20) NOT NULL,          -- 总部|自营|犀利工厂
  level             VARCHAR(30) NOT NULL,          -- 职级名称
  headcount         INTEGER NOT NULL DEFAULT 0,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- 系统计算字段
  ratio             DECIMAL(10,4) NOT NULL DEFAULT 0,  -- 占部门比例
  mom_headcount     INTEGER NOT NULL DEFAULT 0,
  yoy_headcount     INTEGER NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_position_levels UNIQUE (month, department, level)
);

COMMENT ON TABLE position_levels IS '各职级人力成本数据';
```

### 2.5 store_regions（门店区域数据）

```sql
CREATE TABLE store_regions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  region            VARCHAR(30) NOT NULL,          -- 区域名称
  store_count       INTEGER NOT NULL DEFAULT 0,    -- 门店数
  revenue           DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 营收(万)
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 人力成本(万)

  -- 系统计算字段
  store_efficiency  DECIMAL(10,2) NOT NULL DEFAULT 0,  -- 店效
  person_efficiency DECIMAL(10,2) NOT NULL DEFAULT 0,  -- 人效
  mom_revenue       DECIMAL(12,2) NOT NULL DEFAULT 0,
  yoy_revenue       DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_store_regions UNIQUE (month, region)
);

COMMENT ON TABLE store_regions IS '各区域门店人效数据';
```

### 2.6 budget_labor_costs（预算人力成本）

```sql
CREATE TABLE budget_labor_costs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  segment           VARCHAR(20) NOT NULL,          -- 总部|自营|线上|犀利工厂
  center            VARCHAR(50) NOT NULL,          -- 中心
  department        VARCHAR(50) NOT NULL,          -- 部门
  business_line     VARCHAR(50) NOT NULL,          -- 业务线
  headcount         INTEGER NOT NULL DEFAULT 0,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,     -- 实际人力成本(万)
  budget_labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,     -- 预算人力成本(万)

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_budget_labor_costs UNIQUE (month, segment, center, department, business_line)
);

-- 使用率通过视图计算：labor_cost / budget_labor_cost * 100
COMMENT ON TABLE budget_labor_costs IS '预算与实际人力成本对比';
```

### 2.7 cost_structures（人力成本组成）

```sql
CREATE TABLE cost_structures (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month                    VARCHAR(7) NOT NULL,
  segment                  VARCHAR(20) NOT NULL,       -- 总部|自营|线上|犀利工厂

  -- 8 个薪资组成项（单位：万元）
  attendance_salary        DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 考勤工资
  performance_bonus        DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 效益奖金
  overtime_pay             DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 加班费
  annual_leave_allowance   DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 年假补贴
  sick_leave_pay           DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 病假工资
  maternity_leave_pay      DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 产假工资
  other_payable            DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 其他应发
  employer_social_insurance DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 单位社保公积金

  created_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cost_structures UNIQUE (month, segment)
);

COMMENT ON TABLE cost_structures IS '各板块人力成本组成明细（8项）';
```

### 2.8 hq_business_lines（总部业务线）

```sql
CREATE TABLE hq_business_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  business_line     VARCHAR(50) NOT NULL,          -- 业务线名称
  headcount         INTEGER NOT NULL DEFAULT 0,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  fixed_salary      DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 固定工资
  variable_salary   DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 变动工资
  social_benefits   DECIMAL(12,2) NOT NULL DEFAULT 0,  -- 社保福利
  ratio             DECIMAL(10,4) NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hq_business_lines UNIQUE (month, business_line)
);

COMMENT ON TABLE hq_business_lines IS '总部各业务线薪酬数据';
```

### 2.9 hq_depts（总部部门）

```sql
CREATE TABLE hq_depts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  department        VARCHAR(50) NOT NULL,
  business_line     VARCHAR(50) NOT NULL,
  headcount         INTEGER NOT NULL DEFAULT 0,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  fixed_salary      DECIMAL(12,2) NOT NULL DEFAULT 0,
  variable_salary   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ratio             DECIMAL(10,4) NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hq_depts UNIQUE (month, department)
);

COMMENT ON TABLE hq_depts IS '总部各部门薪酬明细';
```

### 2.10 platforms（各平台数据）

```sql
CREATE TABLE platforms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month             VARCHAR(7) NOT NULL,
  platform          VARCHAR(30) NOT NULL,          -- 抖音|小红书|天猫|京东|视频号
  headcount         INTEGER NOT NULL DEFAULT 0,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  fixed_salary      DECIMAL(12,2) NOT NULL DEFAULT 0,
  variable_salary   DECIMAL(12,2) NOT NULL DEFAULT 0,
  revenue           DECIMAL(12,2) NOT NULL DEFAULT 0,
  per_capita_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_platforms UNIQUE (month, platform)
);

COMMENT ON TABLE platforms IS '各线上平台数据';
```

---

## 3. 系统表

### 3.1 users（用户表）

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          VARCHAR(50) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  email             VARCHAR(255),
  role              VARCHAR(20) NOT NULL DEFAULT 'hr_staff',
                    -- super_admin | hr_admin | hr_staff | dept_manager | finance | auditor
  department_scope  JSONB DEFAULT '[]',            -- 部门权限范围
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  login_attempts    INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS '系统用户';
```

### 3.2 refresh_tokens（刷新令牌）

```sql
CREATE TABLE refresh_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash        VARCHAR(255) NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### 3.3 audit_logs（审计日志）

```sql
CREATE TABLE audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id),
  username          VARCHAR(50) NOT NULL,
  action            VARCHAR(30) NOT NULL,
                    -- create | update | delete | import | export | login | logout

  table_name        VARCHAR(50),                   -- 操作的表名
  record_id         UUID,                          -- 操作的记录ID
  changes           JSONB,                         -- 变更详情 [{field, oldValue, newValue}]
  ip_address        INET,
  user_agent        TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 3.4 field_configs（字段配置）

```sql
CREATE TABLE field_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type         VARCHAR(20) NOT NULL UNIQUE,   -- overview|department|composition|...
  fields_json       JSONB NOT NULL DEFAULT '[]',   -- 字段定义列表

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE field_configs IS '每种数据类型的字段定义（替代前端 FieldConfigContext）';
```

### 3.5 data_bindings（数据绑定配置）

```sql
CREATE TABLE data_bindings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paths_json        JSONB NOT NULL DEFAULT '[]',   -- DataPath[] 
  rules_json        JSONB NOT NULL DEFAULT '[]',   -- MatchingRule[]

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE data_bindings IS '数据取值路径与匹配规则配置';
```

### 3.6 data_locks（编辑锁）

```sql
CREATE TABLE data_locks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name        VARCHAR(50) NOT NULL,
  record_id         UUID NOT NULL,
  user_id           UUID NOT NULL REFERENCES users(id),
  locked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,

  CONSTRAINT uq_data_locks UNIQUE (table_name, record_id)
);

CREATE INDEX idx_data_locks_expires ON data_locks(expires_at);
```

---

## 4. 索引策略

```sql
-- === 业务表：月份 + 维度查询 ===
-- 几乎所有查询都按 month 过滤，部分加 department/segment

CREATE INDEX idx_overviews_month       ON monthly_overviews(month);
CREATE INDEX idx_departments_month     ON departments(month);
CREATE INDEX idx_departments_dept      ON departments(department);
CREATE INDEX idx_departments_month_dept ON departments(month, department);
CREATE INDEX idx_cost_compositions_md  ON cost_compositions(month, department);
CREATE INDEX idx_position_levels_md    ON position_levels(month, department);
CREATE INDEX idx_store_regions_month   ON store_regions(month);
CREATE INDEX idx_budget_labor_costs_ms ON budget_labor_costs(month, segment);
CREATE INDEX idx_budget_labor_costs_mc ON budget_labor_costs(month, center);
CREATE INDEX idx_cost_structures_ms    ON cost_structures(month, segment);
CREATE INDEX idx_hq_business_lines_m   ON hq_business_lines(month);
CREATE INDEX idx_hq_depts_m            ON hq_depts(month);
CREATE INDEX idx_platforms_m           ON platforms(month);

-- === 部分索引：只索引有数据的行 ===
CREATE INDEX idx_departments_not_full
  ON departments(month, department)
  WHERE department != '全公司';
```

---

## 5. 视图与物化视图

### 5.1 预算使用率视图

```sql
CREATE VIEW v_budget_usage AS
SELECT
  month,
  segment,
  center,
  department,
  business_line,
  headcount,
  labor_cost,
  budget_labor_cost,
  CASE WHEN budget_labor_cost > 0
    THEN ROUND((labor_cost / budget_labor_cost * 100)::numeric, 1)
    ELSE 0
  END AS usage_rate
FROM budget_labor_costs;
```

### 5.2 看板聚合视图（物化）

```sql
CREATE MATERIALIZED VIEW mv_dashboard_summary AS
WITH dept_summary AS (
  SELECT
    month,
    SUM(headcount) FILTER (WHERE department = '全公司') AS total_headcount,
    SUM(labor_cost) FILTER (WHERE department = '全公司') AS total_labor_cost,
    SUM(headcount) FILTER (WHERE department = '总部') AS hq_headcount,
    SUM(labor_cost) FILTER (WHERE department = '总部') AS hq_labor_cost,
    SUM(headcount) FILTER (WHERE department = '自营') AS self_headcount,
    SUM(labor_cost) FILTER (WHERE department = '自营') AS self_labor_cost,
    SUM(headcount) FILTER (WHERE department = '线上') AS online_headcount,
    SUM(labor_cost) FILTER (WHERE department = '线上') AS online_labor_cost,
    SUM(headcount) FILTER (WHERE department = '犀利工厂') AS factory_headcount,
    SUM(labor_cost) FILTER (WHERE department = '犀利工厂') AS factory_labor_cost
  FROM departments
  GROUP BY month
)
SELECT
  ov.month,
  ov.total_revenue,
  ov.total_labor_cost AS overview_labor_cost,
  ov.self_operated_revenue,
  ov.franchise_revenue,
  ov.platform_revenue,
  ov.factory_revenue,
  ov.labor_cost_ratio,
  ds.total_headcount,
  ds.hq_headcount, ds.hq_labor_cost,
  ds.self_headcount, ds.self_labor_cost,
  ds.online_headcount, ds.online_labor_cost,
  ds.factory_headcount, ds.factory_labor_cost
FROM monthly_overviews ov
LEFT JOIN dept_summary ds ON ov.month = ds.month;

CREATE UNIQUE INDEX idx_mv_dashboard_summary_month ON mv_dashboard_summary(month);

-- 刷新命令: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
```

---

## 6. 触发器

### 6.1 自动更新 updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有业务表创建触发器
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'monthly_overviews', 'departments', 'cost_compositions',
      'position_levels', 'store_regions', 'budget_labor_costs',
      'cost_structures', 'hq_business_lines', 'hq_depts', 'platforms',
      'users', 'field_configs', 'data_bindings'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;
```

### 6.2 自动写入审计日志

```sql
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
  changes_json JSONB := '[]';
BEGIN
  -- 仅记录实际变化的字段
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'field', key,
      'oldValue', old_val,
      'newValue', new_val
    ))
    FROM jsonb_each(to_jsonb(OLD)) AS o(key, old_val)
    JOIN jsonb_each(to_jsonb(NEW)) AS n(key, new_val) USING (key)
    WHERE o.old_val IS DISTINCT FROM n.new_val
      AND key NOT IN ('created_at', 'updated_at')
    INTO changes_json;
  ELSIF TG_OP = 'INSERT' THEN
    changes_json := jsonb_build_array(jsonb_build_object(
      'action', 'created',
      'values', to_jsonb(NEW) - 'created_at' - 'updated_at'
    ));
  END IF;

  INSERT INTO audit_logs (user_id, username, action, table_name, record_id, changes)
  VALUES (
    current_setting('app.current_user_id', true)::UUID,
    current_setting('app.current_username', true),
    LOWER(TG_OP),
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    changes_json
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

---

## 7. 初始数据脚本

### 7.1 默认管理员

```sql
-- 密码: admin123 (bcrypt hash)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '$2b$12$LJ3m4ys3K8FqZ8p0xGgS5e0Xr3fB8mN2kL7jH6pQ9wR1tY5uI0oP2', '系统管理员', 'super_admin');
```

### 7.2 默认字段配置

```sql
INSERT INTO field_configs (data_type, fields_json) VALUES
('overview', '[...]'),   -- 与前端 defaultFieldConfigs.overview 一致
('department', '[...]'), -- 与前端 defaultFieldConfigs.department 一致
('composition', '[...]'),
('position', '[...]'),
('store', '[...]'),
('budget', '[...]'),
('costStructure', '[...]');
```

---

## 8. ER 图（文字版）

```
users ────────────────┐
  │                   │ (created_by FK)
  │    ┌──────────────┼──────────────────────────────────────┐
  │    │              │                                      │
  ▼    ▼              ▼                                      ▼
audit_logs    ┌─ monthly_overviews ──────┐          field_configs
              │                          │          data_bindings
              ├─ departments             │          data_locks
              │    └─ (month FK ────────> monthly_overviews)
              ├─ cost_compositions       │
              │    └─ (month FK)
              ├─ position_levels         │
              │    └─ (month, department FK ──> departments)
              ├─ store_regions           │
              ├─ budget_labor_costs      │
              ├─ cost_structures         │
              ├─ hq_business_lines       │
              ├─ hq_depts                │
              └─ platforms               │
                                         │
refresh_tokens ──> users                 │
```

---

## 9. 容量预估

假设每月数据量：

| 表 | 月增行数 | 年增 | 索引大小/年 |
|------|---------|------|------------|
| monthly_overviews | 1 | 12 | < 1MB |
| departments | 6 | 72 | < 1MB |
| cost_compositions | 4 | 48 | < 1MB |
| position_levels | ~20 | 240 | < 1MB |
| store_regions | ~10 | 120 | < 1MB |
| budget_labor_costs | ~35 | 420 | ~2MB |
| cost_structures | 4 | 48 | < 1MB |
| hq_business_lines | ~8 | 96 | < 1MB |
| hq_depts | ~12 | 144 | < 1MB |
| platforms | ~5 | 60 | < 1MB |
| audit_logs | ~200 | ~2400 | ~5MB |

**5年数据量估算**：业务表 < 50MB，审计日志 ~25MB，完全适合单机 PostgreSQL。
