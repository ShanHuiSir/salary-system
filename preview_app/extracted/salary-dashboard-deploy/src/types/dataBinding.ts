import type { DataType } from '@/types';

// ============ 数据取值路径 ============

/** 看板维度 */
export type DashboardDimension = '总览' | '总部' | '自营' | '线上' | '犀利工厂' | '全公司';

/** 聚合方式 */
export type AggregationType =
  | 'sum'          // 求和
  | 'avg'          // 平均
  | 'max'          // 最大值
  | 'min'          // 最小值
  | 'snapshot'     // 快照（取最后一条）
  | 'count'        // 计数
  | 'derived'      // 派生计算（由公式得出）
  | 'cumulative';  // 累计

/** 过滤操作符 */
export type FilterOperator =
  | 'equals'       // 等于
  | 'not_equals'   // 不等于
  | 'in'           // 包含于（逗号分隔列表）
  | 'not_in'       // 不包含于
  | 'range'        // 范围（格式: min,max）
  | 'contains'     // 包含子串
  | 'starts_with'  // 以...开头
  | 'gt'           // 大于
  | 'lt'           // 小于
  | 'gte'          // 大于等于
  | 'lte';         // 小于等于

/** 过滤条件 */
export interface PathFilter {
  id: string;
  field: string;           // 过滤字段名（如 month, department, segment）
  operator: FilterOperator; // 操作符
  value: string;           // 过滤值（in/range 用逗号分隔）
  description?: string;    // 人类可读描述
}

/** 数据取值路径 */
export interface DataPath {
  id: string;
  metricKey: string;             // 指标键名，如 'totalLaborCost'
  metricLabel: string;           // 指标显示名，如 '总人力成本'
  dimension: DashboardDimension;  // 所属看板维度
  sourceType: DataType;           // 数据源类型
  sourceField: string;            // 数据源字段
  filters: PathFilter[];          // 过滤条件
  aggregation: AggregationType;   // 聚合方式
  derivedFormula?: string;         // derived 类型时的公式描述
  description?: string;            // 路径描述
  enabled: boolean;                // 是否启用
}

// ============ 数值匹配规则 ============

/** 匹配类型 */
export type MatchType =
  | 'exact'   // 精确匹配：值完全相等
  | 'range'   // 范围匹配：源值在目标值±容差范围内
  | 'fuzzy';  // 模糊匹配：字符串包含关系

/** 数值匹配规则 */
export interface MatchingRule {
  id: string;
  name: string;               // 规则名称
  sourceType: DataType;       // 源数据类型
  sourceField: string;        // 源字段
  targetType: DataType;        // 目标数据类型（看板侧）
  targetField: string;        // 目标字段
  matchType: MatchType;       // 匹配类型
  matchField: string;         // 用于匹配的关联字段（如 month, department）
  tolerance?: number;         // 范围匹配时的容差百分比（默认 5%）
  description?: string;       // 规则描述
  enabled: boolean;           // 是否启用
}

// ============ 一致性校验 ============

/** 校验状态 */
export type ConsistencyStatus =
  | 'consistent'    // 一致
  | 'inconsistent'  // 不一致
  | 'no_data'       // 无数据
  | 'error'         // 计算错误
  | 'not_checked';  // 未检查

/** 一致性校验结果 */
export interface ConsistencyResult {
  pathId: string;
  metricKey: string;
  metricLabel: string;
  dimension: DashboardDimension;
  status: ConsistencyStatus;
  dashboardValue: number | null;    // 看板显示值
  sourceValue: number | null;       // 源数据计算值
  difference: number | null;         // 差值
  differencePercent: number | null;  // 差值百分比
  message: string;                   // 校验说明
  lastChecked: string;               // 校验时间 ISO
}

/** 路径解析结果 */
export interface PathResolution {
  pathId: string;
  matchedRecords: number;      // 匹配到的记录数
  resolvedValue: number | null; // 解析出的值
  records: Record<string, unknown>[]; // 匹配的原始记录（用于调试）
  trace: string;                // 人类可读的取值路径描述
}

