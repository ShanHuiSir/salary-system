import type { CostStructureData, DataType, DepartmentData, MonthlyOverview } from '@/types';
import type { PersistedSalaryData } from '@/lib/api';
import { toNumber, isBlank, roundTo, safeDivide, safePercent } from '@/utils/numberUtils';
import { addMonths } from '@/utils/dateUtils';

export type { PersistedSalaryData } from '@/lib/api';

const REVENUE_COMPONENT_KEYS = [
  'selfOperatedRevenue',
  'franchiseRevenue',
  'platformRevenue',
  'factoryRevenue',
] as const;

const SYSTEM_CALCULATED_FIELDS: Partial<Record<DataType, string[]>> = {
  overview: [
    'avgSalary',
    'laborCostRatio',
    'perCapitaRevenue',
    'momRevenue',
    'yoyRevenue',
    'momLaborCost',
    'yoyLaborCost',
  ],
  department: [
    'avgSalary',
    'perCapitaRevenue',
    'storeEfficiency',
    'laborCostRatio',
    'momLaborCost',
    'yoyLaborCost',
    'momHeadcount',
    'yoyHeadcount',
  ],
  position: ['ratio', 'momHeadcount', 'yoyHeadcount'],
  store: ['storeEfficiency', 'personEfficiency', 'momRevenue', 'yoyRevenue'],
};

export function isSystemCalculatedField(type: DataType, key: string): boolean {
  return SYSTEM_CALCULATED_FIELDS[type]?.includes(key) ?? false;
}

