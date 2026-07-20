import type { DataType } from '@/types';

/**
 * 通用 CSV 解析工具。
 *
 * 列定义由 FieldConfigContext 中的字段配置唯一维护，避免 CSV 模板、表单和列表
 * 各自维护一套字段清单而发生漂移。
 */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  return {
    headers: parseLine(lines[0]),
    rows: lines.slice(1).map(parseLine),
  };
}

/** 导入预览和批量导入共用的行级结果类型。 */
export interface ParsedRow {
  data: Record<string, unknown>;
  errors: string[];
  rowIndex: number;
}

/** 为导入的行生成本地存储使用的 ID。 */
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
