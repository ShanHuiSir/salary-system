import type { DataType } from '@/types';

/**
 * CSV 列定义：每种数据类型对应的 CSV 列名和系统字段名的映射
 */
export interface ColumnDef {
  csvHeader: string;     // CSV 文件中的列标题（中文）
  fieldKey: string;      // 系统内部字段名
  required: boolean;     // 是否必填
  type: 'string' | 'number' | 'enum';  // 值类型
  enumValues?: string[]; // 枚举可选值
  label: string;         // 用户界面标签
}

export const columnDefs: Record<DataType, ColumnDef[]> = {
  overview: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '总业绩', fieldKey: 'totalRevenue', required: true, type: 'number', label: '总业绩(万)' },
    { csvHeader: '自营业绩', fieldKey: 'selfOperatedRevenue', required: true, type: 'number', label: '自营区域业绩(万)' },
    { csvHeader: '代理业绩', fieldKey: 'franchiseRevenue', required: true, type: 'number', label: '代理区域业绩(万)' },
    { csvHeader: '线上业绩', fieldKey: 'platformRevenue', required: true, type: 'number', label: '线上业绩(万)' },
    { csvHeader: '犀利产值', fieldKey: 'factoryRevenue', required: false, type: 'number', label: '犀利产值(万)' },
    { csvHeader: '人力成本', fieldKey: 'totalLaborCost', required: true, type: 'number', label: '人力成本(万)' },
    { csvHeader: '平均人力成本', fieldKey: 'avgSalary', required: true, type: 'number', label: '平均人力成本' },
    { csvHeader: '人力成本占比', fieldKey: 'laborCostRatio', required: true, type: 'number', label: '人力成本占比(%)' },
    { csvHeader: '人均营收', fieldKey: 'perCapitaRevenue', required: true, type: 'number', label: '人均营收' },
    { csvHeader: '店效', fieldKey: 'storeEfficiency', required: true, type: 'number', label: '店效' },
    { csvHeader: '营收环比', fieldKey: 'momRevenue', required: true, type: 'number', label: '营收环比(万)' },
    { csvHeader: '营收同比', fieldKey: 'yoyRevenue', required: true, type: 'number', label: '营收同比(万)' },
    { csvHeader: '人力成本环比', fieldKey: 'momLaborCost', required: true, type: 'number', label: '人力成本环比(万)' },
    { csvHeader: '人力成本同比', fieldKey: 'yoyLaborCost', required: true, type: 'number', label: '人力成本同比(万)' },
  ],
  department: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '部门', fieldKey: 'department', required: true, type: 'enum', enumValues: ['全公司', '总部', '自营', '线上', '犀利工厂', '加盟'], label: '部门' },
    { csvHeader: '人数', fieldKey: 'headcount', required: true, type: 'number', label: '人数' },
    { csvHeader: '人力成本', fieldKey: 'laborCost', required: true, type: 'number', label: '人力成本(万)' },
    { csvHeader: '平均人力成本', fieldKey: 'avgSalary', required: true, type: 'number', label: '平均人力成本' },
    { csvHeader: '人均营收', fieldKey: 'perCapitaRevenue', required: true, type: 'number', label: '人均营收' },
    { csvHeader: '店效', fieldKey: 'storeEfficiency', required: true, type: 'number', label: '店效' },
    { csvHeader: '人力成本占比', fieldKey: 'laborCostRatio', required: true, type: 'number', label: '人力成本占比(%)' },
    { csvHeader: '人力成本环比', fieldKey: 'momLaborCost', required: true, type: 'number', label: '人力成本环比(万)' },
    { csvHeader: '人力成本同比', fieldKey: 'yoyLaborCost', required: true, type: 'number', label: '人力成本同比(万)' },
    { csvHeader: '人数环比', fieldKey: 'momHeadcount', required: true, type: 'number', label: '人数环比' },
    { csvHeader: '人数同比', fieldKey: 'yoyHeadcount', required: true, type: 'number', label: '人数同比' },
  ],
  composition: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '部门', fieldKey: 'department', required: true, type: 'enum', enumValues: ['总部', '自营', '线上', '犀利工厂'], label: '部门' },
    { csvHeader: '固定收入', fieldKey: 'fixedIncome', required: true, type: 'number', label: '固定收入(万)' },
    { csvHeader: '浮动收入', fieldKey: 'floatingIncome', required: true, type: 'number', label: '浮动收入(万)' },
    { csvHeader: '社保公积金', fieldKey: 'socialInsurance', required: true, type: 'number', label: '社保公积金(万)' },
    { csvHeader: '经济补偿金', fieldKey: 'severance', required: true, type: 'number', label: '经济补偿金(万)' },
    { csvHeader: '外包费用', fieldKey: 'outsourcing', required: true, type: 'number', label: '外包费用(万)' },
  ],
  position: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '部门', fieldKey: 'department', required: true, type: 'enum', enumValues: ['总部', '自营', '犀利工厂'], label: '部门' },
    { csvHeader: '职级', fieldKey: 'level', required: true, type: 'string', label: '职级' },
    { csvHeader: '人数', fieldKey: 'headcount', required: true, type: 'number', label: '人数' },
    { csvHeader: '人力成本', fieldKey: 'laborCost', required: true, type: 'number', label: '人力成本(万)' },
    { csvHeader: '占比', fieldKey: 'ratio', required: true, type: 'number', label: '占比(%)' },
    { csvHeader: '人数环比', fieldKey: 'momHeadcount', required: true, type: 'number', label: '人数环比' },
    { csvHeader: '人数同比', fieldKey: 'yoyHeadcount', required: true, type: 'number', label: '人数同比' },
  ],
  store: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '区域', fieldKey: 'region', required: true, type: 'string', label: '区域' },
    { csvHeader: '门店数', fieldKey: 'storeCount', required: true, type: 'number', label: '门店数' },
    { csvHeader: '营收', fieldKey: 'revenue', required: true, type: 'number', label: '营收(万)' },
    { csvHeader: '人力成本', fieldKey: 'laborCost', required: true, type: 'number', label: '人力成本(万)' },
    { csvHeader: '店效', fieldKey: 'storeEfficiency', required: true, type: 'number', label: '店效' },
    { csvHeader: '人效', fieldKey: 'personEfficiency', required: true, type: 'number', label: '人效' },
    { csvHeader: '营收环比', fieldKey: 'momRevenue', required: true, type: 'number', label: '营收环比(万)' },
    { csvHeader: '营收同比', fieldKey: 'yoyRevenue', required: true, type: 'number', label: '营收同比(万)' },
  ],
  budget: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '业务板块', fieldKey: 'segment', required: true, type: 'enum', enumValues: ['总部', '自营', '线上', '犀利工厂'], label: '业务板块' },
    { csvHeader: '中心', fieldKey: 'center', required: true, type: 'string', label: '中心' },
    { csvHeader: '部门', fieldKey: 'department', required: true, type: 'string', label: '部门' },
    { csvHeader: '业务线', fieldKey: 'businessLine', required: true, type: 'string', label: '业务线' },
    { csvHeader: '人数', fieldKey: 'headcount', required: true, type: 'number', label: '人数' },
    { csvHeader: '人力成本', fieldKey: 'laborCost', required: true, type: 'number', label: '人力成本(万)' },
    { csvHeader: '预算人力成本', fieldKey: 'budgetLaborCost', required: true, type: 'number', label: '预算人力成本(万)' },
    // usageRate 为公式字段，导入时自动计算，不需要在 CSV 中
  ],
  costStructure: [
    { csvHeader: '月份', fieldKey: 'month', required: true, type: 'string', label: '月份(YYYY-MM)' },
    { csvHeader: '业务板块', fieldKey: 'segment', required: true, type: 'enum', enumValues: ['总部', '自营', '线上', '犀利工厂'], label: '业务板块' },
    { csvHeader: '考勤工资', fieldKey: 'attendanceSalary', required: true, type: 'number', label: '考勤工资(万)' },
    { csvHeader: '效益奖金', fieldKey: 'performanceBonus', required: true, type: 'number', label: '效益奖金(万)' },
    { csvHeader: '加班费', fieldKey: 'overtimePay', required: true, type: 'number', label: '加班费(万)' },
    { csvHeader: '年假补贴', fieldKey: 'annualLeaveAllowance', required: true, type: 'number', label: '年假补贴(万)' },
    { csvHeader: '病假工资', fieldKey: 'sickLeavePay', required: true, type: 'number', label: '病假工资(万)' },
    { csvHeader: '产假工资', fieldKey: 'maternityLeavePay', required: true, type: 'number', label: '产假工资(万)' },
    { csvHeader: '其他应发', fieldKey: 'otherPayable', required: true, type: 'number', label: '其他应发(万)' },
    { csvHeader: '单位社保公积金', fieldKey: 'employerSocialInsurance', required: true, type: 'number', label: '单位社保公积金(万)' },
  ],
};

