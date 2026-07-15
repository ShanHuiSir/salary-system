import type { DataType } from '@/types';
import type {
  DataPath,
  PathFilter,
  PathResolution,
  AggregationType,
  FilterOperator,
} from '@/types/dataBinding';
import { dataTypeChineseLabels, aggregationLabels, filterOperatorLabels } from '@/types/dataBinding';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

/** 变量上下文：用于解析 ${selectedMonth} 等占位符 */
export type PathVariables = Record<string, string | number>;

/** 数据源集合：从 DataContext 传入的全部业务数据 */
export type DataSourceMap = Record<DataType, Record<string, unknown>[]>;

/**
 * 解析占位符变量，如 ${selectedMonth} → 实际值
 */
function resolveValue(raw: string, vars: PathVariables): string {
  return raw.replace(/\$\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v !== undefined ? String(v) : '';
  });
}

/**
 * 应用单个过滤条件判断一条记录是否匹配
 */
function matchesFilter(record: Record<string, unknown>, filter: PathFilter, vars: PathVariables): boolean {
  const fieldValue = record[filter.field];
  const filterValue = resolveValue(filter.value, vars);

  if (fieldValue === undefined || fieldValue === null) return false;

  const fieldStr = String(fieldValue);
  const fieldNum = typeof fieldValue === 'number' ? fieldValue : parseFloat(fieldStr);
  const filterNum = parseFloat(filterValue);

  switch (filter.operator) {
    case 'equals':
      return fieldStr === filterValue || fieldNum === filterNum;
    case 'not_equals':
      return fieldStr !== filterValue && fieldNum !== filterNum;
    case 'in': {
      const list = filterValue.split(',').map((s) => s.trim());
      return list.includes(fieldStr) || list.some((item) => parseFloat(item) === fieldNum);
    }
    case 'not_in': {
      const list = filterValue.split(',').map((s) => s.trim());
      return !list.includes(fieldStr) && !list.some((item) => parseFloat(item) === fieldNum);
    }
    case 'range': {
      const [min, max] = filterValue.split(',').map((s) => parseFloat(s.trim()));
      if (Number.isNaN(min) || Number.isNaN(max)) return false;
      return fieldNum >= min && fieldNum <= max;
    }
    case 'contains':
      return fieldStr.includes(filterValue);
    case 'starts_with':
      return fieldStr.startsWith(filterValue);
    case 'gt':
      return !Number.isNaN(filterNum) && fieldNum > filterNum;
    case 'lt':
      return !Number.isNaN(filterNum) && fieldNum < filterNum;
    case 'gte':
      return !Number.isNaN(filterNum) && fieldNum >= filterNum;
    case 'lte':
      return !Number.isNaN(filterNum) && fieldNum <= filterNum;
    default:
      return true;
  }
}

/**
 * 应用全部过滤条件筛选记录
 */
function applyFilters(
  records: Record<string, unknown>[],
  filters: PathFilter[],
  vars: PathVariables
): Record<string, unknown>[] {
  if (!filters || filters.length === 0) return records;
  return records.filter((record) =>
    filters.every((filter) => matchesFilter(record, filter, vars))
  );
}

/**
 * 执行派生公式计算
 * 支持的公式模式：
 * - "fieldA / fieldB * 100" → 对每条记录求和后计算比率
 * - "sum(fieldA) / sum(fieldB) * 100" → 分别求和后计算比率
 * - "sum(fieldA)" → 直接求和
 */
function computeDerived(
  records: Record<string, unknown>[],
  formula: string
): number | null {
  if (records.length === 0) return null;

  // 解析 sum(field) / sum(field) * 100 格式
  const ratioMatch = formula.match(/sum\((\w+)\)\s*\/\s*sum\((\w+)\)\s*\*\s*100/);
  if (ratioMatch) {
    const [, fieldA, fieldB] = ratioMatch;
    const sumA = sumField(records, fieldA);
    const sumB = sumField(records, fieldB);
    if (sumA === null || sumB === null || sumB === 0) return null;
    return (sumA / sumB) * 100;
  }

  // 解析 fieldA / fieldB * 100 格式（对记录求和后计算比率）
  const simpleRatioMatch = formula.match(/(\w+)\s*\/\s*(\w+)\s*\*\s*100/);
  if (simpleRatioMatch) {
    const [, fieldA, fieldB] = simpleRatioMatch;
    const sumA = sumField(records, fieldA);
    const sumB = sumField(records, fieldB);
    if (sumA === null || sumB === null || sumB === 0) return null;
    return (sumA / sumB) * 100;
  }

  // 解析 sum(field) 格式
  const sumMatch = formula.match(/sum\((\w+)\)/);
  if (sumMatch) {
    const [, field] = sumMatch;
    return sumField(records, field);
  }

  // 回退：尝试将公式当作字段名直接求和
  return sumField(records, formula.trim());
}

