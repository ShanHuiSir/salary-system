import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LayoutGrid, Link2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SegmentOverviewCard } from '@/components/dashboard/SegmentOverviewCard';
import { AnalysisPanel } from '@/components/dashboard/AnalysisPanel';
import { DashboardCustomizer, useDashboardLayout } from '@/components/dashboard/DashboardCustomizer';
import { DataPathTracer } from '@/components/dashboard/DataPathTracer';
import type { DataSourceMap } from '@/utils/dataPathEngine';
import { useData } from '@/contexts/DataContext';
import type { DepartmentData, MonthlyOverview } from '@/types';
import { getDeptSortIndex } from '@/types';
import { generateSegmentAnalysis, generateOverviewAnalysis } from '@/utils/analysisEngine';
import { generateSegmentCardAnalysis, getSegmentDataSource } from '@/utils/segmentAnalysis';

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4'];

/**
 * 安全格式化数字（null/undefined 会被当作 0）
 * 防止 e.toFixed is not a function 错误
 */
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

function formatWan(value: number | null | undefined) {
  return `${safeNum(value).toFixed(1)}万`;
}
function formatPct(value: number | null | undefined) {
  return `${safeNum(value).toFixed(2)}%`;
}

type Dimension = '总览' | '总部' | '自营区域' | '线上' | '犀利工厂';

const DIMENSION_MAP: Record<Dimension, DepartmentData['department']> = {
  总览: '全公司',
  总部: '总部',
  自营区域: '自营',
  线上: '线上',
  犀利工厂: '犀利工厂',
};

const DIMENSIONS: Dimension[] = ['总览', '总部', '自营区域', '线上', '犀利工厂'];

type ViewMode = 'current' | 'cumulative';

// 获取月份的中文标签
function getMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
}

// 获取累计数据：从年初到指定月份的汇总
function getCumulativeOverview(overviews: MonthlyOverview[], targetMonth: string): MonthlyOverview | null {
  const [year] = targetMonth.split('-');
  const monthsInYear = overviews
    .filter((o) => o.month.startsWith(year) && o.month <= targetMonth)
    .sort((a, b) => a.month.localeCompare(b.month));

  if (monthsInYear.length === 0) return null;

  const cumRevenue = monthsInYear.reduce((s, o) => s + o.totalRevenue, 0);
  const cumSelfRevenue = monthsInYear.reduce((s, o) => s + o.selfOperatedRevenue, 0);
  const cumFranchiseRevenue = monthsInYear.reduce((s, o) => s + o.franchiseRevenue, 0);
  const cumPlatformRevenue = monthsInYear.reduce((s, o) => s + o.platformRevenue, 0);
  const cumFactoryRevenue = monthsInYear.reduce((s, o) => s + (o.factoryRevenue ?? 0), 0);
  const cumLaborCost = monthsInYear.reduce((s, o) => s + o.totalLaborCost, 0);
  const cumLaborCostRatio = cumRevenue > 0 ? (cumLaborCost / cumRevenue) * 100 : 0;

  // 人数用最后一个月的值（快照，不是累计）
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
    avgSalary: latestInPeriod.avgSalary,
    laborCostRatio: cumLaborCostRatio,
    perCapitaRevenue: cumRevenue / latestInPeriod.totalLaborCost * latestInPeriod.avgSalary,
    storeEfficiency: latestInPeriod.storeEfficiency,
    momRevenue: latestInPeriod.momRevenue,
    yoyRevenue: latestInPeriod.yoyRevenue,
    momLaborCost: latestInPeriod.momLaborCost,
    yoyLaborCost: latestInPeriod.yoyLaborCost,
  };
}

// 获取去年同期累计数据
function getPrevYearCumulativeOverview(overviews: MonthlyOverview[], targetMonth: string): MonthlyOverview | null {
  const [year, m] = targetMonth.split('-');
  const prevYearMonth = `${parseInt(year) - 1}-${m}`;
  return getCumulativeOverview(overviews, prevYearMonth);
}

// 获取累计部门数据
function getCumulativeDeptData(
  departments: DepartmentData[],
  targetMonth: string,
  deptKey: DepartmentData['department']
): DepartmentData | null {
  const [year] = targetMonth.split('-');
  const monthsInYear = departments
    .filter((d) => d.month.startsWith(year) && d.month <= targetMonth && d.department === deptKey)
    .sort((a, b) => a.month.localeCompare(b.month));

  if (monthsInYear.length === 0) return null;

  const cumLaborCost = monthsInYear.reduce((s, d) => s + d.laborCost, 0);
  const latestInPeriod = monthsInYear[monthsInYear.length - 1];

  return {
    id: `cum-dept-${targetMonth}-${deptKey}`,
    month: targetMonth,
    department: deptKey,
    headcount: latestInPeriod.headcount,
    laborCost: cumLaborCost,
    avgSalary: latestInPeriod.avgSalary,
    perCapitaRevenue: latestInPeriod.perCapitaRevenue,
    storeEfficiency: latestInPeriod.storeEfficiency,
    laborCostRatio: cumLaborCost > 0 ? latestInPeriod.laborCostRatio : 0,
    momLaborCost: latestInPeriod.momLaborCost,
    yoyLaborCost: latestInPeriod.yoyLaborCost,
    momHeadcount: latestInPeriod.momHeadcount,
    yoyHeadcount: latestInPeriod.yoyHeadcount,
  };
}