/** 生成 CSV 模板内容 */
export function generateCsvTemplate(dataType: DataType): string {
  const defs = columnDefs[dataType];
  const headers = defs.map((d) => d.csvHeader);
  // 添加示例行
  const exampleRow = defs.map((d) => {
    if (d.type === 'enum' && d.enumValues) return d.enumValues[0];
    if (d.type === 'number') return '0';
    if (d.fieldKey === 'month') return '2026-05';
    return '示例';
  });
  return [headers.join(','), exampleRow.join(',')].join('\n');
}

/**
 * 解析 CSV 文本为结构化数据行
 * 支持逗号分隔，处理引号内的逗号
 */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/** 验证并转换 CSV 行数据到系统内部格式 */
export interface ParsedRow {
  data: Record<string, unknown>;
  errors: string[];
  rowIndex: number;
}

export function parseRows(
  dataType: DataType,
  csvHeaders: string[],
  csvRows: string[][]
): ParsedRow[] {
  const defs = columnDefs[dataType];

  // 建立 csvHeader → ColumnDef 映射
  const headerMap = new Map<string, ColumnDef>();
  for (const d of defs) {
    headerMap.set(d.csvHeader, d);
    // 也支持用英文字段名作为 header
    headerMap.set(d.fieldKey, d);
  }

  // 建立 csvHeaders 的索引映射
  const colIndexMap = new Map<number, ColumnDef>();
  for (let i = 0; i < csvHeaders.length; i++) {
    const h = csvHeaders[i].trim();
    const def = headerMap.get(h);
    if (def) {
      colIndexMap.set(i, def);
    }
  }

  return csvRows.map((row, idx) => {
    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    // 检查缺少的必填列
    const matchedFields = new Set<string>();
    for (const [, def] of colIndexMap) {
      matchedFields.add(def.fieldKey);
    }
    for (const d of defs) {
      if (d.required && !matchedFields.has(d.fieldKey)) {
        errors.push(`缺少必填列: ${d.csvHeader}`);
      }
    }

    // 解析每列
    for (let i = 0; i < row.length; i++) {
      const def = colIndexMap.get(i);
      if (!def) continue; // 跳过未映射的列

      const rawValue = row[i]?.trim() ?? '';

      if (rawValue === '' && !def.required) {
        data[def.fieldKey] = def.type === 'number' ? 0 : '';
        continue;
      }

      if (rawValue === '' && def.required) {
        errors.push(`${def.csvHeader} 不能为空`);
        continue;
      }

      if (def.type === 'number') {
        const num = parseFloat(rawValue);
        if (Number.isNaN(num)) {
          errors.push(`${def.csvHeader} 不是有效数字: "${rawValue}"`);
        } else {
          data[def.fieldKey] = num;
        }
      } else if (def.type === 'enum' && def.enumValues) {
        if (!def.enumValues.includes(rawValue)) {
          errors.push(`${def.csvHeader} 值 "${rawValue}" 不在可选范围: ${def.enumValues.join('/')}`);
        } else {
          data[def.fieldKey] = rawValue;
        }
      } else {
        data[def.fieldKey] = rawValue;
      }
    }

    return { data, errors, rowIndex: idx + 1 };
  });
}

/** 为导入的行生成 ID */
export function generateImportId(dataType: DataType, data: Record<string, unknown>): string {
  const month = String(data.month ?? '2026-05');
  const rand = Math.random().toString(36).slice(2, 7);
  switch (dataType) {
    case 'overview':
      return `ov-${month}-${rand}`;
    case 'department':
      return `dept-${month}-${data.department ?? rand}`;
    case 'composition':
      return `cost-${month}-${data.department ?? rand}`;
    case 'position':
      return `pos-${month}-${rand}`;
    case 'store':
      return `store-${month}-${rand}`;
    case 'budget':
      return `bud-${month}-${rand}`;
    case 'costStructure':
      return `cs-${month}-${data.segment ?? rand}`;
  }
}
