# 账号权限与数据导入说明

## 数据迁移原则

从同事本地系统迁移数据到服务器时，只导入源数据字段，不以本地系统计算后的派生字段为准。服务器会在写入后按固定公式重新计算平均薪资、人力成本率、人效、环比、同比等指标，保证所有用户看到同一套口径。

导入前必须先备份服务器数据库。全量导入或清空操作只能由 `super_admin` 执行。

## 批量导入后的计算

`POST /api/v1/data/:dataType/batch` 批量导入成功后，会按导入数据涉及的月份触发服务器公式重算。适用于以下数据类型：

- `overview`：月度总览
- `department`：部门数据
- `position`：职级数据
- `store`：门店/区域数据

其它类型会直接保存源数据，后续如有固定公式，可继续在后端计算服务中补充。

## 角色权限矩阵

| 角色 | 中文名称 | 看板/报表 | 数据管理 | 系统配置 | 账号管理 | 典型用途 |
| --- | --- | --- | --- | --- | --- | --- |
| `super_admin` | 超级管理员 | 全部可看 | 全部数据新增、导入、编辑、单条删除、全量清空、恢复初始数据 | 字段配置、数据绑定、看板排版 | 全部账号；系统至少保留 1 个启用超级管理员 | 系统所有者、最终管理员 |
| `hr_admin` | HR 管理员 | 全部可看 | 全部数据新增、导入、编辑、单条删除；不能全量清空/恢复初始数据 | 字段配置、数据绑定、看板排版 | 可管理非超级管理员账号 | HR 负责人、系统日常管理员 |
| `hr_staff` | HR 专员 | 全部可看 | 可维护 HR 相关数据；可新增、导入、编辑，不能删除/清空 | 无 | 无 | 日常维护薪资、部门、职级、门店等源数据 |
| `finance` | 财务 | 全部可看 | 可维护财务相关数据；可新增、导入、编辑，不能删除/清空 | 无 | 无 | 维护预算、人力成本组成、成本构成等财务口径数据 |
| `dept_manager` | 部门负责人 | 只读看板和报表 | 无 | 无 | 无 | 部门负责人查看分析结果，不允许改数据 |
| `auditor` | 审计/只读 | 只读看板和报表 | 无 | 无 | 无 | 审计、老板、外部只读查看 |

## 数据类型写入范围

| 角色 | 可新增/导入/编辑的数据类型 | 可删除单条 | 可清空全部 |
| --- | --- | --- | --- |
| `super_admin` | 月度总览、部门数据、成本构成、职级数据、门店/区域数据、预算人力成本、人力成本组成、总部业务线、总部部门、平台数据 | 全部 | 可以 |
| `hr_admin` | 月度总览、部门数据、成本构成、职级数据、门店/区域数据、预算人力成本、人力成本组成、总部业务线、总部部门、平台数据 | 全部 | 不可以 |
| `hr_staff` | 月度总览、部门数据、成本构成、职级数据、门店/区域数据、人力成本组成、总部业务线、总部部门、平台数据 | 不可以 | 不可以 |
| `finance` | 月度总览、成本构成、预算人力成本、人力成本组成 | 不可以 | 不可以 |
| `dept_manager` | 无 | 不可以 | 不可以 |
| `auditor` | 无 | 不可以 | 不可以 |

## 数据看板只读账号

如果希望某个账号只能看数据看板/报表、不能进入任何操作页：

1. 在账号管理中将角色设置为 `审计/只读`。
2. 在部门范围中填写 `数据看板`。
3. 保存后让该账号退出并重新登录。

带有 `数据看板` 部门范围的账号，即使角色误选为 HR 或财务，后端也会按“看板/报表只读”处理，禁止写入数据和系统配置。

## 账号管理 API

所有账号管理接口都需要登录，并且只允许 `super_admin` 或 `hr_admin` 访问。

### 创建账号

```bash
curl -X POST 'https://你的域名/api/v1/users' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "hr01",
    "password": "ChangeMe123",
    "displayName": "HR 专员 01",
    "role": "hr_staff",
    "departmentScope": []
  }'
```

### 查询账号

```bash
curl 'https://你的域名/api/v1/users?page=1&pageSize=50' \
  -H 'Authorization: Bearer <accessToken>'
```

### 修改角色或停用状态

```bash
curl -X PUT 'https://你的域名/api/v1/users/<userId>' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"finance","isActive":true}'
```

### 重置密码

```bash
curl -X POST 'https://你的域名/api/v1/users/<userId>/password' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"password":"NewPassword123"}'
```

### 停用账号

```bash
curl -X DELETE 'https://你的域名/api/v1/users/<userId>' \
  -H 'Authorization: Bearer <accessToken>'
```

## 当前安全限制

- 停用账号后，后端认证会立即拒绝该账号的新请求。
- 修改角色、停用账号、重置密码后，会撤销该账号的 refresh token。
- 不能停用当前登录账号。
- 系统至少保留一个启用状态的 `super_admin`。
- `hr_admin` 不能创建、修改或停用 `super_admin`。
