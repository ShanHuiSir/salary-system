/**
 * 字段展示与导入兼容规范。
 *
 * - 字段键名（如 franchiseRevenue）是唯一的内部标识；不因展示文案而变化。
 * - CSV 导入接受历史列名，导出和新建模板只使用规范列名。
 */
const LEGACY_CSV_HEADERS: Readonly<Record<string, readonly string[]>> = {
  franchiseRevenue: [
    '代理业绩',
    '代理业绩(万)',
    '代理区域业绩',
    '代理区域业绩(万)',
    '加盟业绩',
    '加盟业绩(万)',
  ],
};

const CANONICAL_FIELD_LABELS: Readonly<Record<string, string>> = {
  franchiseRevenue: '加盟业绩(万)',
};

/** 返回一个字段可接受的 CSV 列名（规范标签、字段键名及历史标签）。 */
export function getCsvHeaderAliases(fieldKey: string, canonicalLabel: string): string[] {
  return [...new Set([canonicalLabel, fieldKey, ...(LEGACY_CSV_HEADERS[fieldKey] ?? [])])];
}

/** 将已知的历史默认标签升级为规范标签，不覆盖用户自定义字段。 */
export function getCanonicalFieldLabel(fieldKey: string, currentLabel: string): string {
  const canonicalLabel = CANONICAL_FIELD_LABELS[fieldKey];
  if (!canonicalLabel) return currentLabel;

  const legacyLabels = LEGACY_CSV_HEADERS[fieldKey] ?? [];
  return legacyLabels.includes(currentLabel) ? canonicalLabel : currentLabel;
}
