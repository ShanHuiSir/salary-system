import type {
  DataPath,
  ConsistencyResult,
  ConsistencyStatus,
} from '@/types/dataBinding';
import type { PathVariables, DataSourceMap } from '@/utils/dataPathEngine';
import { resolveDataPath } from '@/utils/dataPathEngine';
import { dataTypeChineseLabels } from '@/types/dataBinding';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

/**
 * 一致性校验：对比看板显示值与路径解析值
 *
 * @param paths         数据取值路径列表
 * @param dataSources   数据源集合
 * @param vars          变量上下文
 * @param dashboardValues 看板实际显示值（由 DashboardPage 提供）
 */
export function checkConsistency(
  paths: DataPath[],
  dataSources: DataSourceMap,
  vars: PathVariables,
  dashboardValues: Record<string, number | null>
): ConsistencyResult[] {
  const now = new Date().toISOString();

  return paths
    .filter((p) => p.enabled)
    .map((path) => {
      const resolution = resolveDataPath(path, dataSources, vars);
      const sourceValue = resolution.resolvedValue;

      // 看板显示值：用 path.id 或 metricKey 查找
      const dashboardValue = dashboardValues[path.id] ?? dashboardValues[path.metricKey] ?? null;

      let status: ConsistencyStatus;
      let difference: number | null = null;
      let differencePercent: number | null = null;
      let message: string;

      if (sourceValue === null && dashboardValue === null) {
        status = 'no_data';
        message = '看板与源数据均无数据';
      } else if (sourceValue === null) {
        status = 'inconsistent';
        message = `源数据无匹配记录，但看板显示值为 ${dashboardValue?.toFixed(2)}`;
      } else if (dashboardValue === null) {
        status = 'no_data';
        message = `源数据计算值为 ${safeNum(sourceValue).toFixed(2)}，但看板未显示该指标`;
      } else {
        difference = dashboardValue - sourceValue;
        const baseValue = Math.abs(sourceValue) > 0.001 ? Math.abs(sourceValue) : 1;
        differencePercent = (difference / baseValue) * 100;

        // 容差判断：小于0.5% 或绝对差值小于0.01 认为一致
        if (Math.abs(differencePercent) < 0.5 || Math.abs(difference) < 0.01) {
          status = 'consistent';
          message = `一致：看板=${safeNum(dashboardValue).toFixed(2)}, 源=${safeNum(sourceValue).toFixed(2)}, 差值=${safeNum(difference).toFixed(4)}`;
        } else {
          status = 'inconsistent';
          message = `不一致：看板=${safeNum(dashboardValue).toFixed(2)}, 源=${safeNum(sourceValue).toFixed(2)}, 差值=${safeNum(difference).toFixed(2)} (${safeNum(differencePercent).toFixed(2)}%)`;
        }
      }

      return {
        pathId: path.id,
        metricKey: path.metricKey,
        metricLabel: path.metricLabel,
        dimension: path.dimension,
        status,
        dashboardValue,
        sourceValue,
        difference,
        differencePercent,
        message,
        lastChecked: now,
      };
    });
}

/**
 * 获取一致性校验摘要
 */
export function getConsistencySummary(results: ConsistencyResult[]) {
  return {
    total: results.length,
    consistent: results.filter((r) => r.status === 'consistent').length,
    inconsistent: results.filter((r) => r.status === 'inconsistent').length,
    noData: results.filter((r) => r.status === 'no_data').length,
    errors: results.filter((r) => r.status === 'error').length,
  };
}

/**
 * 生成校验结果的人类可读描述
 */
export function formatConsistencyResult(result: ConsistencyResult): string {
  const statusLabel = {
    consistent: '✓ 一致',
    inconsistent: '✗ 不一致',
    no_data: '— 无数据',
    error: '⚠ 错误',
    not_checked: '? 未检查',
  }[result.status];

  const valueInfo = result.dashboardValue !== null && result.sourceValue !== null
    ? `看板=${safeNum(result.dashboardValue).toFixed(2)}, 源=${safeNum(result.sourceValue).toFixed(2)}`
    : result.dashboardValue !== null
    ? `看板=${safeNum(result.dashboardValue).toFixed(2)}, 源=无`
    : result.sourceValue !== null
    ? `看板=无, 源=${safeNum(result.sourceValue).toFixed(2)}`
    : '均无数据';

  return `[${result.dimension}] ${result.metricLabel} ${statusLabel} — ${valueInfo}`;
}

/**
 * 为指定维度生成数据源集合的简化描述
 */
export function describeDataSource(dataSources: DataSourceMap): string {
  const parts: string[] = [];
  for (const [key, records] of Object.entries(dataSources)) {
    if (records.length > 0) {
      const label = dataTypeChineseLabels[key as keyof typeof dataTypeChineseLabels] ?? key;
      parts.push(`${label}: ${records.length}条`);
    }
  }
  return parts.join(', ');
}