// ============ 数据类型中文标签 ============

export const dataTypeChineseLabels: Record<DataType, string> = {
  overview: '月度总览',
  department: '部门数据',
  composition: '成本构成',
  position: '职级数据',
  store: '门店/区域数据',
  budget: '预算人力成本',
  costStructure: '人力成本组成',
};

export const aggregationLabels: Record<AggregationType, string> = {
  sum: '求和',
  avg: '平均',
  max: '最大值',
  min: '最小值',
  snapshot: '快照（取最后一条）',
  count: '计数',
  derived: '派生计算',
  cumulative: '年度累计',
};

export const filterOperatorLabels: Record<FilterOperator, string> = {
  equals: '等于',
  not_equals: '不等于',
  in: '包含于',
  not_in: '不包含于',
  range: '范围',
  contains: '包含',
  starts_with: '以...开头',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
};

export const matchTypeLabels: Record<MatchType, string> = {
  exact: '精确匹配',
  range: '范围匹配',
  fuzzy: '模糊匹配',
};

// ============ 默认数据取值路径 ============

export const defaultDataPaths: DataPath[] = [
  // ===== 总览维度 =====
  {
    id: 'path-overview-revenue',
    metricKey: 'totalRevenue',
    metricLabel: '总业绩',
    dimension: '总览',
    sourceType: 'overview',
    sourceField: 'totalRevenue',
    filters: [{ id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}', description: '当前选中月份' }],
    aggregation: 'snapshot',
    description: '从月度总览数据中读取当前月份的总业绩',
    enabled: true,
  },
  {
    id: 'path-overview-labor-cost',
    metricKey: 'totalLaborCost',
    metricLabel: '总人力成本',
    dimension: '总览',
    sourceType: 'overview',
    sourceField: 'totalLaborCost',
    filters: [{ id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' }],
    aggregation: 'snapshot',
    derivedFormula: '直接从月度总览读取',
    description: '从月度总览中读取当前月份的总人力成本（已含全公司合计）',
    enabled: true,
  },
  {
    id: 'path-overview-headcount',
    metricKey: 'headcount',
    metricLabel: '总人数',
    dimension: '总览',
    sourceType: 'overview',
    sourceField: 'derivedHeadcount',
    filters: [{ id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' }],
    aggregation: 'derived',
    derivedFormula: 'sum(各部门headcount)',
    description: '从月度总览读取总人数（如不存在则汇总部门数据各板块人数）',
    enabled: true,
  },
  {
    id: 'path-overview-ratio',
    metricKey: 'laborCostRatio',
    metricLabel: '人力成本占比',
    dimension: '总览',
    sourceType: 'overview',
    sourceField: 'laborCostRatio',
    filters: [{ id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' }],
    aggregation: 'snapshot',
    derivedFormula: '直接从月度总览读取',
    description: '从月度总览读取当前月份的人力成本占比',
    enabled: true,
  },
  // ===== 总部维度 =====
  {
    id: 'path-hq-headcount',
    metricKey: 'headcount',
    metricLabel: '人数',
    dimension: '总部',
    sourceType: 'department',
    sourceField: 'headcount',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '总部' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取总部当月人数',
    enabled: true,
  },
  {
    id: 'path-hq-labor-cost',
    metricKey: 'laborCost',
    metricLabel: '人力成本',
    dimension: '总部',
    sourceType: 'department',
    sourceField: 'laborCost',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '总部' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取总部当月人力成本',
    enabled: true,
  },
  {
    id: 'path-hq-ratio',
    metricKey: 'laborCostRatio',
    metricLabel: '人力成本占比',
    dimension: '总部',
    sourceType: 'department',
    sourceField: 'laborCostRatio',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '总部' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取总部当月人力成本占比',
    enabled: true,
  },
  // ===== 自营维度 =====
  {
    id: 'path-self-headcount',
    metricKey: 'headcount',
    metricLabel: '人数',
    dimension: '自营',
    sourceType: 'department',
    sourceField: 'headcount',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '自营' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取自营当月人数',
    enabled: true,
  },
  {
    id: 'path-self-labor-cost',
    metricKey: 'laborCost',
    metricLabel: '人力成本',
    dimension: '自营',
    sourceType: 'department',
    sourceField: 'laborCost',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '自营' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取自营当月人力成本',
    enabled: true,
  },
  // ===== 线上维度 =====
  {
    id: 'path-online-headcount',
    metricKey: 'headcount',
    metricLabel: '人数',
    dimension: '线上',
    sourceType: 'department',
    sourceField: 'headcount',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '线上' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取线上当月人数',
    enabled: true,
  },
  {
    id: 'path-online-labor-cost',
    metricKey: 'laborCost',
    metricLabel: '人力成本',
    dimension: '线上',
    sourceType: 'department',
    sourceField: 'laborCost',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '线上' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取线上当月人力成本',
    enabled: true,
  },
  // ===== 犀利工厂维度 =====
  {
    id: 'path-factory-headcount',
    metricKey: 'headcount',
    metricLabel: '人数',
    dimension: '犀利工厂',
    sourceType: 'department',
    sourceField: 'headcount',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '犀利工厂' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取犀利工厂当月人数',
    enabled: true,
  },
  {
    id: 'path-factory-labor-cost',
    metricKey: 'laborCost',
    metricLabel: '人力成本',
    dimension: '犀利工厂',
    sourceType: 'department',
    sourceField: 'laborCost',
    filters: [
      { id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' },
      { id: 'f2', field: 'department', operator: 'equals', value: '犀利工厂' },
    ],
    aggregation: 'snapshot',
    description: '从部门数据中取犀利工厂当月人力成本',
    enabled: true,
  },
  // ===== 预算使用率 =====
  {
    id: 'path-overview-budget-usage',
    metricKey: 'budgetUsageRate',
    metricLabel: '预算使用率',
    dimension: '总览',
    sourceType: 'budget',
    sourceField: 'laborCost',
    filters: [{ id: 'f1', field: 'month', operator: 'equals', value: '${selectedMonth}' }],
    aggregation: 'derived',
    derivedFormula: 'sum(laborCost) / sum(budgetLaborCost) * 100',
    description: '从预算数据汇总实际人力成本与预算人力成本，计算使用率',
    enabled: true,
  },
];

// ============ 默认匹配规则 ============

export const defaultMatchingRules: MatchingRule[] = [
  {
    id: 'rule-month-exact',
    name: '月份精确匹配',
    sourceType: 'department',
    sourceField: 'month',
    targetType: 'overview',
    targetField: 'month',
    matchType: 'exact',
    matchField: 'month',
    description: '部门数据与月度总览按月份精确匹配',
    enabled: true,
  },
  {
    id: 'rule-dept-segment',
    name: '部门-板块关联匹配',
    sourceType: 'department',
    sourceField: 'department',
    targetType: 'budget',
    targetField: 'segment',
    matchType: 'exact',
    matchField: 'department',
    description: '部门数据的 department 字段与预算数据的 segment 字段精确匹配',
    enabled: true,
  },
  {
    id: 'rule-budget-range',
    name: '预算人力成本范围匹配',
    sourceType: 'department',
    sourceField: 'laborCost',
    targetType: 'budget',
    targetField: 'budgetLaborCost',
    matchType: 'range',
    matchField: 'month',
    tolerance: 10,
    description: '部门实际人力成本与预算人力成本按月份关联，允许10%范围偏差',
    enabled: true,
  },
  {
    id: 'rule-composition-fuzzy',
    name: '成本构成模糊匹配',
    sourceType: 'composition',
    sourceField: 'department',
    targetType: 'department',
    targetField: 'department',
    matchType: 'fuzzy',
    matchField: 'department',
    description: '成本构成数据与部门数据按部门名称模糊匹配',
    enabled: true,
  },
];
