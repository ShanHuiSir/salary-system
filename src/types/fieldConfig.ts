import type { DataType } from '@/types';

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'enum' | 'text' | 'formula';

/** 公式定义 */
export interface FormulaDef {
  /** 公式表达式，如 "totalLaborCost / headcount"、"laborCost / totalRevenue * 100" */
  expression: string;
  /** 依赖的字段键名列表（自动从 expression 中提取或手动指定） */
  dependsOn: string[];
  /** 结果精度（小数位数），默认 2 */
  precision?: number;
  /** 公式描述/备注 */
  description?: string;
}

/** 单个字段配置 */
export interface FieldDef {
  key: string;             // 字段键名（如 totalRevenue）
  label: string;           // 显示标签（如 总业绩(万)）
  type: FieldType;         // 字段类型
  required: boolean;       // 是否必填
  enumValues?: string[];   // enum 类型的可选值
  suffix?: string;         // 显示后缀（如 "万", "%"）
  visibleInList: boolean;  // 是否在数据列表中显示该列
  system: boolean;         // 系统字段不可删除（如 id, month）
  order: number;           // 显示排序
  formula?: FormulaDef;    // formula 类型时必填
}

/** 每种数据类型的字段配置列表 */
export type FieldConfigs = Record<DataType, FieldDef[]>;

// ============ 默认字段配置 ============