function findByMonth<T extends { month: string }>(items: T[], month: string, predicate?: (item: T) => boolean): T | undefined {
  return items.find((item) => item.month === month && (!predicate || predicate(item)));
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function normalizeCostStructure(item: CostStructureData): CostStructureData {
  const legacyLeavePay = toNumber(item.annualLeaveAllowance) + toNumber(item.sickLeavePay) + toNumber(item.maternityLeavePay);
  const mergedLeavePay = toNumber(item.sickMaternityAnnualLeave);
  const severance = toNumber(item.severance) || toNumber(item.jjbcj);

  return {
    ...item,
    attendanceSalary: toNumber(item.attendanceSalary),
    performanceBonus: toNumber(item.performanceBonus),
    overtimePay: toNumber(item.overtimePay),
    sickMaternityAnnualLeave: mergedLeavePay || legacyLeavePay,
    severance,
    jjbcj: toNumber(item.jjbcj),
    annualLeaveAllowance: toNumber(item.annualLeaveAllowance),
    sickLeavePay: toNumber(item.sickLeavePay),
    maternityLeavePay: toNumber(item.maternityLeavePay),
    otherPayable: toNumber(item.otherPayable),
    employerSocialInsurance: toNumber(item.employerSocialInsurance),
  };
}

function revenueForDepartment(overview: MonthlyOverview | undefined, department: DepartmentData['department']): number {
  if (!overview) return 0;
  switch (department) {
    case '全公司':
      return overview.totalRevenue;
    case '自营':
      return overview.selfOperatedRevenue;
    case '加盟':
      return overview.franchiseRevenue;
    case '线上':
      return overview.platformRevenue;
    case '犀利工厂':
      return overview.factoryRevenue ?? 0;
    case '总部':
    default:
      return 0;
  }
}

export function autoFillOverviewRevenueFields(values: Record<string, unknown>): Record<string, unknown> {
  const next = { ...values };
  const totalIsBlank = isBlank(next.totalRevenue);
  const presentComponentKeys = REVENUE_COMPONENT_KEYS.filter((key) => !isBlank(next[key]));
  const missingComponentKeys = REVENUE_COMPONENT_KEYS.filter((key) => isBlank(next[key]));

  if (!totalIsBlank && missingComponentKeys.length === 1) {
    const knownSum = sumBy(presentComponentKeys, (key) => toNumber(next[key]));
    next[missingComponentKeys[0]] = roundTo(toNumber(next.totalRevenue) - knownSum, 2);
  }

  if (totalIsBlank && missingComponentKeys.length === 0) {
    next.totalRevenue = roundTo(REVENUE_COMPONENT_KEYS.reduce((sum, key) => sum + toNumber(next[key]), 0), 2);
  }

  return next;
}

export function prepareSalaryFormValues(type: DataType, values: Record<string, unknown>): Record<string, unknown> {
  if (type === 'overview') return autoFillOverviewRevenueFields(values);
  return values;
}

export function normalizeSalaryData(data: PersistedSalaryData): PersistedSalaryData {
  const overviewsBase = data.overviews.map((overview) => {
    const filled = autoFillOverviewRevenueFields(overview as unknown as Record<string, unknown>);
    return {
      ...overview,
      totalRevenue: toNumber(filled.totalRevenue),
      selfOperatedRevenue: toNumber(filled.selfOperatedRevenue),
      franchiseRevenue: toNumber(filled.franchiseRevenue),
      platformRevenue: toNumber(filled.platformRevenue),
      factoryRevenue: toNumber(filled.factoryRevenue),
      totalLaborCost: toNumber(filled.totalLaborCost),
    };
  });

  const departmentsBase = data.departments.map((department) => ({
    ...department,
    headcount: toNumber(department.headcount),
    laborCost: toNumber(department.laborCost),
  }));

  const storesBase = data.stores.map((store) => ({
    ...store,
    storeCount: toNumber(store.storeCount),
    revenue: toNumber(store.revenue),
    laborCost: toNumber(store.laborCost),
  }));

  const positionsBase = data.positions.map((position) => ({
    ...position,
    headcount: toNumber(position.headcount),
    laborCost: toNumber(position.laborCost),
  }));

  const overviews = overviewsBase.map((overview) => {
    const previous = findByMonth(overviewsBase, addMonths(overview.month, -1));
    const lastYear = findByMonth(overviewsBase, addMonths(overview.month, -12));
    const companyDept = findByMonth(departmentsBase, overview.month, (item) => item.department === '全公司');
    const headcount = companyDept?.headcount ?? sumBy(departmentsBase.filter((item) => item.month === overview.month && item.department !== '全公司'), (item) => item.headcount);

    return {
      ...overview,
      avgSalary: safeDivide(overview.totalLaborCost, headcount, 2),
      laborCostRatio: safePercent(overview.totalLaborCost, overview.totalRevenue, 2),
      perCapitaRevenue: safeDivide(overview.totalRevenue, headcount, 2),
      momRevenue: roundTo(overview.totalRevenue - (previous?.totalRevenue ?? 0), 2),
      yoyRevenue: roundTo(overview.totalRevenue - (lastYear?.totalRevenue ?? 0), 2),
      momLaborCost: roundTo(overview.totalLaborCost - (previous?.totalLaborCost ?? 0), 2),
      yoyLaborCost: roundTo(overview.totalLaborCost - (lastYear?.totalLaborCost ?? 0), 2),
    };
  });

  const departments = departmentsBase.map((department) => {
    const overview = findByMonth(overviews, department.month);
    const previous = findByMonth(departmentsBase, addMonths(department.month, -1), (item) => item.department === department.department);
    const lastYear = findByMonth(departmentsBase, addMonths(department.month, -12), (item) => item.department === department.department);
    const revenue = revenueForDepartment(overview, department.department);

    return {
      ...department,
      avgSalary: safeDivide(department.laborCost, department.headcount, 2),
      perCapitaRevenue: safeDivide(revenue, department.headcount, 2),
      storeEfficiency: department.storeEfficiency ?? 0,
      laborCostRatio: safePercent(department.laborCost, revenue, 2),
      momLaborCost: roundTo(department.laborCost - (previous?.laborCost ?? 0), 2),
      yoyLaborCost: roundTo(department.laborCost - (lastYear?.laborCost ?? 0), 2),
      momHeadcount: roundTo(department.headcount - (previous?.headcount ?? 0), 2),
      yoyHeadcount: roundTo(department.headcount - (lastYear?.headcount ?? 0), 2),
    };
  });

  const stores = storesBase.map((store) => {
    const previous = findByMonth(storesBase, addMonths(store.month, -1), (item) => item.region === store.region);
    const lastYear = findByMonth(storesBase, addMonths(store.month, -12), (item) => item.region === store.region);

    return {
      ...store,
      storeEfficiency: safeDivide(store.revenue, store.storeCount, 2),
      personEfficiency: safeDivide(store.revenue, store.laborCost, 2),
      momRevenue: roundTo(store.revenue - (previous?.revenue ?? 0), 2),
      yoyRevenue: roundTo(store.revenue - (lastYear?.revenue ?? 0), 2),
    };
  });

  const positions = positionsBase.map((position) => {
    const peers = positionsBase.filter((item) => item.month === position.month && item.department === position.department);
    const totalHeadcount = sumBy(peers, (item) => item.headcount);
    const previous = findByMonth(positionsBase, addMonths(position.month, -1), (item) => item.department === position.department && item.level === position.level);
    const lastYear = findByMonth(positionsBase, addMonths(position.month, -12), (item) => item.department === position.department && item.level === position.level);

    return {
      ...position,
      ratio: safePercent(position.headcount, totalHeadcount, 2),
      momHeadcount: roundTo(position.headcount - (previous?.headcount ?? 0), 2),
      yoyHeadcount: roundTo(position.headcount - (lastYear?.headcount ?? 0), 2),
    };
  });

  return {
    ...data,
    overviews,
    departments,
    positions,
    stores,
    costStructures: data.costStructures.map(normalizeCostStructure),
  };
}
