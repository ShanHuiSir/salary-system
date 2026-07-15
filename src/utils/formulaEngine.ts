import type { FieldDef, FormulaDef } from '@/types/fieldConfig';

/**
 * 公式计算引擎
 * 支持基本数学运算：+ - * / () 和字段引用
 * 示例表达式：totalLaborCost / headcount、laborCost / totalRevenue * 100
 */

/** 从公式表达式中提取依赖的字段键名 */
export function extractDependencies(expression: string): string[] {
  // 匹配变量名：字母开头，后跟字母/数字/下划线
  const regex = /[a-zA-Z_][a-zA-Z0-9_]* /g;
  const matches = expression.match(regex);
  if (!matches) return [];
  // 过滤掉数学函数名（如果将来支持）
  const mathFuncs = ['abs', 'max', 'min', 'round', 'floor', 'ceil', 'sqrt', 'pow', 'log'];
  return matches.map((m) => m.trim()).filter((m) => !mathFuncs.includes(m.toLowerCase()));
}

/** 安全地执行公式计算 */
export function evaluateFormula(
  formula: FormulaDef,
  rowData: Record<string, unknown>,
): number | null {
  try {
    const expression = formula.expression;

    // 构建变量映射
    const variables: Record<string, number> = {};
    for (const depKey of formula.dependsOn) {
      const value = rowData[depKey];
      if (value === undefined || value === null) return null;
      const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : null;
      if (num === null || Number.isNaN(num)) return null;
      variables[depKey] = num;
    }

    // 将表达式中的字段名替换为变量值
    // 需要按最长匹配优先替换，避免 "totalRevenue" 先替换 "Revenue" 的问题
    const sortedKeys = [...formula.dependsOn].sort((a, b) => b.length - a.length);
    let safeExpr = expression;
    for (const key of sortedKeys) {
      // 使用全局替换，但只替换完整的变量名（前后不是字母/数字/下划线）
      const regex = new RegExp(`(?<![a-zA-Z0-9_])${key}(?![a-zA-Z0-9_])`, 'g');
      const val = variables[key];
      safeExpr = safeExpr.replace(regex, `(${val})`);
    }

    // 安全检查：只允许数字、运算符、括号、空格和小数点
    const sanitized = safeExpr.replace(/\s/g, '');
    if (!/^[\d+\-*/().eE]+$/.test(sanitized)) {
      // 包含非法字符
      return null;
    }

    // 空表达式
    if (sanitized.trim() === '') return null;

    // 执行计算
    const result = Function(`"use strict"; return (${safeExpr})`)() as number;

    if (typeof result !== 'number' || !Number.isFinite(result)) return null;

    // 应用精度
    const precision = formula.precision ?? 2;
    return parseFloat(result.toFixed(precision));
  } catch {
    return null;
  }
}

/** 为一行数据计算所有公式字段的值 */
export function computeFormulaFields(
  rowData: Record<string, unknown>,
  allFields: FieldDef[]
): Record<string, number | null> {
  const results: Record<string, number | null> = {};
  const formulaFields = allFields.filter((f) => f.type === 'formula' && f.formula);

  for (const field of formulaFields) {
    if (!field.formula) continue;
    results[field.key] = evaluateFormula(field.formula, rowData);
  }

  return results;
}

/** 验证公式表达式是否合法 */
export function validateFormulaExpression(
  expression: string,
  availableFields: FieldDef[]
): { valid: boolean; errors: string[]; dependsOn: string[] } {
  const errors: string[] = [];
  const deps = extractDependencies(expression);

  if (!expression.trim()) {
    errors.push('公式表达式不能为空');
    return { valid: false, errors, dependsOn: [] };
  }

  // 检查依赖字段是否存在
  const availableKeys = availableFields.map((f) => f.key);
  for (const dep of deps) {
    if (!availableKeys.includes(dep)) {
      errors.push(`引用的字段 "${dep}" 不存在`);
    }
  }

  // 检查是否引用了其他公式字段（避免循环依赖）
  const formulaKeys = availableFields.filter((f) => f.type === 'formula').map((f) => f.key);
  for (const dep of deps) {
    if (formulaKeys.includes(dep)) {
      errors.push(`不能引用其他公式字段 "${dep}"（避免循环依赖）`);
    }
  }

  // 尝试用模拟值计算
  if (deps.length > 0 && errors.length === 0) {
    const mockData: Record<string, unknown> = {};
    for (const dep of deps) {
      mockData[dep] = 1; // 模拟值
    }
    const formula: FormulaDef = { expression, dependsOn: deps, precision: 2 };
    const result = evaluateFormula(formula, mockData);
    if (result === null) {
      errors.push('公式表达式计算失败，请检查语法');
    }
  }

  return { valid: errors.length === 0, errors, dependsOn: deps };
}
