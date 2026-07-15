/**
 * 通用数字处理工具
 *
 * 本文件统一了项目中多处重复定义的 safeNum 函数。
 * 之前分布在：DashboardPage, analysisEngine, dataPathEngine, matchingEngine,
 *             consistencyChecker, ReportPage, DataBindingPage, segmentAnalysis
 * 现在已经统一到此处，所有地方通过 import 引用。
 */

/**
 * 安全地将任意值转换为数字，null/undefined/空字符串/NaN 回退为 fallback。
 *
 * @param value - 任意输入值
 * @param fallback - 转换失败时的默认值，默认 0
 * @returns 安全转换后的数值
 *
 * @example
 * safeNum(123)           // 123
 * safeNum("456.78")      // 456.78
 * safeNum(null)          // 0
 * safeNum("")            // 0
 * safeNum(undefined, -1) // -1
 * safeNum("1,234.56")    // 1234.56 (处理千分位逗号)
 */
export function safeNum(
  value: number | string | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : value;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

/**
 * 安全除法，分母为 0 时返回 0 而非 Infinity/NaN
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  precision = 2
): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  return roundTo(numerator / denominator, precision);
}

/**
 * 计算百分比比率 (a / b) * 100，分母为 0 返回 0
 */
export function safePercent(
  numerator: number,
  denominator: number,
  precision = 2
): number {
  if (denominator === 0) return 0;
  return roundTo((numerator / denominator) * 100, precision);
}

/**
 * 计算变化率：((current - prev) / |prev|) * 100
 * prev 为 0 时返回 null
 */
export function safeChangeRate(
  current: number,
  prev: number,
  precision = 2
): number | null {
  if (prev === 0 || !Number.isFinite(current) || !Number.isFinite(prev)) {
    return null;
  }
  return roundTo(((current - prev) / Math.abs(prev)) * 100, precision);
}

/**
 * 四舍五入到指定小数位
 */
export function roundTo(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  return parseFloat(value.toFixed(precision));
}

/**
 * 判断值是否为"空"（undefined / null / 空字符串）
 */
export function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

/**
 * 转换为数字（宽松模式，不处理逗号）
 * 用于 salaryCalculations.ts 已有的 toNumber 函数
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    const parsed = parseFloat(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