export function DashboardPage() {
  const { overviews: rawOverviews, departments, compositions, positions, stores, budgets, costStructures, loadedFromStorage, loading, syncError } = useData();
  
  // ===== 数据联动诊断 =====
  useEffect(() => {
    console.log('[DashboardPage] 数据更新:', {
      rawOverviews: rawOverviews.length,
      departments: departments.length,
      compositions: compositions.length,
      totalRecords: rawOverviews.length + departments.length + compositions.length + positions.length + stores.length + budgets.length,
    });
    if (rawOverviews.length > 0) {
      console.log('[DashboardPage] 最新月度总览 (前2条):', rawOverviews.slice(0, 2).map(o => ({
        month: o.month,
        id: o.id,
        totalRevenue: o.totalRevenue,
        totalLaborCost: o.totalLaborCost,
        laborCostRatio: o.laborCostRatio,
      })));
    } else {
      console.warn('[DashboardPage] ⚠ rawOverviews 为空！数据看板可能未联动数据管理模块。');
    }
  }, [rawOverviews, departments, compositions, positions, stores, budgets]);
  
  const layout = useDashboardLayout();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const navigate = useNavigate();
  const isBlockVisible = (id: string) => layout.isVisible(id);
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== 核心联动：优先使用月度总览数据，部门数据缺失月份用部门数据回退派生 =====
  // 用户希望看板 KPI 从月度总览取值：
  //   - 总业绩（totalRevenue）→ 仅月度总览有，缺失则 0
  //   - 总人力成本 → 优先月度总览 totalLaborCost；缺失则汇总部门数据
  //   - 总人数 → 优先部门「全公司」；缺失则汇总各部门
  //   - 人力成本占比 → 优先月度总览 laborCostRatio；缺失则实时计算
  // 这样用户在「数据管理」编辑月度总览或部门数据后，看板实时更新
  const overviews = useMemo(() => {
    const allMonths = new Set<string>([
      ...rawOverviews.map((o) => o.month),
      ...departments.map((d) => d.month),
    ]);
    return Array.from(allMonths).map((month) => {
      const original = rawOverviews.find((o) => o.month === month);
      const monthDepts = departments.filter((d) => d.month === month);
      const companyDept = monthDepts.find((d) => d.department === '全公司');
      const segmentDepts = monthDepts.filter((d) => d.department !== '全公司');

      // 总人力成本：优先月度总览；缺失时回退到部门数据
      const derivedLaborCost = original
        ? original.totalLaborCost
        : companyDept
        ? companyDept.laborCost
        : segmentDepts.reduce((s, d) => s + d.laborCost, 0);

      // 总人数：优先部门「全公司」；缺失时汇总各部门
      const derivedHeadcount = companyDept
        ? companyDept.headcount
        : segmentDepts.reduce((s, d) => s + d.headcount, 0);

      // 业绩：仅月度总览有
      const totalRevenue = original?.totalRevenue ?? 0;

      // 人力成本占比：优先月度总览；缺失时实时计算
      const laborCostRatio = original
        ? original.laborCostRatio
        : totalRevenue > 0
        ? (derivedLaborCost / totalRevenue) * 100
        : 0;

      return {
        id: original?.id ?? `derived-${month}`,
        month,
        totalRevenue,
        selfOperatedRevenue: original?.selfOperatedRevenue ?? 0,
        franchiseRevenue: original?.franchiseRevenue ?? 0,
        platformRevenue: original?.platformRevenue ?? 0,
        factoryRevenue: original?.factoryRevenue ?? 0,
        totalLaborCost: derivedLaborCost,
        avgSalary: derivedHeadcount > 0 ? derivedLaborCost / derivedHeadcount : 0,
        laborCostRatio,
        perCapitaRevenue: derivedHeadcount > 0 ? totalRevenue / derivedHeadcount : 0,
        storeEfficiency: original?.storeEfficiency ?? 0,
        momRevenue: original?.momRevenue ?? 0,
        yoyRevenue: original?.yoyRevenue ?? 0,
        momLaborCost: original?.momLaborCost ?? 0,
        yoyLaborCost: original?.yoyLaborCost ?? 0,
      } as MonthlyOverview;
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [rawOverviews, departments]);

  const dimension = (DIMENSIONS.includes(searchParams.get('dimension') as Dimension)
    ? searchParams.get('dimension')
    : '总览') as Dimension;
  const deptKey = DIMENSION_MAP[dimension];
  const isOverview = dimension === '总览';

  const viewMode = (searchParams.get('view') === 'cumulative' ? 'cumulative' : 'current') as ViewMode;

  // 提取所有可用月份
  const availableMonths = useMemo(
    () => [...new Set(overviews.map((o) => o.month))].sort((a, b) => b.localeCompare(a)),
    [overviews]
  );

  // 当前选中的月份（默认最新）
  const selectedMonth = searchParams.get('month') || availableMonths[0] || '2026-05';

  const handleMonthChange = (month: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('month', month);
    setSearchParams(params, { replace: true });
  };

  const handleViewModeChange = (mode: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', mode);
    setSearchParams(params, { replace: true });
  };

  // ===== 当期数据 =====
  const sortedOverviews = useMemo(
    () => [...overviews].sort((a, b) => a.month.localeCompare(b.month)),
    [overviews]
  );

  // 当前月份的overview
  const currentOverview = useMemo(
    () => overviews.find((o) => o.month === selectedMonth),
    [overviews, selectedMonth]
  );

  // 上个月的overview
  const previousOverview = useMemo(() => {
    if (!selectedMonth) return undefined;
    const [year, m] = selectedMonth.split('-').map(Number);
    const prevMonth = m === 1
      ? `${year - 1}-12`
      : `${year}-${String(m - 1).padStart(2, '0')}`;
    return overviews.find((o) => o.month === prevMonth);
  }, [overviews, selectedMonth]);

  // 去年同月的overview
  const previousYearOverview = useMemo(() => {
    if (!selectedMonth) return undefined;
    const [year, m] = selectedMonth.split('-').map(Number);
    const prevMonth = `${year - 1}-${String(m).padStart(2, '0')}`;
    return overviews.find((o) => o.month === prevMonth);
  }, [overviews, selectedMonth]);

  // 当前月份的部门数据序列
  const deptSeries = useMemo(() => {
    return [...departments]
      .filter((d) => d.department === deptKey)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [departments, deptKey]);

  const currentDept = useMemo(
    () => departments.find((d) => d.month === selectedMonth && d.department === deptKey),
    [departments, selectedMonth, deptKey]
  );

  const previousDept = useMemo(() => {
    if (!selectedMonth) return undefined;
    const [year, m] = selectedMonth.split('-').map(Number);
    const prevMonth = m === 1
      ? `${year - 1}-12`
      : `${year}-${String(m - 1).padStart(2, '0')}`;
    return departments.find((d) => d.month === prevMonth && d.department === deptKey);
  }, [departments, selectedMonth, deptKey]);

  // ===== 累计数据 =====
  const cumulativeOverview = useMemo(
    () => getCumulativeOverview(overviews, selectedMonth),
    [overviews, selectedMonth]
  );

  const prevYearCumulativeOverview = useMemo(
    () => getPrevYearCumulativeOverview(overviews, selectedMonth),
    [overviews, selectedMonth]
  );

  const cumulativeDept = useMemo(
    () => getCumulativeDeptData(departments, selectedMonth, deptKey),
    [departments, selectedMonth, deptKey]
  );

  const prevYearCumulativeDept = useMemo(() => {
    if (!selectedMonth) return null;
    const [year, m] = selectedMonth.split('-');
    const prevYearMonth = `${parseInt(year) - 1}-${m}`;
    return getCumulativeDeptData(departments, prevYearMonth, deptKey);
  }, [departments, selectedMonth, deptKey]);

  // 累计趋势数据：年初到选定月份的每月累计值
  const cumulativeTrendData = useMemo(() => {
    if (!selectedMonth) return [];
    const [year] = selectedMonth.split('-');
    const monthsInYear = overviews
      .filter((o) => o.month.startsWith(year) && o.month <= selectedMonth)
      .sort((a, b) => a.month.localeCompare(b.month));

    let cumRevenue = 0;
    let cumLaborCost = 0;
    return monthsInYear.map((o) => {
      cumRevenue += o.totalRevenue;
      cumLaborCost += o.totalLaborCost;
      return {
        month: o.month,
        累计业绩: cumRevenue,
        累计人力成本: cumLaborCost,
      };
    });
  }, [overviews, selectedMonth]);

  // ===== 共用数据 =====
  const compositionChartData = useMemo(() => {
    const targetDept = viewMode === 'cumulative' ? cumulativeDept : currentDept;
    if (!targetDept) return [];
    const comp = compositions.find((c) => c.month === selectedMonth && c.department === deptKey);
    if (!comp) return [];
    return [
      { name: '固定收入', value: comp.fixedIncome },
      { name: '浮动收入', value: comp.floatingIncome },
      { name: '社保公积金', value: comp.socialInsurance },
      { name: '经济补偿金', value: comp.severance },
      { name: '外包费用', value: comp.outsourcing },
    ].filter((d) => d.value > 0);
  }, [compositions, selectedMonth, deptKey, viewMode, currentDept, cumulativeDept]);

  const positionChartData = useMemo(() => {
    const targetMonthForPositions = viewMode === 'cumulative' ? selectedMonth : selectedMonth;
    if (!targetMonthForPositions) return [];
    return positions
      .filter((p) => p.month === targetMonthForPositions && p.department === deptKey)
      .map((p) => ({ name: p.level, 人力成本: p.laborCost, 人数: p.headcount, 占比: p.ratio }))
      .sort((a, b) => b.人力成本 - a.人力成本);
  }, [positions, selectedMonth, deptKey, viewMode]);

  const trendData = useMemo(() => {
    return deptSeries.map((d) => ({
      month: d.month,
      人力成本: d.laborCost,
      人均营收: d.perCapitaRevenue,
    }));
  }, [deptSeries]);

  // Overview KPI trends (当期)
  const overviewKpiTrends = useMemo(() => {
    if (!currentOverview || !previousOverview) return null;
    const allDeptCurrent = departments.find((d) => d.month === selectedMonth && d.department === '全公司');
    const mom = {
      revenue: ((currentOverview.totalRevenue - previousOverview.totalRevenue) / previousOverview.totalRevenue) * 100,
      laborCost: ((currentOverview.totalLaborCost - previousOverview.totalLaborCost) / previousOverview.totalLaborCost) * 100,
      ratio: currentOverview.laborCostRatio - previousOverview.laborCostRatio,
      headcount: allDeptCurrent ? allDeptCurrent.momHeadcount : 0,
    };
    const yoy = previousYearOverview
      ? {
          revenue: ((currentOverview.totalRevenue - previousYearOverview.totalRevenue) / previousYearOverview.totalRevenue) * 100,
          laborCost: ((currentOverview.totalLaborCost - previousYearOverview.totalLaborCost) / previousYearOverview.totalLaborCost) * 100,
          ratio: currentOverview.laborCostRatio - previousYearOverview.laborCostRatio,
          headcount: allDeptCurrent ? allDeptCurrent.yoyHeadcount : 0,
        }
      : null;
    return { mom, yoy };
  }, [currentOverview, previousOverview, previousYearOverview, departments, selectedMonth]);

  // Overview KPI trends (累计)
  const cumulativeKpiTrends = useMemo(() => {
    if (!cumulativeOverview || !prevYearCumulativeOverview) return null;
    const allDeptCurrent = departments.find((d) => d.month === selectedMonth && d.department === '全公司');
    const yoy = {
      revenue: ((cumulativeOverview.totalRevenue - prevYearCumulativeOverview.totalRevenue) / prevYearCumulativeOverview.totalRevenue) * 100,
      laborCost: ((cumulativeOverview.totalLaborCost - prevYearCumulativeOverview.totalLaborCost) / prevYearCumulativeOverview.totalLaborCost) * 100,
      ratio: cumulativeOverview.laborCostRatio - prevYearCumulativeOverview.laborCostRatio,
      headcount: allDeptCurrent ? allDeptCurrent.yoyHeadcount : 0,
    };
    return { yoy };
  }, [cumulativeOverview, prevYearCumulativeOverview, departments, selectedMonth]);

  // 部门对比数据
  const deptCompareData = useMemo(() => {
    const targetMonth = viewMode === 'cumulative' ? selectedMonth : selectedMonth;
    if (!targetMonth) return [];
    if (viewMode === 'cumulative') {
      // 累计模式下，各部门显示累计人力成本
      const [year] = targetMonth.split('-');
      return [...departments]
        .filter((d) => d.month.startsWith(year) && d.month <= targetMonth)
        .reduce((acc, d) => {
          const existing = acc.find((a) => a.name === d.department);
          if (existing) {
            existing.人力成本 += d.laborCost;
            existing.人数 = d.headcount; // 用最后一个月的人数
          } else {
            acc.push({ name: d.department, 人力成本: d.laborCost, 人数: d.headcount });
          }
          return acc;
        }, [] as { name: string; 人力成本: number; 人数: number }[])
        .sort((a, b) => getDeptSortIndex(a.name) - getDeptSortIndex(b.name));
    }
    return [...departments]
      .filter((d) => d.month === targetMonth)
      .sort((a, b) => getDeptSortIndex(a.department) - getDeptSortIndex(b.department))
      .map((d) => ({ name: d.department, 人力成本: d.laborCost, 人数: d.headcount }));
  }, [departments, selectedMonth, viewMode]);

  const compositionStackData = useMemo(() => {
    const targetMonth = selectedMonth;
    if (!targetMonth) return [];
    if (viewMode === 'cumulative') {
      // 累计模式下汇总各部门的成本构成
      const [year] = targetMonth.split('-');
      const depts = ['总部', '自营', '线上', '犀利工厂'];
      return depts
        .sort((a, b) => getDeptSortIndex(a) - getDeptSortIndex(b))
        .map((dept) => {
          const deptComps = compositions.filter(
            (c) => c.month.startsWith(year) && c.month <= targetMonth && c.department === dept
          );
          const fixed = deptComps.reduce((s, c) => s + c.fixedIncome, 0);
          const floating = deptComps.reduce((s, c) => s + c.floatingIncome, 0);
          const social = deptComps.reduce((s, c) => s + c.socialInsurance, 0);
          const severance = deptComps.reduce((s, c) => s + c.severance, 0);
          const outsourcing = deptComps.reduce((s, c) => s + c.outsourcing, 0);
          return {
            name: dept === '自营' ? '自营区域' : dept,
            固定收入: fixed,
            浮动收入: floating,
            社保公积金: social,
            经济补偿金: severance,
            外包费用: outsourcing,
          };
        });
    }
    return [...compositions]
      .filter((c) => c.month === targetMonth)
      .sort((a, b) => getDeptSortIndex(a.department) - getDeptSortIndex(b.department))
      .map((c) => ({
        name: c.department === '自营' ? '自营区域' : c.department,
        固定收入: c.fixedIncome,
        浮动收入: c.floatingIncome,
        社保公积金: c.socialInsurance,
        经济补偿金: c.severance,
        外包费用: c.outsourcing,
      }));
  }, [compositions, selectedMonth, viewMode]);

  // 人力成本预算使用率数据（总览用）
  const budgetUsageData = useMemo(() => {
    const segments: { key: string; label: string }[] = [
      { key: '总部', label: '总部' },
      { key: '自营', label: '自营区域' },
      { key: '线上', label: '线上' },
      { key: '犀利工厂', label: '犀利工厂' },
    ];

    if (viewMode === 'cumulative') {
      const [year] = selectedMonth.split('-');
      return segments.map((seg) => {
        const segBudgets = budgets.filter(
          (b) => b.segment === seg.key && b.month.startsWith(year) && b.month <= selectedMonth
        );
        const laborCost = segBudgets.reduce((s, b) => s + b.laborCost, 0);
        const budgetLaborCost = segBudgets.reduce((s, b) => s + b.budgetLaborCost, 0);
        const usageRate = budgetLaborCost > 0 ? (laborCost / budgetLaborCost) * 100 : 0;
        return {
          name: seg.label,
          人力成本: parseFloat(laborCost.toFixed(1)),
          预算人力成本: parseFloat(budgetLaborCost.toFixed(1)),
          使用率: parseFloat(usageRate.toFixed(1)),
        };
      });
    }

    return segments.map((seg) => {
      const segBudgets = budgets.filter((b) => b.segment === seg.key && b.month === selectedMonth);
      const laborCost = segBudgets.reduce((s, b) => s + b.laborCost, 0);
      const budgetLaborCost = segBudgets.reduce((s, b) => s + b.budgetLaborCost, 0);
      const usageRate = budgetLaborCost > 0 ? (laborCost / budgetLaborCost) * 100 : 0;
      return {
        name: seg.label,
        人力成本: parseFloat(laborCost.toFixed(1)),
        预算人力成本: parseFloat(budgetLaborCost.toFixed(1)),
        使用率: parseFloat(usageRate.toFixed(1)),
      };
    });
  }, [budgets, selectedMonth, viewMode]);

  // 人力成本组成结构数据
  const costStructureChartData = useMemo(() => {
    const segmentKey = dimension === '总览' ? null : DIMENSION_MAP[dimension];
    const monthData = costStructures.filter(
      (c) => c.month === selectedMonth && (segmentKey ? c.segment === segmentKey : true)
    );

    if (viewMode === 'cumulative') {
      const [year] = selectedMonth.split('-');
      const cumData = costStructures.filter(
        (c) => c.month.startsWith(year) && c.month <= selectedMonth && (segmentKey ? c.segment === segmentKey : true)
      );
      if (segmentKey) {
        const total = Object.values(cumData).reduce((acc, item) => {
          acc.attendanceSalary += item.attendanceSalary;
          acc.performanceBonus += item.performanceBonus;
          acc.overtimePay += item.overtimePay;
          acc.annualLeaveAllowance += item.annualLeaveAllowance;
          acc.sickLeavePay += item.sickLeavePay;
          acc.maternityLeavePay += item.maternityLeavePay;
          acc.otherPayable += item.otherPayable;
          acc.employerSocialInsurance += item.employerSocialInsurance;
          return acc;
        }, { attendanceSalary: 0, performanceBonus: 0, overtimePay: 0, annualLeaveAllowance: 0, sickLeavePay: 0, maternityLeavePay: 0, otherPayable: 0, employerSocialInsurance: 0 });
        return { pieData: [
          { name: '考勤工资', value: parseFloat(total.attendanceSalary.toFixed(1)) },
          { name: '效益奖金', value: parseFloat(total.performanceBonus.toFixed(1)) },
          { name: '加班费', value: parseFloat(total.overtimePay.toFixed(1)) },
          { name: '年假补贴', value: parseFloat(total.annualLeaveAllowance.toFixed(1)) },
          { name: '病假工资', value: parseFloat(total.sickLeavePay.toFixed(1)) },
          { name: '产假工资', value: parseFloat(total.maternityLeavePay.toFixed(1)) },
          { name: '其他应发', value: parseFloat(total.otherPayable.toFixed(1)) },
          { name: '单位社保公积金', value: parseFloat(total.employerSocialInsurance.toFixed(1)) },
        ].filter((d) => d.value > 0), segmentData: [] };
      }
      // 总览 - by segment
      const segments = ['总部', '自营', '线上', '犀利工厂'];
      const segData = segments.map((seg) => {
        const segItems = cumData.filter((c) => c.segment === seg);
        return {
          name: seg,
          考勤工资: parseFloat(segItems.reduce((s, c) => s + c.attendanceSalary, 0).toFixed(1)),
          效益奖金: parseFloat(segItems.reduce((s, c) => s + c.performanceBonus, 0).toFixed(1)),
          加班费: parseFloat(segItems.reduce((s, c) => s + c.overtimePay, 0).toFixed(1)),
          年假补贴: parseFloat(segItems.reduce((s, c) => s + c.annualLeaveAllowance, 0).toFixed(1)),
          病假工资: parseFloat(segItems.reduce((s, c) => s + c.sickLeavePay, 0).toFixed(1)),
          产假工资: parseFloat(segItems.reduce((s, c) => s + c.maternityLeavePay, 0).toFixed(1)),
          其他应发: parseFloat(segItems.reduce((s, c) => s + c.otherPayable, 0).toFixed(1)),
          单位社保公积金: parseFloat(segItems.reduce((s, c) => s + c.employerSocialInsurance, 0).toFixed(1)),
        };
      });
      return { pieData: [], segmentData: segData };
    }

    if (segmentKey) {
      const d = monthData[0];
      if (!d) return { pieData: [], segmentData: [] };
      return {
        pieData: [
          { name: '考勤工资', value: d.attendanceSalary },
          { name: '效益奖金', value: d.performanceBonus },
          { name: '加班费', value: d.overtimePay },
          { name: '年假补贴', value: d.annualLeaveAllowance },
          { name: '病假工资', value: d.sickLeavePay },
          { name: '产假工资', value: d.maternityLeavePay },
          { name: '其他应发', value: d.otherPayable },
          { name: '单位社保公积金', value: d.employerSocialInsurance },
        ].filter((d) => d.value > 0),
        segmentData: [],
      };
    }

    // 总览 - by segment
    const segments = ['总部', '自营', '线上', '犀利工厂'];
    const segData = segments.map((seg) => {
      const d = monthData.find((c) => c.segment === seg);
      return {
        name: seg,
        考勤工资: d?.attendanceSalary ?? 0,
        效益奖金: d?.performanceBonus ?? 0,
        加班费: d?.overtimePay ?? 0,
        年假补贴: d?.annualLeaveAllowance ?? 0,
        病假工资: d?.sickLeavePay ?? 0,
        产假工资: d?.maternityLeavePay ?? 0,
        其他应发: d?.otherPayable ?? 0,
        单位社保公积金: d?.employerSocialInsurance ?? 0,
      };
    });
    return { pieData: [], segmentData: segData };
  }, [costStructures, selectedMonth, dimension, viewMode]);
  const budgetUsageSummary = useMemo(() => {
    const totalLabor = budgetUsageData.reduce((s, d) => s + d.人力成本, 0);
    const totalBudget = budgetUsageData.reduce((s, d) => s + d.预算人力成本, 0);
    const totalUsage = totalBudget > 0 ? (totalLabor / totalBudget) * 100 : 0;
    return { totalLabor, totalBudget, totalUsage };
  }, [budgetUsageData]);

  // Segment overview data for 总览 page
  type SegmentConfig = {
    key: '总部' | '自营' | '线上' | '犀利工厂';
    label: string;
    revenue?: number;
    comment: string;
  };

  const activeOverview = viewMode === 'cumulative' ? cumulativeOverview : currentOverview;

  const segments: SegmentConfig[] = [
    {
      key: '总部',
      label: '总部',
      revenue: activeOverview?.totalRevenue,
      comment: '总部以固定薪酬为主、成本刚性较强，压降空间主要来自编制与职能优化。',
    },
    {
      key: '自营',
      label: '自营区域',
      revenue: activeOverview?.selfOperatedRevenue,
      comment: '浮动收入与销售业绩高度联动，区域间人效差异是提效重点。',
    },
    {
      key: '线上',
      label: '线上',
      revenue: activeOverview?.platformRevenue,
      comment: '兴趣电商固定成本占比较大，体量小，需关注新增账号的产出匹配。',
    },
    {
      key: '犀利工厂',
      label: '犀利工厂',
      revenue: activeOverview?.factoryRevenue,
      comment: '人力成本接近甚至高于产值，是最需要被追踪的异常板块。',
    },
  ];

  const getSegmentStats = (key: SegmentConfig['key']) => {
    if (viewMode === 'cumulative') {
      const current = getCumulativeDeptData(departments, selectedMonth, key);
      const [year, m] = selectedMonth.split('-');
      const prevYearMonth = `${parseInt(year) - 1}-${m}`;
      const prevYear = getCumulativeDeptData(departments, prevYearMonth, key);
      // 累计没有环比概念，只比较同比
      return { current, prev: null, prevYear };
    }

    const current = departments.find((d) => d.month === selectedMonth && d.department === key);
    const prev = departments.find((d) => {
      if (!selectedMonth) return false;
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevMonth = m === 1
        ? `${y - 1}-12`
        : `${y}-${String(m - 1).padStart(2, '0')}`;
      return d.month === prevMonth && d.department === key;
    });
    const prevYear = departments.find((d) => {
      if (!selectedMonth) return false;
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevYearMonth = `${y - 1}-${String(m).padStart(2, '0')}`;
      return d.month === prevYearMonth && d.department === key;
    });
    return { current, prev, prevYear };
  };

  const showStoreEfficiency = !isOverview && deptKey === '自营';

  // 数据路径追踪维度映射
  const tracerDimension = isOverview ? '总览' : (deptKey === '全公司' ? '总览' : deptKey);

  // 构建派生数据源：使用与看板展示一致的派生数据（而非原始数据）
  const derivedDataSources = useMemo<DataSourceMap>(() => ({
    overview: overviews as unknown as Record<string, unknown>[],
    department: departments as unknown as Record<string, unknown>[],
    composition: compositions as unknown as Record<string, unknown>[],
    position: positions as unknown as Record<string, unknown>[],
    store: stores as unknown as Record<string, unknown>[],
    budget: budgets as unknown as Record<string, unknown>[],
    costStructure: costStructures as unknown as Record<string, unknown>[],
  }), [overviews, departments, compositions, positions, stores, budgets, costStructures]);

  const tracerFor = (metricKey: string, value?: number | null) => (
    <DataPathTracer
      metricKey={metricKey}
      dimension={tracerDimension}
      selectedMonth={selectedMonth}
      viewMode={viewMode}
      dashboardValue={value ?? undefined}
      customDataSources={derivedDataSources}
    />
  );

  // 生成数据分析
  const analysis = useMemo(() => {
    if (isOverview) {
      return generateOverviewAnalysis(selectedMonth, departments, overviews, compositions, viewMode);
    }
    return generateSegmentAnalysis(
      dimension,
      deptKey,
      selectedMonth,
      departments,
      overviews,
      compositions,
      positions,
      viewMode,
    );
  }, [isOverview, dimension, deptKey, selectedMonth, departments, overviews, compositions, positions, viewMode]);

  const monthLabel = getMonthLabel(selectedMonth);
  const [selectedYear] = selectedMonth.split('-');

  // 获取累计标签
  const cumulativeLabel = viewMode === 'cumulative'
    ? `${selectedYear}年1-${parseInt(selectedMonth.split('-')[1])}月累计`
    : '';

  return (
    <div className="space-y-6">
      {/* Header with month selector and view mode tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">数据看板</h2>
          <p className="text-sm text-muted-foreground">
            当前维度：{dimension} · {viewMode === 'cumulative' ? cumulativeLabel : `数据月份：${monthLabel}`}
            {loading ? (
              <span className="ml-2 text-blue-500">● 正在加载服务器数据</span>
            ) : syncError ? (
              <span className="ml-2 text-red-500">● 服务器数据加载失败：{syncError}</span>
            ) : loadedFromStorage ? (
              <span className="ml-2 text-green-600">● 使用服务器数据库数据</span>
            ) : (
              <span className="ml-2 text-amber-500">● 暂无服务器数据（请在「数据管理」中导入）</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {getMonthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="current">当期</TabsTrigger>
              <TabsTrigger value="cumulative">年度累计</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setCustomizerOpen(true)}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            自定义排版
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/data-binding')}>
            <Link2 className="mr-2 h-4 w-4" />
            数据绑定配置
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isOverview ? (
          viewMode === 'cumulative' ? (
            <>
              <KpiCard
                title={`累计总业绩（${selectedYear}年1-${parseInt(selectedMonth.split('-')[1])}月）`}
                value={cumulativeOverview ? formatWan(cumulativeOverview.totalRevenue) : '--'}
                trend={cumulativeKpiTrends?.yoy ? cumulativeKpiTrends.yoy.revenue : 0}
                subtitle="同比"
                yoyTrend={undefined}
                icon={<span className="text-lg">📈</span>}
              />
              <KpiCard
                title={`累计总人力成本`}
                value={cumulativeOverview ? formatWan(cumulativeOverview.totalLaborCost) : '--'}
                trend={cumulativeKpiTrends?.yoy ? cumulativeKpiTrends.yoy.laborCost : 0}
                subtitle="同比"
                reverseTrend
                yoyTrend={undefined}
                icon={<span className="text-lg">💰</span>}
              />
              <KpiCard
                title="累计人力成本占比"
                value={cumulativeOverview ? formatPct(cumulativeOverview.laborCostRatio) : '--'}
                trend={cumulativeKpiTrends?.yoy ? cumulativeKpiTrends.yoy.ratio : 0}
                trendSuffix="pp"
                subtitle="同比"
                reverseTrend
                yoyTrend={undefined}
                icon={<span className="text-lg">📊</span>}
              />
              <KpiCard
                title="总人数（当月快照）"
                value={
                  departments.find((d) => d.month === selectedMonth && d.department === '全公司')
                    ? `${departments.find((d) => d.month === selectedMonth && d.department === '全公司')!.headcount}人`
                    : '--'
                }
                trend={cumulativeKpiTrends?.yoy ? cumulativeKpiTrends.yoy.headcount : 0}
                trendSuffix="人"
                trendDecimals={0}
                subtitle="同比"
                reverseTrend
                yoyTrend={undefined}
                icon={<span className="text-lg">👥</span>}
              />
            </>
          ) : (
            <>
              <KpiCard
                title="总业绩（不含犀利产值）"
                value={currentOverview ? formatWan(currentOverview.totalRevenue) : '--'}
                trend={overviewKpiTrends ? overviewKpiTrends.mom.revenue : 0}
                subtitle="环比"
                yoyTrend={overviewKpiTrends?.yoy ? overviewKpiTrends.yoy.revenue : 0}
                icon={<span className="text-lg">📈</span>}
                tracer={tracerFor('totalRevenue', currentOverview?.totalRevenue)}
              />
              <KpiCard
                title="总人力成本"
                value={currentOverview ? formatWan(currentOverview.totalLaborCost) : '--'}
                trend={overviewKpiTrends ? overviewKpiTrends.mom.laborCost : 0}
                subtitle="环比"
                reverseTrend
                yoyTrend={overviewKpiTrends?.yoy ? overviewKpiTrends.yoy.laborCost : 0}
                icon={<span className="text-lg">💰</span>}
                tracer={tracerFor('totalLaborCost', currentOverview?.totalLaborCost)}
              />
              <KpiCard
                title="人力成本占比"
                value={currentOverview ? formatPct(currentOverview.laborCostRatio) : '--'}
                trend={overviewKpiTrends ? overviewKpiTrends.mom.ratio : 0}
                trendSuffix="pp"
                subtitle="环比"
                reverseTrend
                yoyTrend={overviewKpiTrends?.yoy ? overviewKpiTrends.yoy.ratio : 0}
                yoyTrendSuffix="pp"
                icon={<span className="text-lg">📊</span>}
                tracer={tracerFor('laborCostRatio', currentOverview?.laborCostRatio)}
              />
              <KpiCard
                title="总人数"
                value={
                  departments.find((d) => d.month === selectedMonth && d.department === '全公司')
                    ? `${departments.find((d) => d.month === selectedMonth && d.department === '全公司')!.headcount}人`
                    : '--'
                }
                trend={overviewKpiTrends ? overviewKpiTrends.mom.headcount : 0}
                trendSuffix="人"
                trendDecimals={0}
                subtitle="环比"
                reverseTrend
                yoyTrend={overviewKpiTrends?.yoy ? overviewKpiTrends.yoy.headcount : 0}
                yoyTrendSuffix="人"
                yoyTrendDecimals={0}
                icon={<span className="text-lg">👥</span>}
                tracer={tracerFor('headcount', departments.find((d) => d.month === selectedMonth && d.department === '全公司')?.headcount)}
              />
            </>
          )
        ) : viewMode === 'cumulative' ? (
          <>
            <KpiCard
              title="人数（当月快照）"
              value={cumulativeDept ? `${cumulativeDept.headcount}人` : '--'}
              trend={cumulativeDept && prevYearCumulativeDept
                ? ((cumulativeDept.headcount - prevYearCumulativeDept.headcount) / prevYearCumulativeDept.headcount) * 100
                : 0}
              subtitle="同比"
              reverseTrend
              icon={<span className="text-lg">👥</span>}
            />
            <KpiCard
              title="累计人力成本"
              value={cumulativeDept ? formatWan(cumulativeDept.laborCost) : '--'}
              trend={cumulativeDept && prevYearCumulativeDept
                ? ((cumulativeDept.laborCost - prevYearCumulativeDept.laborCost) / prevYearCumulativeDept.laborCost) * 100
                : 0}
              subtitle="同比"
              reverseTrend
              icon={<span className="text-lg">💰</span>}
            />
            <KpiCard
              title="人力成本占比"
              value={cumulativeDept ? formatPct(cumulativeDept.laborCostRatio) : '--'}
              trend={cumulativeDept && prevYearCumulativeDept
                ? cumulativeDept.laborCostRatio - prevYearCumulativeDept.laborCostRatio
                : 0}
              trendSuffix="pp"
              subtitle="同比"
              reverseTrend
              icon={<span className="text-lg">📊</span>}
            />
            <KpiCard
              title={showStoreEfficiency ? '店效' : '人均营收'}
              value={cumulativeDept
                ? showStoreEfficiency
                  ? safeNum(cumulativeDept.storeEfficiency).toFixed(2)
                  : safeNum(cumulativeDept.perCapitaRevenue).toFixed(2)
                : '--'
              }
              trend={cumulativeDept && prevYearCumulativeDept
                ? showStoreEfficiency
                  ? ((cumulativeDept.storeEfficiency - safeNum(prevYearCumulativeDept.storeEfficiency)) /
                      safeNum(prevYearCumulativeDept.storeEfficiency, 1)) * 100
                  : ((cumulativeDept.perCapitaRevenue - safeNum(prevYearCumulativeDept.perCapitaRevenue)) /
                      safeNum(prevYearCumulativeDept.perCapitaRevenue, 1)) * 100
                : 0}
              subtitle="同比"
              icon={<span className="text-lg">🚀</span>}
            />
          </>
        ) : (
          <>
            <KpiCard
              title="人数"
              value={currentDept ? `${currentDept.headcount}人` : '--'}
              trend={
                currentDept && previousDept
                  ? ((currentDept.headcount - previousDept.headcount) / previousDept.headcount) * 100
                  : 0
              }
              subtitle="环比"
              reverseTrend
              icon={<span className="text-lg">👥</span>}
              tracer={tracerFor('headcount', currentDept?.headcount)}
            />
            <KpiCard
              title="人力成本"
              value={currentDept ? formatWan(currentDept.laborCost) : '--'}
              trend={
                currentDept && previousDept
                  ? ((currentDept.laborCost - previousDept.laborCost) / previousDept.laborCost) * 100
                  : 0
              }
              subtitle="环比"
              reverseTrend
              icon={<span className="text-lg">💰</span>}
              tracer={tracerFor('laborCost', currentDept?.laborCost)}
            />
            <KpiCard
              title="人力成本占比"
              value={currentDept ? formatPct(currentDept.laborCostRatio) : '--'}
              trend={
                currentDept && previousDept ? currentDept.laborCostRatio - previousDept.laborCostRatio : 0
              }
              trendSuffix="pp"
              subtitle="环比"
              reverseTrend
              icon={<span className="text-lg">📊</span>}
              tracer={tracerFor('laborCostRatio', currentDept?.laborCostRatio)}
            />
            <KpiCard
              title={showStoreEfficiency ? '店效' : '人均营收'}
              value={
                currentDept
                  ? showStoreEfficiency
                    ? safeNum(currentDept.storeEfficiency).toFixed(2)
                    : safeNum(currentDept.perCapitaRevenue).toFixed(2)
                  : '--'
              }
              trend={
                currentDept && previousDept
                  ? showStoreEfficiency
                    ? ((currentDept.storeEfficiency - safeNum(previousDept.storeEfficiency)) /
                        safeNum(previousDept.storeEfficiency, 1)) *
                      100
                    : ((currentDept.perCapitaRevenue - safeNum(previousDept.perCapitaRevenue)) /
                        safeNum(previousDept.perCapitaRevenue, 1)) *
                      100
                  : 0
              }
              subtitle="环比"
              icon={<span className="text-lg">🚀</span>}
            />
          </>
        )}
      </div>

      {/* 渠道业绩明细 (总览 only) */}
      {isOverview && activeOverview && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">
            {viewMode === 'cumulative' ? '累计业绩分渠道' : '业绩分渠道'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">自营区域业绩</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold tracking-tight">{formatWan(activeOverview.selfOperatedRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">加盟业绩</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold tracking-tight">{formatWan(activeOverview.franchiseRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">线上业绩</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold tracking-tight">{formatWan(activeOverview.platformRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">犀利产值</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold tracking-tight">{activeOverview.factoryRevenue ? formatWan(activeOverview.factoryRevenue) : '--'}</div>
                <p className="text-xs text-muted-foreground mt-1">不计入总业绩</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 四大板块概况 (总览 only) */}
      {isOverview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {viewMode === 'cumulative' ? '四大业务板块分布（累计）' : '四大业务板块分布'}
            </h3>
            <span className="text-xs text-muted-foreground">
              数据来源：数据管理 → 部门数据 · 月度总览
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {segments.map((seg) => {
              const { current, prev, prevYear } = getSegmentStats(seg.key);
              if (!current) return null;

              // 为每个板块生成基于实际数据的动态分析
              const analysisItems = generateSegmentCardAnalysis(
                seg.key,
                seg.label,
                selectedMonth,
                current,
                prev,
                prevYear,
                activeOverview,
                compositions,
                viewMode
              );
              const dataSourceDesc = getSegmentDataSource(seg.label, viewMode);

              if (viewMode === 'cumulative') {
                // 累计模式只显示同比，不显示环比
                const yoyValue = prevYear ? current.laborCost - prevYear.laborCost : 0;
                const yoyPct = prevYear && prevYear.laborCost !== 0 ? (yoyValue / prevYear.laborCost) * 100 : 0;
                const costToRevenueRatio = seg.revenue && seg.revenue > 0 ? (current.laborCost / seg.revenue) * 100 : undefined;
                const isWarning = costToRevenueRatio !== undefined && costToRevenueRatio > 80;
                return (
                  <SegmentOverviewCard
                    key={seg.key}
                    title={seg.label}
                    headcount={current.headcount}
                    laborCost={current.laborCost}
                    totalCost={cumulativeOverview?.totalLaborCost ?? 0}
                    revenue={seg.revenue}
                    momValue={0}
                    momPct={0}
                    yoyValue={yoyValue}
                    yoyPct={yoyPct}
                    comment={seg.comment}
                    variant={isWarning ? 'warning' : 'default'}
                    cumulativeMode
                    dataSource={dataSourceDesc}
                    analysisItems={analysisItems}
                  />
                );
              }

              const momValue = prev ? current.laborCost - prev.laborCost : 0;
              const momPct = prev && prev.laborCost !== 0 ? (momValue / prev.laborCost) * 100 : 0;
              const yoyValue = prevYear ? current.laborCost - prevYear.laborCost : 0;
              const yoyPct = prevYear && prevYear.laborCost !== 0 ? (yoyValue / prevYear.laborCost) * 100 : 0;
              const costToRevenueRatio = seg.revenue && seg.revenue > 0 ? (current.laborCost / seg.revenue) * 100 : undefined;
              const isWarning = costToRevenueRatio !== undefined && costToRevenueRatio > 80;
              return (
                <SegmentOverviewCard
                  key={seg.key}
                  title={seg.label}
                  headcount={current.headcount}
                  laborCost={current.laborCost}
                  totalCost={currentOverview?.totalLaborCost ?? 0}
                  revenue={seg.revenue}
                  momValue={momValue}
                  momPct={momPct}
                  yoyValue={yoyValue}
                  yoyPct={yoyPct}
                  comment={seg.comment}
                  variant={isWarning ? 'warning' : 'default'}
                  dataSource={dataSourceDesc}
                  analysisItems={analysisItems}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 人力成本预算使用率 (总览 only) */}
      {isOverview && budgetUsageData.some((d) => d.人力成本 > 0 || d.预算人力成本 > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {viewMode === 'cumulative' ? '累计人力成本预算使用率' : '人力成本预算使用率'}
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                合计：{safeNum(budgetUsageSummary.totalLabor).toFixed(1)}万 / {safeNum(budgetUsageSummary.totalBudget).toFixed(1)}万
              </span>
              <span className={`font-semibold ${budgetUsageSummary.totalUsage > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                总使用率 {safeNum(budgetUsageSummary.totalUsage).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 柱状图：人力成本 vs 预算 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {viewMode === 'cumulative' ? '各板块累计人力成本与预算对比' : '各板块人力成本与预算对比'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetUsageData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip
                        formatter={(v, name) => [`${Number(v).toFixed(1)}万`, String(name)]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="预算人力成本" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 柱状图：使用率 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {viewMode === 'cumulative' ? '各板块累计预算使用率' : '各板块预算使用率'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetUsageData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `${v}%`}
                        domain={[0, 'auto']}
                      />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(v, name) => {
                          if (name === '使用率') return [`${Number(v).toFixed(1)}%`, '预算使用率'];
                          return [`${v}万`, String(name)];
                        }}
                      />
                      <Bar dataKey="使用率" radius={[0, 4, 4, 0]}>
                        {budgetUsageData.map((d, i) => {
                          const color = d.使用率 > 100
                            ? '#dc2626'
                            : d.使用率 > 80
                            ? '#f59e0b'
                            : '#16a34a';
                          return <Cell key={`bar-${i}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> ≤80%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 80-100%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> &gt;100%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 人力成本组成结构 */}
      {(dimension === '总部' || isOverview) && costStructureChartData.pieData.length > 0 || costStructureChartData.segmentData.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {costStructureChartData.pieData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {viewMode === 'cumulative' ? `${dimension}累计人力成本组成结构` : `${dimension}人力成本组成结构`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costStructureChartData.pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {costStructureChartData.pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}万`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {costStructureChartData.segmentData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {viewMode === 'cumulative' ? '各板块累计人力成本组成对比' : '各板块人力成本组成对比'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costStructureChartData.segmentData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${Number(v).toFixed(1)}万`, String(name)]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="考勤工资" stackId="a" fill={CHART_COLORS[0]} />
                      <Bar dataKey="效益奖金" stackId="a" fill={CHART_COLORS[1]} />
                      <Bar dataKey="加班费" stackId="a" fill={CHART_COLORS[2]} />
                      <Bar dataKey="年假补贴" stackId="a" fill={CHART_COLORS[3]} />
                      <Bar dataKey="病假工资" stackId="a" fill="#ec4899" />
                      <Bar dataKey="产假工资" stackId="a" fill="#f97316" />
                      <Bar dataKey="其他应发" stackId="a" fill="#14b8a6" />
                      <Bar dataKey="单位社保公积金" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {costStructureChartData.pieData.length === 0 && costStructureChartData.segmentData.length === 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                暂无人力成本组成数据
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {viewMode === 'cumulative' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isOverview
                  ? `${selectedYear}年累计业绩与人力成本趋势`
                  : `${dimension} · 累计人力成本趋势`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {isOverview ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="累计业绩"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="累计人力成本"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v) => [`${v}万`, '人力成本']} />
                      <Line
                        type="monotone"
                        dataKey="人力成本"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        ) : isOverview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">总业绩与总人力成本趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sortedOverviews}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                    <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalRevenue"
                      name="总业绩"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalLaborCost"
                      name="总人力成本"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dimension} · 人力成本变化趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                    <Tooltip formatter={(v) => [`${v}万`, '人力成本']} />
                    <Line
                      type="monotone"
                      dataKey="人力成本"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {isOverview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {viewMode === 'cumulative' ? '累计各部门人力成本对比' : `${monthLabel}各部门人力成本对比`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {deptCompareData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptCompareData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v) => [`${v}万`, '人力成本']} />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无部门对比数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dimension} · 人力成本构成</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {compositionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={compositionChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {compositionChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}万`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无成本构成数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {isOverview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {viewMode === 'cumulative' ? '累计各部门成本构成' : `${monthLabel}各部门成本构成`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {compositionStackData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compositionStackData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Bar dataKey="固定收入" stackId="a" fill={CHART_COLORS[0]} />
                      <Bar dataKey="浮动收入" stackId="a" fill={CHART_COLORS[1]} />
                      <Bar dataKey="社保公积金" stackId="a" fill={CHART_COLORS[2]} />
                      <Bar dataKey="经济补偿金" stackId="a" fill={CHART_COLORS[3]} />
                      <Bar dataKey="外包费用" stackId="a" fill={CHART_COLORS[4]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无成本构成数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{dimension} · 职级人力成本</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {positionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={positionChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v) => [`${v}万`, '人力成本']} />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无职级数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {viewMode === 'cumulative'
                ? `${selectedYear}年累计业绩与人力成本趋势`
                : '全公司 · 业绩趋势与对比'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {viewMode === 'cumulative' ? (
                  <LineChart data={cumulativeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                    <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="累计业绩"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="累计人力成本"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                ) : (
                  <LineChart data={sortedOverviews}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                    <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalRevenue"
                      name="总业绩"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalLaborCost"
                      name="总人力成本"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 数据分析面板 */}
      {isBlockVisible('analysis-panel') && (
        <AnalysisPanel
          analysis={analysis}
          title={`${dimension}数据分析 · ${viewMode === 'cumulative' ? cumulativeLabel : monthLabel}`}
        />
      )}

      {/* 自定义排版对话框 */}
      <DashboardCustomizer
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        blocks={layout.blocks}
        onMoveUp={layout.moveUp}
        onMoveDown={layout.moveDown}
        onToggleVisible={layout.toggleVisible}
        onReset={layout.reset}
      />
    </div>
  );
}