/** 对记录中指定字段求和 */
function sumField(records: Record<string, unknown>[], field: string): number | null {
  const values = records
    .map((r) => r[field])
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((n) => !Number.isNaN(n));

  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

/**
 * 执行聚合计算
 */
function aggregate(
  records: Record<string, unknown>[],
  field: string,
  aggregation: AggregationType
): number | null {
  if (records.length === 0) return null;

  const values = records
    .map((r) => r[field])
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((n) => !Number.isNaN(n));

  if (values.length === 0) return null;

  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    case 'snapshot':
      return values[values.length - 1];
    case 'count':
      return values.length;
    case 'cumulative':
      return values.reduce((a, b) => a + b, 0);
    case 'derived':
      // derived 类型由 resolveDataPath 中的 computeDerived 处理，此处不应被调用
      return null;
    default:
      return null;
  }
}

/**
 * 生成人类可读的取值路径描述
 */
function buildTrace(path: DataPath, matchedCount: number, resolvedValue: number | null): string {
  const parts: string[] = [];
  parts.push(`数据源: ${dataTypeChineseLabels[path.sourceType]}`);
  parts.push(`字段: ${path.sourceField}`);
  if (path.filters.length > 0) {
    const filterDescs = path.filters.map((f) => {
      const op = filterOperatorLabels[f.operator];
      const val = f.value.includes('${') ? f.value : f.value;
      return `${f.field} ${op} ${val}`;
    });
    parts.push(`过滤: ${filterDescs.join(' & ')}`);
  }
  parts.push(`聚合: ${aggregationLabels[path.aggregation]}`);
  if (path.derivedFormula) {
    parts.push(`公式: ${path.derivedFormula}`);
  }
  parts.push(`匹配记录: ${matchedCount} 条`);
  parts.push(`解析值: ${resolvedValue !== null ? safeNum(resolvedValue).toFixed(2) : '无数据'}`);
  return parts.join(' → ');
}

/**
 * 解析单条数据取值路径，返回解析值和追踪信息
 */
export function resolveDataPath(
  path: DataPath,
  dataSources: DataSourceMap,
  vars: PathVariables
): PathResolution {
  const sourceRecords = dataSources[path.sourceType] ?? [];
  const filtered = applyFilters(sourceRecords, path.filters, vars);

  // derived 类型使用公式引擎计算
  let resolvedValue: number | null;
  if (path.aggregation === 'derived' && path.derivedFormula) {
    resolvedValue = computeDerived(filtered, path.derivedFormula);
  } else {
    resolvedValue = aggregate(filtered, path.sourceField, path.aggregation);
  }

  const trace = buildTrace(path, filtered.length, resolvedValue);

  return {
    pathId: path.id,
    matchedRecords: filtered.length,
    resolvedValue,
    records: filtered,
    trace,
  };
}

/**
 * 批量解析多条数据取值路径
 */
export function resolveDataPaths(
  paths: DataPath[],
  dataSources: DataSourceMap,
  vars: PathVariables
): PathResolution[] {
  return paths
    .filter((p) => p.enabled)
    .map((p) => resolveDataPath(p, dataSources, vars));
}

/**
 * 根据维度和指标键名查找数据路径
 */
export function findPath(
  paths: DataPath[],
  dimension: string,
  metricKey: string
): DataPath | undefined {
  return paths.find((p) => p.dimension === dimension && p.metricKey === metricKey && p.enabled);
}

/**
 * 根据维度查找所有数据路径
 */
export function findPathsByDimension(paths: DataPath[], dimension: string): DataPath[] {
  return paths.filter((p) => p.dimension === dimension && p.enabled);
}

/**
 * 获取过滤操作符列表（用于 UI 下拉选择）
 */
export function getFilterOperatorOptions(): { value: FilterOperator; label: string }[] {
  return (Object.keys(filterOperatorLabels) as FilterOperator[]).map((op) => ({
    value: op,
    label: filterOperatorLabels[op],
  }));
}
