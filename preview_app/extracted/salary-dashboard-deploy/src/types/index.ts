export const DEPT_DISPLAY_ORDER = ['全公司', '总部', '自营', '线上', '犀利工厂'] as const;

export function getDeptSortIndex(dept: string): number {
  const idx = DEPT_DISPLAY_ORDER.indexOf(dept as typeof DEPT_DISPLAY_ORDER[number]);
  return idx === -1 ? 999 : idx;
}

export interface MonthlyOverview {
  id: string;
  month: string; // YYYY-MM
  totalRevenue: number;
  selfOperatedRevenue: number;
  franchiseRevenue: number;
  platformRevenue: number;
  factoryRevenue?: number;
  totalLaborCost: number;
  avgSalary: number;
  laborCostRatio: number;
  perCapitaRevenue: number;
  storeEfficiency: number;
  momRevenue: number;
  yoyRevenue: number;
  momLaborCost: number;
  yoyLaborCost: number;
}

export interface DepartmentData {
  id: string;
  month: string;
  department: '总部' | '自营' | '加盟' | '线上' | '全公司' | '犀利工厂';
  headcount: number;
  laborCost: number;
  avgSalary: number;
  perCapitaRevenue: number;
  storeEfficiency: number;
  laborCostRatio: number;
  momLaborCost: number;
  yoyLaborCost: number;
  momHeadcount: number;
  yoyHeadcount: number;
}

export interface CostComposition {
  id: string;
  month: string;
  department: '总部' | '自营' | '线上' | '犀利工厂';
  fixedIncome: number;       // 固定收入(万)
  floatingIncome: number;    // 浮动收入(万)
  socialInsurance: number;   // 社保公积金(万)
  severance: number;         // 经济补偿金(万)
  outsourcing: number;       // 外包费用(万)
}

export interface PositionLevelData {
  id: string;
  month: string;
  department: '总部' | '自营' | '犀利工厂';
  level: string;
  headcount: number;
  laborCost: number;
  ratio: number;
  momHeadcount: number;
  yoyHeadcount: number;
}

export interface StoreRegionData {
  id: string;
  month: string;
  region: string;
  storeCount: number;
  revenue: number;
  laborCost: number;
  storeEfficiency: number;
  personEfficiency: number;
  momRevenue: number;
  yoyRevenue: number;
}

export type DataType = 'overview' | 'department' | 'composition' | 'position' | 'store' | 'budget' | 'costStructure';

// 报表数据类型
export interface HqBusinessLineData {
  id: string;
  month: string;
  businessLine: string;
  headcount: number;
  laborCost: number;
  fixedSalary: number;
  variableSalary: number;
  socialBenefits: number;
  ratio: number;
}

export interface HqDeptData {
  id: string;
  month: string;
  department: string;
  businessLine: string;
  headcount: number;
  laborCost: number;
  fixedSalary: number;
  variableSalary: number;
  ratio: number;
}

export interface PlatformData {
  id: string;
  month: string;
  platform: string;
  headcount: number;
  laborCost: number;
  fixedSalary: number;
  variableSalary: number;
  revenue: number;
  perCapitaRevenue: number;
}

export interface BudgetLaborCostData {
  id: string;
  month: string;                                // YYYY-MM
  segment: '总部' | '自营' | '线上' | '犀利工厂';  // 业务板块
  center: string;                               // 中心
  department: string;                           // 部门
  businessLine: string;                         // 业务线
  headcount: number;                             // 人数
  laborCost: number;                            // 人力成本(万)
  budgetLaborCost: number;                       // 预算人力成本(万)
  // usageRate 为公式字段: laborCost / budgetLaborCost * 100
}

// 人力成本组成结构
export interface CostStructureData {
  id: string;
  month: string;           // YYYY-MM
  segment: string;        // 业务板块
  attendanceSalary: number;    // 考勤工资(万)
  performanceBonus: number;     // 效益奖金(万)
  overtimePay: number;         // 加班费(万)
  annualLeaveAllowance: number; // 年假补贴(万)
  sickLeavePay: number;         // 病假工资(万)
  maternityLeavePay: number;    // 产假工资(万)
  otherPayable: number;         // 其他应发(万)
  employerSocialInsurance: number; // 单位社保公积金(万)
}
