# 薪酬系统后端 API 详细设计

> 版本: 1.0.0 | 日期: 2026-07-15 | 基础路径: `/api/v1`

---

## 1. 总体设计原则

| 原则 | 说明 |
|------|------|
| RESTful | 资源导向 URL，HTTP 方法表示动作 |
| JSON 交互 | 请求/响应体统一使用 JSON |
| JWT 认证 | 无状态 Token，Header: `Authorization: Bearer <token>` |
| 统一响应 | 所有响应使用标准信封格式 |
| 分页 | 列表接口默认分页，`page` + `pageSize` |
| 版本管理 | URL 版本 `/api/v1/` |

### 1.1 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "requestId": "uuid"
}
```

| code | 含义 |
|------|------|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 1002 | 未认证 |
| 1003 | 无权限 |
| 1004 | 资源不存在 |
| 1005 | 业务规则校验失败 |
| 5000 | 服务器内部错误 |

---

## 2. 认证模块

### 2.1 登录

```
POST /api/v1/auth/login
```

**请求体：**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 7200,
    "user": {
      "id": "u-001",
      "username": "admin",
      "displayName": "系统管理员",
      "role": "super_admin",
      "avatar": null
    }
  }
}
```

### 2.2 刷新 Token

```
POST /api/v1/auth/refresh
```

**请求体：**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

### 2.3 登出

```
POST /api/v1/auth/logout
```

### 2.4 获取当前用户信息

```
GET /api/v1/auth/me
```

---

## 3. 用户与权限管理

### 3.1 角色定义

| 角色 | code | 权限范围 |
|------|------|---------|
| 超级管理员 | `super_admin` | 全部权限 |
| HR 管理员 | `hr_admin` | 数据编辑 + 报表查看 + 用户管理 |
| HR 专员 | `hr_staff` | 数据编辑 + 报表查看（限所属板块） |
| 部门主管 | `dept_manager` | 本部门数据只读 |
| 财务 | `finance` | 薪资数据查看 + 导出 |
| 审计员 | `auditor` | 全部只读 + 操作日志 |

### 3.2 用户列表

```
GET /api/v1/users?page=1&pageSize=20&search=&role=
```

### 3.3 创建用户

```
POST /api/v1/users
```

**请求体：**
```json
{
  "username": "zhangsan",
  "password": "initial123",
  "displayName": "张三",
  "role": "hr_staff",
  "departmentScope": ["总部", "自营"],
  "email": "zhangsan@company.com"
}
```

### 3.4 更新用户

```
PUT /api/v1/users/:userId
```

### 3.5 删除用户（软删除）

```
DELETE /api/v1/users/:userId
```

---

## 4. 数据 CRUD 模块

所有数据类型的 CRUD 接口采用统一模式。以 `数据类别` 指代：`overviews | departments | compositions | positions | stores | budgets | costStructures | hqBusinessLines | hqDepts | platforms`

### 4.1 查询列表

```
GET /api/v1/data/:dataType?month=2026-05&department=总部&page=1&pageSize=50
```

**查询参数（通用）：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| month | string | 否 | 月份过滤 YYYY-MM |
| department | string | 否 | 部门过滤 |
| segment | string | 否 | 板块过滤 |
| search | string | 否 | 模糊搜索 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 50，最大 200 |
| sortBy | string | 否 | 排序字段 |
| sortOrder | string | 否 | asc / desc |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [ ... ],
    "total": 156,
    "page": 1,
    "pageSize": 50,
    "totalPages": 4
  }
}
```

### 4.2 查询单条

```
GET /api/v1/data/:dataType/:id
```

### 4.3 新增

```
POST /api/v1/data/:dataType
```

**请求体示例（月度总览）：**
```json
{
  "month": "2026-06",
  "totalRevenue": 4500.5,
  "selfOperatedRevenue": 2800.0,
  "franchiseRevenue": 800.0,
  "platformRevenue": 700.0,
  "factoryRevenue": 200.5,
  "totalLaborCost": 920.3
}
```

> **注意**：`avgSalary`、`laborCostRatio`、`perCapitaRevenue`、`mom*`、`yoy*` 等系统计算字段不需要传入，后端自动计算。

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "ov-2026-06-001",
    "month": "2026-06",
    "totalRevenue": 4500.5,
    "avgSalary": 0.78,
    "laborCostRatio": 20.45,
    ...
  }
}
```

### 4.4 批量新增

