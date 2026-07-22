import { z } from 'zod';

const month = z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份必须为 YYYY-MM 格式');
const text = z.string().trim().min(1, '该字段不能为空').max(100, '字段长度不能超过 100 个字符');
const finiteNumber = z.coerce.number().finite('必须是有效数字');
const nonNegativeNumber = finiteNumber.min(0, '不能小于 0');
const nonNegativeInteger = z.coerce.number().int('必须是整数').min(0, '不能小于 0');
const optionalNumber = finiteNumber.optional();
const optionalNonNegativeNumber = nonNegativeNumber.optional();
const optionalInteger = nonNegativeInteger.optional();
const optionalSignedInteger = z.coerce.number().int('必须是整数').optional();

function normalizeBudgetInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const data = { ...(input as Record<string, unknown>) };
  if (data.storePerformance === undefined) {
    for (const key of ['salesTarget', 'sales_target', '销售目标', '销售目标(万)', '店铺业绩', '店铺业绩(万)']) {
      if (data[key] !== undefined) {
        data.storePerformance = data[key];
        break;
      }
    }
  }
  if (data.effectiveContributorCount === undefined) {
    data.effectiveContributorCount = firstDefined(data, ['有效贡献人数', '有效贡献人数(人)', 'effectiveContributors', 'effective_contributor_count']);
  }
  return data;
}

function firstDefined(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined) return data[key];
  }
  return undefined;
}

function normalizeCostStructureInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const data = { ...(input as Record<string, unknown>) };
  if (data.sickMaternityAnnualLeave === undefined) {
    const merged = firstDefined(data, ['病假/产假/年假工资', '病假/产假/年假工资(万)']);
    if (merged !== undefined) data.sickMaternityAnnualLeave = merged;
  }
  if (data.annualLeaveAllowance === undefined) data.annualLeaveAllowance = firstDefined(data, ['年假补贴', '年假补贴(万)', '年假补贴(旧)(万)']);
  if (data.sickLeavePay === undefined) data.sickLeavePay = firstDefined(data, ['病假工资', '病假工资(万)', '病假工资(旧)(万)']);
  if (data.maternityLeavePay === undefined) data.maternityLeavePay = firstDefined(data, ['产假工资', '产假工资(万)', '产假工资(旧)(万)']);
  if (data.severance === undefined) data.severance = firstDefined(data, ['经济补偿金', '经济补偿金(万)', '经济补偿金-旧字段', '经济补偿金-旧字段(万)', 'jjbcj', 'JJBCJ']);
  if (data.jjbcj === undefined) data.jjbcj = firstDefined(data, ['经济补偿金-旧字段', '经济补偿金-旧字段(万)', 'JJBCJ']);
  return data;
}

/**
 * 仅允许业务字段进入 Prisma。对象默认会剥离 id、时间戳及其他未知字段，
 * 从而避免客户端覆盖系统字段或将无效列直接写入数据库。
 */
export const dataSchemas = {
  overview: z.object({
    month,
    totalRevenue: optionalNonNegativeNumber,
    selfOperatedRevenue: optionalNonNegativeNumber,
    franchiseRevenue: optionalNonNegativeNumber,
    platformRevenue: optionalNonNegativeNumber,
    factoryRevenue: optionalNonNegativeNumber,
    totalLaborCost: optionalNonNegativeNumber,
    avgSalary: optionalNumber,
    laborCostRatio: optionalNumber,
    perCapitaRevenue: optionalNumber,
    storeEfficiency: optionalNumber,
    momRevenue: optionalNumber,
    yoyRevenue: optionalNumber,
    momLaborCost: optionalNumber,
    yoyLaborCost: optionalNumber,
  }),
  department: z.object({
    month,
    department: text,
    headcount: optionalInteger,
    laborCost: optionalNumber,
    avgSalary: optionalNumber,
    perCapitaRevenue: optionalNumber,
    storeEfficiency: optionalNumber,
    laborCostRatio: optionalNumber,
    momLaborCost: optionalNumber,
    yoyLaborCost: optionalNumber,
    momHeadcount: optionalSignedInteger,
    yoyHeadcount: optionalSignedInteger,
  }),
  composition: z.object({
    month,
    department: text,
    fixedIncome: optionalNonNegativeNumber,
    floatingIncome: optionalNonNegativeNumber,
    socialInsurance: optionalNonNegativeNumber,
    severance: optionalNumber,
    outsourcing: optionalNonNegativeNumber,
  }),
  position: z.object({
    month,
    department: text,
    level: text,
    headcount: optionalInteger,
    laborCost: optionalNumber,
    ratio: optionalNumber,
    momHeadcount: optionalSignedInteger,
    yoyHeadcount: optionalSignedInteger,
  }),
  store: z.object({
    month,
    region: text,
    storeCount: optionalInteger,
    revenue: optionalNonNegativeNumber,
    laborCost: optionalNonNegativeNumber,
    storeEfficiency: optionalNumber,
    personEfficiency: optionalNumber,
    momRevenue: optionalNumber,
    yoyRevenue: optionalNumber,
  }),
  budget: z.preprocess(normalizeBudgetInput, z.object({
    month,
    segment: text,
    center: text,
    department: text,
    businessLine: text,
    headcount: optionalInteger,
    laborCost: optionalNonNegativeNumber,
    budgetLaborCost: optionalNonNegativeNumber,
    storePerformance: optionalNonNegativeNumber,
    effectiveContributorCount: optionalNonNegativeNumber,
  })),
  costStructure: z.preprocess(normalizeCostStructureInput, z.object({
    month,
    segment: text,
    attendanceSalary: optionalNumber,
    performanceBonus: optionalNumber,
    overtimePay: optionalNumber,
    annualLeaveAllowance: optionalNumber,
    sickLeavePay: optionalNumber,
    maternityLeavePay: optionalNumber,
    sickMaternityAnnualLeave: optionalNumber,
    severance: optionalNumber,
    jjbcj: optionalNumber,
    otherPayable: optionalNumber,
    employerSocialInsurance: optionalNumber,
  })),
  hqBusinessLine: z.object({
    month,
    businessLine: text,
    headcount: optionalInteger,
    laborCost: optionalNumber,
    fixedSalary: optionalNumber,
    variableSalary: optionalNumber,
    socialBenefits: optionalNumber,
    ratio: optionalNumber,
  }),
  hqDept: z.object({
    month,
    department: text,
    businessLine: text,
    headcount: optionalInteger,
    laborCost: optionalNumber,
    fixedSalary: optionalNumber,
    variableSalary: optionalNumber,
    ratio: optionalNumber,
  }),
  platform: z.object({
    month,
    platform: text,
    headcount: optionalInteger,
    laborCost: optionalNumber,
    fixedSalary: optionalNumber,
    variableSalary: optionalNumber,
    revenue: optionalNumber,
    perCapitaRevenue: optionalNumber,
  }),
} as const;

export type ServerDataType = keyof typeof dataSchemas;

export function validateDataRecord(dataType: ServerDataType, input: unknown) {
  return dataSchemas[dataType].safeParse(input);
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '数据'}：${issue.message}`)
    .join('；');
}
