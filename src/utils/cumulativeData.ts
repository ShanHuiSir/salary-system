/**
 * 累计数据计算工具
 *
 * 从 DashboardPage.tsx 中提取的年度累计计算函数。
 * 支持从年初到指定月份的累计汇总。
 */

import type { DepartmentData, MonthlyOverview } from '@/types';
import { safeNum, safePercent } from './numberUtils';

/**
 * 获取累计月度总览：从年初到指定月份的各项指标累计
 */
export function getCumulativeOverview(
  overviews: MonthlyOverview[],
  targetMonth: string
): MonthlyOverview | null {
  const [year] = targetMonth.split('-');
  const monthsInYear = overviews
    .filter((o) => o.month.startsWith(year) && o.month <= targetMonth)
    .sort((a, b) => a.month.localeCompare(b.month));

  if (monthsInYear.length === 0) return null;

  const cumRevenue = monthsInYear.reduce((s, o) => s + safeNum(o.totalRevenue), 0);
  const cumSelfRevenue = monthsInYear.reduce((s, o) => s + safeNum(o.selfOperatedRevenue), 0);
  const cumFranchiseRevenue = monthsInYear.reduce((s, o) => s + safeNum(o.franchiseRevenue), 0);
  const cumPlatformRevenue = monthsInYear.reduce((s, o) => s + safeNum(o.platformRevenue), 0);
  const cumFactoryRevenue = monthsInYear.reduce((s, o) => s + safeNum(o.factoryRevenue), 0);
  const cumLaborCost = monthsInYear.reduce((s, o) => s + safeNum(o.totalLaborCost), 0);
  const cumLaborCostRatio = safePercent(cumLaborCost, cumRevenue, 2);

  // 人数用最后一个月的快照值（不是累计）
  const latestInPeriod = monthsInYear[monthsInYear.length - 1];

  return {
    id: `cum-${targetMonth}`,
    month: targetMonth,
    totalRevenue: cumRevenue,
    selfOperatedRevenue: cumSelfRevenue,
    franchiseRevenue: cumFranchiseRevenue,
    platformRevenue: cumPlatformRevenue,
    factoryRevenue: cumFactoryRevenue,
    totalLaborCost: cumLaborCost,
    avgSalary: safeNum(latestInPeriod.avgSalary),
    laborCostRatio: cumLaborCostRatio,
    perCapitaRevenue: latestInPeriod.totalLaborCost > 0
      ? (cumRevenue / cumLaborCost) * safeNum(latestInPeriod.avgSalary)
      : 0,
    storeEfficiency: safeNum(latestInPeriod.storeEfficiency),
    momRevenue: safeNum(latestInPeriod.momRevenue),
    yoyRevenue: safeNum(latestInPeriod.yoyRevenue),
    momLaborCost: safeNum(latestInPeriod.momLaborCost),
    yoyLaborCost: safeNum(latestInPeriod.yoyLaborCost),
  };
}

/**
 * 获取去年同期累计数据
 */
export function getPrevYearCumulativeOverview(
  overviews: MonthlyOverview[],
  targetMonth: string
): MonthlyOverview | null {
  const [year, m] = targetMonth.split('-');
  const prevYearMonth = `${parseInt(year) - 1}-${m}`;
  return getCumulativeOverview(overviews, prevYearMonth);
}

/**
 * 获取累计部门数据：从年初到指定月份的累计人力成本，人数取快照
 */
export function getCumulativeDeptData(
  departments: DepartmentData[],
  targetMonth: string,
  deptKey: DepartmentData['department']
): DepartmentData | null {
  const [year] = targetMonth.split('-');
  const monthsInYear = departments
    .filter(
      (d) =>
        d.month.startsWith(year) &&
        d.month <= targetMonth &&
        d.department === deptKey
    )
    .sort((a, b) => a.month.localeCompare(b.month));

  if (monthsInYear.length === 0) return null;

  const cumLaborCost = monthsInYear.reduce((s, d) => s + safeNum(d.laborCost), 0);
  const latestInPeriod = monthsInYear[monthsInYear.length - 1];

  return {
    id: `cum-dept-${targetMonth}-${deptKey}`,
    month: targetMonth,
    department: deptKey,
    headcount: safeNum(latestInPeriod.headcount),
    laborCost: cumLaborCost,
    avgSalary: safeNum(latestInPeriod.avgSalary),
    perCapitaRevenue: safeNum(latestInPeriod.perCapitaRevenue),
    storeEfficiency: safeNum(latestInPeriod.storeEfficiency),
    // 部门累计数据没有收入分母，沿用期末月的成本占比快照，避免伪造累计比率。
    laborCostRatio: safeNum(latestInPeriod.laborCostRatio),
    momLaborCost: safeNum(latestInPeriod.momLaborCost),
    yoyLaborCost: safeNum(latestInPeriod.yoyLaborCost),
    momHeadcount: safeNum(latestInPeriod.momHeadcount),
    yoyHeadcount: safeNum(latestInPeriod.yoyHeadcount),
  };
}

/**
 * 计算累计趋势数据：返回年初到目标月份每月的累计值数组
 * 用于折线图展示
 */
export function getCumulativeTrendData(
  overviews: MonthlyOverview[],
  targetMonth: string
): { month: string; 累计业绩: number; 累计人力成本: number }[] {
  const [year] = targetMonth.split('-');
  const monthsInYear = overviews
    .filter((o) => o.month.startsWith(year) && o.month <= targetMonth)
    .sort((a, b) => a.month.localeCompare(b.month));

  let cumRevenue = 0;
  let cumLaborCost = 0;

  return monthsInYear.map((o) => {
    cumRevenue += safeNum(o.totalRevenue);
    cumLaborCost += safeNum(o.totalLaborCost);
    return {
      month: o.month,
      累计业绩: cumRevenue,
      累计人力成本: cumLaborCost,
    };
  });
}