```
POST /api/v1/data/:dataType/batch
```

**请求体：**
```json
{
  "items": [ { ... }, { ... } ],
  "skipInvalid": true,
  "validateOnly": false
}
```

### 4.5 更新

```
PUT /api/v1/data/:dataType/:id
```

### 4.6 删除

```
DELETE /api/v1/data/:dataType/:id
```

### 4.7 批量删除

```
POST /api/v1/data/:dataType/batch-delete
```

**请求体：**
```json
{
  "ids": ["id-1", "id-2", "id-3"]
}
```

---

## 5. 导入导出模块

### 5.1 CSV 导入

```
POST /api/v1/data/:dataType/import
```

**请求格式**: `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | CSV 文件 (≤10MB) |
| encoding | string | `utf-8` / `gbk`，默认自动检测 |
| skipInvalid | boolean | 是否跳过无效行 |
| validateOnly | boolean | 仅校验不导入 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "total": 120,
    "success": 115,
    "skipped": 5,
    "errors": [
      { "row": 23, "field": "headcount", "message": "人数必须为数字" }
    ]
  }
}
```

### 5.2 导出数据

```
GET /api/v1/data/:dataType/export?month=2026-05&format=csv
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| format | csv / xlsx | csv |
| month | 月份过滤 | - |
| fields | 导出字段（逗号分隔） | 全部 |

### 5.3 下载导入模板

```
GET /api/v1/data/:dataType/template
```

返回 CSV 模板文件。

---

## 6. 报表模块

### 6.1 固浮比报表

```
GET /api/v1/reports/fixed-variable?scope=hq&month=2026-05
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "scope": "总部",
    "month": "2026-05",
    "summary": {
      "fixedIncome": 450.2,
      "floatingIncome": 180.5,
      "socialInsurance": 95.3,
      "severance": 12.0,
      "outsourcing": 30.0,
      "totalLaborCost": 768.0,
      "fixedVariableRatio": "71:29"
    },
    "monthlyTrend": [ ... ],
    "businessLines": [ ... ]
  }
}
```

### 6.2 业务线报表

```
GET /api/v1/reports/business-line?scope=self&month=2026-05&view=current
```

### 6.3 部门报表

```
GET /api/v1/reports/department?scope=hq&month=2026-05&view=current
```

### 6.4 层级报表

```
GET /api/v1/reports/level?scope=hq&month=2026-05
```

### 6.5 区域人效报表

```
GET /api/v1/reports/region-efficiency?scope=self&month=2026-05
```

### 6.6 平台报表

```
GET /api/v1/reports/platform?scope=online&month=2026-05
```

### 6.7 人力成本对比表

```
GET /api/v1/reports/cost-comparison?month=2026-05
```

### 6.8 看板聚合数据

```
GET /api/v1/dashboard/summary?month=2026-05&dimension=总览&view=current
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "dimension": "总览",
    "month": "2026-05",
    "kpi": {
      "totalRevenue": 4652.6,
      "totalLaborCost": 973.6,
      "laborCostRatio": 20.93,
      "headcount": 1190,
      "momRevenue": 2.3,
      "yoyRevenue": 5.1,
      "momLaborCost": 1.5,
      "yoyLaborCost": 8.2
    },
    "segments": [ ... ],
    "charts": {
      "trend": [ ... ],
      "deptComparison": [ ... ],
      "compositionStack": [ ... ]
    },
    "analysis": { ... }
  }
}
```

---

## 7. 系统计算模块

### 7.1 触发薪资数据重算

当数据变更后，系统自动重算派生字段。此接口用于手动触发全量重算。

```
POST /api/v1/system/recalculate
```

**请求体：**
```json
{
  "dataTypes": ["overviews", "departments"],
  "month": "2026-06"
}
```

### 7.2 公式验证

```
POST /api/v1/system/validate-formula
```

**请求体：**
```json
{
  "expression": "laborCost / budgetLaborCost * 100",
  "dataType": "budget"
}
```

---

## 8. 审计日志

### 8.1 查询操作日志

```
GET /api/v1/audit-logs?page=1&pageSize=50&userId=&action=&dataType=&startDate=&endDate=
```

**响应项：**
```json
{
  "id": "log-001",
  "userId": "u-001",
  "username": "admin",
  "action": "update",
  "dataType": "overviews",
  "recordId": "ov-2026-05-001",
  "changes": [
    { "field": "totalRevenue", "oldValue": "4500.0", "newValue": "4652.6" }
  ],
  "ip": "192.168.1.100",
  "timestamp": "2026-07-15T10:30:00Z"
}
```

---

## 9. 系统配置

### 9.1 获取字段配置

```
GET /api/v1/config/fields
```

### 9.2 更新字段配置

```
PUT /api/v1/config/fields
```

### 9.3 获取数据绑定配置

```
GET /api/v1/config/data-binding
```

### 9.4 更新数据绑定配置

```
PUT /api/v1/config/data-binding
```

---

## 10. WebSocket 事件（可选）

用于多人协作时的实时数据同步。

| 事件 | 方向 | 说明 |
|------|------|------|
| `data:updated` | Server → Client | 数据被其他用户修改 |
| `data:deleted` | Server → Client | 数据被其他用户删除 |
| `user:online` | Server → Client | 在线用户列表更新 |
| `lock:acquired` | Server → Client | 某条记录被其他用户锁定编辑 |

---

## 11. 安全设计

### 11.1 认证流程

```
Client                          Server
  │                               │
  │  POST /auth/login             │
  │  { username, password }       │
  │ ─────────────────────────────>│
  │                               │ 验证密码 (bcrypt)
  │                               │ 生成 accessToken (JWT, 2h)
  │                               │ 生成 refreshToken (JWT, 7d)
  │  { accessToken, refreshToken }│
  │ <─────────────────────────────│
  │                               │
  │  GET /data/overviews          │
  │  Authorization: Bearer <AT>   │
  │ ─────────────────────────────>│
  │                               │ 验证 JWT 签名 + 过期
  │                               │ 检查角色权限
  │  { code:0, data: [...] }      │
  │ <─────────────────────────────│
