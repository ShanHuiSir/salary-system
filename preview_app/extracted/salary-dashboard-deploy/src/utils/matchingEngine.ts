import type { DataType } from '@/types';
import type {
  MatchingRule,
  MatchType,
} from '@/types/dataBinding';
import { matchTypeLabels, dataTypeChineseLabels } from '@/types/dataBinding';
import type { DataSourceMap } from '@/utils/dataPathEngine';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

/** 匹配结果 */
export interface MatchResult {
  ruleId: string;
  ruleName: string;
  matchType: MatchType;
  sourceType: DataType;
  targetType: DataType;
  sourceField: string;
  targetField: string;
  matchField: string;
  totalSourceRecords: number;
  totalTargetRecords: number;
  matchedPairs: number;      // 成功匹配的对数
  unmatchedSource: number;   // 源数据中未匹配到目标的数量
  unmatchedTarget: number;   // 目标数据中未被源数据匹配的数量
  details: MatchDetail[];    // 详细匹配信息（前20条）
  status: 'all_matched' | 'partial_matched' | 'none_matched';
}

export interface MatchDetail {
  sourceRecord: Record<string, unknown>;
  targetRecord: Record<string, unknown> | null;
  sourceValue: unknown;
  targetValue: unknown | null;
  matched: boolean;
  reason: string;
}

/**
 * 执行单条匹配规则
 */
