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
  budget: z.object({
    month,
    segment: text,
    center: text,
    department: text,
    businessLine: text,
    headcount: optionalInteger,
    laborCost: optionalNonNegativeNumber,
    budgetLaborCost: optionalNonNegativeNumber,
    storePerformance: optionalNonNegativeNumber,
    effectiveContributorCount: optionalInteger,
  }),
  costStructure: z.object({
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
  }),
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