export const defaultFieldConfigs: FieldConfigs = {
  overview: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'totalRevenue', label: '总业绩(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 2 },
    { key: 'selfOperatedRevenue', label: '自营业绩(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 3 },
    { key: 'franchiseRevenue', label: '加盟业绩(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 4 },
    { key: 'platformRevenue', label: '线上业绩(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 5 },
    { key: 'factoryRevenue', label: '犀利产值(万)', type: 'number', required: false, suffix: '万', visibleInList: true, system: false, order: 6 },
    { key: 'totalLaborCost', label: '人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 7 },
    { key: 'avgSalary', label: '平均人力成本', type: 'number', required: true, visibleInList: true, system: false, order: 8 },
    { key: 'laborCostRatio', label: '人力成本占比(%)', type: 'number', required: true, suffix: '%', visibleInList: true, system: false, order: 9 },
    { key: 'perCapitaRevenue', label: '人均营收', type: 'number', required: true, visibleInList: true, system: false, order: 10 },
    { key: 'storeEfficiency', label: '店效', type: 'number', required: true, visibleInList: true, system: false, order: 11 },
    { key: 'momRevenue', label: '营收环比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 12 },
    { key: 'yoyRevenue', label: '营收同比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 13 },
    { key: 'momLaborCost', label: '人力成本环比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 14 },
    { key: 'yoyLaborCost', label: '人力成本同比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 15 },
  ],
  department: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'department', label: '部门', type: 'enum', required: true, enumValues: ['全公司', '总部', '自营', '线上', '犀利工厂', '加盟'], visibleInList: true, system: false, order: 2 },
    { key: 'headcount', label: '人数', type: 'number', required: true, visibleInList: true, system: false, order: 3 },
    { key: 'laborCost', label: '人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 4 },
    { key: 'avgSalary', label: '平均人力成本', type: 'number', required: true, visibleInList: false, system: false, order: 5 },
    { key: 'perCapitaRevenue', label: '人均营收', type: 'number', required: true, visibleInList: true, system: false, order: 6 },
    { key: 'storeEfficiency', label: '店效', type: 'number', required: true, visibleInList: true, system: false, order: 7 },
    { key: 'laborCostRatio', label: '人力成本占比(%)', type: 'number', required: true, suffix: '%', visibleInList: false, system: false, order: 8 },
    { key: 'momLaborCost', label: '人力成本环比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 9 },
    { key: 'yoyLaborCost', label: '人力成本同比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 10 },
    { key: 'momHeadcount', label: '人数环比', type: 'number', required: true, visibleInList: false, system: false, order: 11 },
    { key: 'yoyHeadcount', label: '人数同比', type: 'number', required: true, visibleInList: false, system: false, order: 12 },
  ],
  composition: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'department', label: '部门', type: 'enum', required: true, enumValues: ['总部', '自营', '线上', '犀利工厂'], visibleInList: true, system: false, order: 2 },
    { key: 'fixedIncome', label: '固定收入(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 3 },
    { key: 'floatingIncome', label: '浮动收入(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 4 },
    { key: 'socialInsurance', label: '社保公积金(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 5 },
    { key: 'severance', label: '经济补偿金(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 6 },
    { key: 'outsourcing', label: '外包费用(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 7 },
  ],
  position: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'department', label: '部门', type: 'enum', required: true, enumValues: ['总部', '自营', '犀利工厂'], visibleInList: true, system: false, order: 2 },
    { key: 'level', label: '职级', type: 'string', required: true, visibleInList: true, system: false, order: 3 },
    { key: 'headcount', label: '人数', type: 'number', required: true, visibleInList: true, system: false, order: 4 },
    { key: 'laborCost', label: '人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 5 },
    { key: 'ratio', label: '占比(%)', type: 'number', required: true, suffix: '%', visibleInList: true, system: false, order: 6 },
    { key: 'momHeadcount', label: '人数环比', type: 'number', required: true, visibleInList: false, system: false, order: 7 },
    { key: 'yoyHeadcount', label: '人数同比', type: 'number', required: true, visibleInList: false, system: false, order: 8 },
  ],
  store: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'region', label: '区域', type: 'string', required: true, visibleInList: true, system: false, order: 2 },
    { key: 'storeCount', label: '门店数', type: 'number', required: true, visibleInList: true, system: false, order: 3 },
    { key: 'revenue', label: '营收(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 4 },
    { key: 'laborCost', label: '人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 5 },
    { key: 'storeEfficiency', label: '店效', type: 'number', required: true, visibleInList: true, system: false, order: 6 },
    { key: 'personEfficiency', label: '人效', type: 'number', required: true, visibleInList: true, system: false, order: 7 },
    { key: 'momRevenue', label: '营收环比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 8 },
    { key: 'yoyRevenue', label: '营收同比(万)', type: 'number', required: true, suffix: '万', visibleInList: false, system: false, order: 9 },
  ],
  budget: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'segment', label: '业务板块', type: 'enum', required: true, enumValues: ['总部', '自营', '线上', '犀利工厂'], visibleInList: true, system: false, order: 2 },
    { key: 'center', label: '中心', type: 'string', required: true, visibleInList: true, system: false, order: 3 },
    { key: 'department', label: '部门', type: 'string', required: true, visibleInList: true, system: false, order: 4 },
    { key: 'businessLine', label: '业务线', type: 'string', required: true, visibleInList: true, system: false, order: 5 },
    { key: 'headcount', label: '人数', type: 'number', required: true, visibleInList: true, system: false, order: 6 },
    { key: 'laborCost', label: '人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 7 },
    { key: 'budgetLaborCost', label: '预算人力成本(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 8 },
    { key: 'storePerformance', label: '店铺业绩(万)', type: 'number', required: false, suffix: '万', visibleInList: true, system: false, order: 9 },
    { key: 'effectiveContributorCount', label: '有效贡献人数', type: 'number', required: false, visibleInList: true, system: false, order: 10 },
    {
      key: 'storeEfficiency',
      label: '店铺人效(万/人)',
      type: 'formula',
      required: false,
      suffix: '万/人',
      visibleInList: true,
      system: false,
      order: 11,
      formula: {
        expression: 'storePerformance / headcount',
        dependsOn: ['storePerformance', 'headcount'],
        precision: 2,
        description: '店铺业绩 / 人数',
      },
    },
    {
      key: 'laborCostRatio',
      label: '人力成本占比(%)',
      type: 'formula',
      required: false,
      suffix: '%',
      visibleInList: true,
      system: false,
      order: 12,
      formula: {
        expression: 'laborCost / storePerformance * 100',
        dependsOn: ['laborCost', 'storePerformance'],
        precision: 1,
        description: '人力成本 / 店铺业绩 × 100',
      },
    },
    {
      key: 'usageRate',
      label: '人力成本使用率(%)',
      type: 'formula',
      required: false,
      suffix: '%',
      visibleInList: true,
      system: false,
      order: 13,
      formula: {
        expression: 'laborCost / budgetLaborCost * 100',
        dependsOn: ['laborCost', 'budgetLaborCost'],
        precision: 1,
        description: '人力成本 / 预算人力成本 × 100',
      },
    },
  ],
  costStructure: [
    { key: 'id', label: 'ID', type: 'string', required: true, visibleInList: false, system: true, order: 0 },
    { key: 'month', label: '月份(YYYY-MM)', type: 'string', required: true, visibleInList: true, system: true, order: 1 },
    { key: 'segment', label: '业务板块', type: 'enum', required: true, enumValues: ['总部', '自营', '线上', '犀利工厂'], visibleInList: true, system: false, order: 2 },
    { key: 'attendanceSalary', label: '考勤工资(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 3 },
    { key: 'performanceBonus', label: '效益奖金(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 4 },
    { key: 'overtimePay', label: '加班费(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 5 },
    { key: 'sickMaternityAnnualLeave', label: '病假/产假/年假工资(万)', type: 'number', required: false, suffix: '万', visibleInList: true, system: false, order: 6 },
    { key: 'severance', label: '经济补偿金(万)', type: 'number', required: false, suffix: '万', visibleInList: true, system: false, order: 7 },
    { key: 'jjbcj', label: '经济补偿金-旧字段(万)', type: 'number', required: false, suffix: '万', visibleInList: false, system: false, order: 8 },
    { key: 'annualLeaveAllowance', label: '年假补贴(旧)(万)', type: 'number', required: false, suffix: '万', visibleInList: false, system: false, order: 9 },
    { key: 'sickLeavePay', label: '病假工资(旧)(万)', type: 'number', required: false, suffix: '万', visibleInList: false, system: false, order: 10 },
    { key: 'maternityLeavePay', label: '产假工资(旧)(万)', type: 'number', required: false, suffix: '万', visibleInList: false, system: false, order: 11 },
    { key: 'otherPayable', label: '其他应发(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 12 },
    { key: 'employerSocialInsurance', label: '单位社保公积金(万)', type: 'number', required: true, suffix: '万', visibleInList: true, system: false, order: 13 },
  ],
};

/** 获取非系统字段（用户可自定义的） */
export function getUserFields(configs: FieldDef[]): FieldDef[] {
  return configs.filter((f) => !f.system).sort((a, b) => a.order - b.order);
}

/** 获取列表可见字段 */
export function getListVisibleFields(configs: FieldDef[]): FieldDef[] {
  return configs.filter((f) => f.visibleInList && f.key !== 'id').sort((a, b) => a.order - b.order);
}

/** 获取表单可编辑字段（排除 id 和 formula 字段，formula 自动计算不可手动输入） */
export function getFormFields(configs: FieldDef[]): FieldDef[] {
  return configs.filter((f) => f.key !== 'id' && f.type !== 'formula').sort((a, b) => a.order - b.order);
}

/** 获取所有字段（包括 formula 字段）用于表单显示 */
export function getAllFormFields(configs: FieldDef[]): FieldDef[] {
  return configs.filter((f) => f.key !== 'id').sort((a, b) => a.order - b.order);
}

/** 获取公式字段列表 */
export function getFormulaFields(configs: FieldDef[]): FieldDef[] {
  return configs.filter((f) => f.type === 'formula').sort((a, b) => a.order - b.order);
}

/** 常用公式模板 */
export const formulaTemplates: { label: string; expression: string; description: string }[] = [
  { label: '占比(%)', expression: 'fieldA / fieldB * 100', description: 'A字段占B字段的百分比' },
  { label: '人均值', expression: 'fieldA / headcount', description: 'A字段除以人数' },
  { label: '合计', expression: 'fieldA + fieldB + fieldC', description: '多个字段之和' },
  { label: '差值', expression: 'fieldA - fieldB', description: 'A字段减B字段' },
  { label: '店效', expression: 'revenue / storeCount', description: '营收除以门店数' },
  { label: '环比增长率(%)', expression: '(fieldA - fieldB) / fieldB * 100', description: '当期减上期除以上期' },
  { label: '固定占比(%)', expression: 'fixedIncome / (fixedIncome + floatingIncome) * 100', description: '固定收入占固浮收入比' },
  { label: '使用率(%)', expression: 'laborCost / budgetLaborCost * 100', description: '实际人力成本占预算比' },
];