function applyRule(
  rule: MatchingRule,
  dataSources: DataSourceMap
): MatchResult {
  const sourceRecords = dataSources[rule.sourceType] ?? [];
  const targetRecords = dataSources[rule.targetType] ?? [];
  const tolerance = rule.tolerance ?? 5;

  const details: MatchDetail[] = [];
  let matchedPairs = 0;
  const matchedTargetIndices = new Set<number>();

  for (const sourceRecord of sourceRecords) {
    const matchFieldValue = sourceRecord[rule.matchField];
    if (matchFieldValue === undefined || matchFieldValue === null) {
      details.push({
        sourceRecord,
        targetRecord: null,
        sourceValue: sourceRecord[rule.sourceField],
        targetValue: null,
        matched: false,
        reason: `源数据缺少匹配字段 "${rule.matchField}"`,
      });
      continue;
    }

    const sourceFieldValue = sourceRecord[rule.sourceField];

    // 在目标数据中查找匹配
    let foundTarget: Record<string, unknown> | null = null;
    let foundReason = '';

    for (let i = 0; i < targetRecords.length; i++) {
      if (matchedTargetIndices.has(i)) continue;
      const targetRecord = targetRecords[i];
      const targetMatchValue = targetRecord[rule.matchField];

      // 匹配字段必须相等
      if (String(matchFieldValue) !== String(targetMatchValue)) continue;

      const targetFieldValue = targetRecord[rule.targetField];

      // 检查匹配类型
      let matched = false;
      let reason = '';

      switch (rule.matchType) {
        case 'exact': {
          const sv = typeof sourceFieldValue === 'number' ? sourceFieldValue : parseFloat(String(sourceFieldValue));
          const tv = typeof targetFieldValue === 'number' ? targetFieldValue : parseFloat(String(targetFieldValue));
          if (!Number.isNaN(sv) && !Number.isNaN(tv)) {
            matched = sv === tv;
            reason = matched ? `精确匹配: ${sv} = ${tv}` : `值不等: 源=${sv}, 目标=${tv}`;
          } else {
            matched = String(sourceFieldValue) === String(targetFieldValue);
            reason = matched ? `精确匹配: "${sourceFieldValue}" = "${targetFieldValue}"` : `值不等: 源="${sourceFieldValue}", 目标="${targetFieldValue}"`;
          }
          break;
        }
        case 'range': {
          const sv = typeof sourceFieldValue === 'number' ? sourceFieldValue : parseFloat(String(sourceFieldValue));
          const tv = typeof targetFieldValue === 'number' ? targetFieldValue : parseFloat(String(targetFieldValue));
          if (Number.isNaN(sv) || Number.isNaN(tv)) {
            reason = `数值无法解析: 源="${sourceFieldValue}", 目标="${targetFieldValue}"`;
          } else if (tv === 0) {
            matched = sv === 0;
            reason = matched ? `目标值为0，源值也为0` : `目标值为0，源值=${sv}`;
          } else {
            const diff = Math.abs(sv - tv);
            const pct = (diff / Math.abs(tv)) * 100;
            matched = pct <= tolerance;
            reason = matched
              ? `范围内: |${sv} - ${tv}| / ${tv} = ${safeNum(pct).toFixed(1)}% ≤ ${tolerance}%`
              : `超出范围: |${sv} - ${tv}| / ${tv} = ${safeNum(pct).toFixed(1)}% > ${tolerance}%`;
          }
          break;
        }
        case 'fuzzy': {
          const sv = String(sourceFieldValue ?? '').toLowerCase();
          const tv = String(targetFieldValue ?? '').toLowerCase();
          if (sv === '' || tv === '') {
            reason = `空值无法模糊匹配`;
          } else {
            matched = sv.includes(tv) || tv.includes(sv);
            reason = matched
              ? `模糊匹配: "${sv}" 包含/被包含 "${tv}"`
              : `不包含: "${sv}" 与 "${tv}" 无包含关系`;
          }
          break;
        }
      }

      if (matched) {
        foundTarget = targetRecord;
        foundReason = reason;
        matchedTargetIndices.add(i);
        matchedPairs++;
        break;
      } else {
        foundReason = reason;
      }
    }

    details.push({
      sourceRecord,
      targetRecord: foundTarget,
      sourceValue: sourceFieldValue,
      targetValue: foundTarget ? foundTarget[rule.targetField] : null,
      matched: !!foundTarget,
      reason: foundTarget ? foundReason : `未找到匹配项（${foundReason || '匹配字段值不匹配'}）`,
    });
  }

  const unmatchedSource = sourceRecords.length - matchedPairs;
  const unmatchedTarget = targetRecords.length - matchedTargetIndices.size;

  let status: MatchResult['status'] = 'none_matched';
  if (matchedPairs === sourceRecords.length && sourceRecords.length > 0) {
    status = 'all_matched';
  } else if (matchedPairs > 0) {
    status = 'partial_matched';
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matchType: rule.matchType,
    sourceType: rule.sourceType,
    targetType: rule.targetType,
    sourceField: rule.sourceField,
    targetField: rule.targetField,
    matchField: rule.matchField,
    totalSourceRecords: sourceRecords.length,
    totalTargetRecords: targetRecords.length,
    matchedPairs,
    unmatchedSource,
    unmatchedTarget,
    details: details.slice(0, 20),
    status,
  };
}

/**
 * 执行全部匹配规则
 */
export function applyAllRules(
  rules: MatchingRule[],
  dataSources: DataSourceMap
): MatchResult[] {
  return rules.filter((r) => r.enabled).map((r) => applyRule(r, dataSources));
}

/**
 * 获取匹配结果摘要
 */
export function getMatchSummary(results: MatchResult[]): {
  totalRules: number;
  allMatched: number;
  partialMatched: number;
  noneMatched: number;
} {
  return {
    totalRules: results.length,
    allMatched: results.filter((r) => r.status === 'all_matched').length,
    partialMatched: results.filter((r) => r.status === 'partial_matched').length,
    noneMatched: results.filter((r) => r.status === 'none_matched').length,
  };
}

/**
 * 生成匹配结果的人类可读描述
 */
export function formatMatchResult(result: MatchResult): string {
  const typeLabel = matchTypeLabels[result.matchType];
  const sourceLabel = dataTypeChineseLabels[result.sourceType];
  const targetLabel = dataTypeChineseLabels[result.targetType];
  return `${sourceLabel}.${result.sourceField} ↔ ${targetLabel}.${result.targetField}（${typeLabel}，按 ${result.matchField} 关联）: 匹配 ${result.matchedPairs}/${result.totalSourceRecords} 条`;
}