```

### 11.2 密码策略

- 最小长度 8 位
- 必须包含字母 + 数字
- bcrypt hash (cost=12)
- 登录失败 5 次锁定 15 分钟
- 密码 90 天过期提醒

### 11.3 数据安全

- 传输层：TLS 1.3 强制
- 存储层：薪资敏感字段可配置加密存储 (AES-256-GCM)
- 访问控制：基于角色的行级权限（部门主管只能看本部门数据）
- 审计：所有写操作记录完整变更前后值

---

## 12. 接口完整清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新Token |
| POST | `/api/v1/auth/logout` | 登出 |
| GET | `/api/v1/auth/me` | 当前用户 |
| GET | `/api/v1/users` | 用户列表 |
| POST | `/api/v1/users` | 创建用户 |
| PUT | `/api/v1/users/:id` | 更新用户 |
| DELETE | `/api/v1/users/:id` | 删除用户 |
| GET | `/api/v1/data/:type` | 数据列表 |
| GET | `/api/v1/data/:type/:id` | 数据详情 |
| POST | `/api/v1/data/:type` | 新增数据 |
| POST | `/api/v1/data/:type/batch` | 批量新增 |
| PUT | `/api/v1/data/:type/:id` | 更新数据 |
| DELETE | `/api/v1/data/:type/:id` | 删除数据 |
| POST | `/api/v1/data/:type/batch-delete` | 批量删除 |
| POST | `/api/v1/data/:type/import` | CSV导入 |
| GET | `/api/v1/data/:type/export` | 导出数据 |
| GET | `/api/v1/data/:type/template` | 下载模板 |
| GET | `/api/v1/reports/fixed-variable` | 固浮比报表 |
| GET | `/api/v1/reports/business-line` | 业务线报表 |
| GET | `/api/v1/reports/department` | 部门报表 |
| GET | `/api/v1/reports/level` | 层级报表 |
| GET | `/api/v1/reports/region-efficiency` | 区域人效报表 |
| GET | `/api/v1/reports/platform` | 平台报表 |
| GET | `/api/v1/reports/cost-comparison` | 人力成本对比表 |
| GET | `/api/v1/dashboard/summary` | 看板聚合数据 |
| POST | `/api/v1/system/recalculate` | 触发重算 |
| POST | `/api/v1/system/validate-formula` | 公式验证 |
| GET | `/api/v1/audit-logs` | 审计日志 |
| GET | `/api/v1/config/fields` | 字段配置 |
| PUT | `/api/v1/config/fields` | 更新字段配置 |
| GET | `/api/v1/config/data-binding` | 数据绑定配置 |
| PUT | `/api/v1/config/data-binding` | 更新数据绑定配置 |
