/**
 * 格式化工具
 *
 * 统一项目中的显示格式化函数，消除 DashboardPage、ReportPage、analysisEngine 中的重复定义。
 */

import { safeNum, roundTo } from './numberUtils';

/**
 * 格式化为"万元"显示
 *
 * @example
 * formatWan(1234.56)  // '1234.6万'
 * formatWan(null)     // '0.0万'
 */
export function formatWan(
  value: number | string | null | undefined,
  decimals = 1
): string {
  return `${safeNum(value).toFixed(decimals)}万`;
}

/**
 * 格式化为百分比显示
 *
 * @example
 * formatPct(12.345)  // '12.35%'
 * formatPct(0)       // '0.00%'
 */
export function formatPct(
  value: number | string | null | undefined,
  decimals = 2
): string {
  return `${safeNum(value).toFixed(decimals)}%`;
}

/**
 * 格式化为带符号的百分比（正数前加 +）
 *
 * @example
 * formatSignedPct(5.2)   // '+5.20%'
 * formatSignedPct(-3.1)  // '-3.10%'
 */
export function formatSignedPct(
  value: number,
  decimals = 2,
  suffix = '%'
): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${safeNum(value).toFixed(decimals)}${suffix}`;
}

/**
 * 格式化为人数显示
 *
 * @example
 * formatHeadcount(120)  // '120人'
 */
export function formatHeadcount(value: number | string | null | undefined): string {
  return `${safeNum(value)}人`;
}

/**
 * 格式化为百分点变化（pp）
 *
 * @example
 * formatPp(1.5)   // '+1.50pp'
 * formatPp(-0.5)  // '-0.50pp'
 */
export function formatPp(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${safeNum(value).toFixed(decimals)}pp`;
}

/**
 * 格式化数值（通用），处理 null/undefined
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 2,
  suffix = ''
): string {
  const n = safeNum(value);
  return `${n.toFixed(decimals)}${suffix}`;
}

/**
 * 格式化百分比变化值（pp 变化）
 * 用于环比/同比的百分比点变化
 */
export function formatPpChange(
  current: number,
  previous: number | null | undefined,
  decimals = 2
): string {
  if (previous == null) return '--';
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${roundTo(diff, decimals).toFixed(decimals)}pp`;
}

/**
 * 格式化绝对差值
 */
export function formatDiff(
  current: number,
  previous: number | null | undefined,
  decimals = 1,
  suffix = '万'
): string {
  if (previous == null) return '--';
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${roundTo(diff, decimals).toFixed(decimals)}${suffix}`;
}

/**
 * 格式化变化率
 */
export function formatChangeRate(
  current: number,
  previous: number,
  decimals = 1
): string {
  if (previous === 0) return '--';
  const rate = ((current - previous) / Math.abs(previous)) * 100;
  const sign = rate > 0 ? '+' : '';
  return `${sign}${roundTo(rate, decimals).toFixed(decimals)}%`;
}
