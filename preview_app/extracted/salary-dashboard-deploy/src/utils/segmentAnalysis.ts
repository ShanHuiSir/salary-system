import type { DepartmentData, MonthlyOverview, CostComposition } from '@/types';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

export interface SegmentAnalysisHint {
  title: string;
  content: string;
  type: 'positive' | 'warning' | 'negative' | 'info' | 'neutral';
}

function formatWan(value: number): string {
  return `${safeNum(value).toFixed(1)}万`;
}

function formatPct(value: number): string {
  return `${safeNum(value).toFixed(2)}%`;
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${safeNum(value).toFixed(2)}%`;
}

function changeRate(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

type SegmentKey = '总部' | '自营' | '线上' | '犀利工厂';

/**
 * 为单个板块卡片生成基于实际数据的动态分析项
 * 数据源：数据管理模块（部门数据 / 月度总览 / 成本构成）
 */
export function generateSegmentCardAnalysis(
  segmentKey: SegmentKey,
  segmentLabel: string,
  selectedMonth: string,
  currentDept: DepartmentData | null | undefined,
  prevDept: DepartmentData | null | undefined,
  prevYearDept: DepartmentData | null | undefined,
  currentOverview: MonthlyOverview | null | undefined,
  compositions: CostComposition[],
  viewMode: 'current' | 'cumulative',
): SegmentAnalysisHint[] {
  const items: SegmentAnalysisHint[] = [];

  if (!currentDept) {
    return [{
      type: 'info',
      title: '暂无部门数据',
      content: `请在「数据管理 → 部门数据」中添加 ${segmentLabel} ${selectedMonth} 的数据。`,
    }];
  }

  // ===== 1. 业绩联动分析（仅当板块有对应业绩时）=====
  const revenueKey: Record<SegmentKey, keyof MonthlyOverview | null> = {
    总部: null,
    自营: 'selfOperatedRevenue',
    线上: 'platformRevenue',
    犀利工厂: 'factoryRevenue',
  };
  const revenueName: Record<SegmentKey, string> = {
    总部: '总部业绩',
    自营: '自营区域业绩',
    线上: '线上业绩',
    犀利工厂: '犀利产值',
  };

  if (currentOverview) {
    const rKey = revenueKey[segmentKey];
    if (rKey) {
      const segRevenue = (currentOverview as unknown as Record<string, number | undefined>)[rKey as string];
      if (segRevenue && segRevenue > 0) {
        const costRatio = (currentDept.laborCost / segRevenue) * 100;
        if (costRatio > 100) {
          items.push({
            type: 'negative',
            title: `${revenueName[segmentKey]}无法覆盖人力成本`,
            content: `${segmentLabel}人力成本 ${formatWan(currentDept.laborCost)} 已超过${revenueName[segmentKey]} ${formatWan(segRevenue)}，亏损经营。`,
          });
        } else if (costRatio > 80) {
          items.push({
            type: 'warning',
            title: '人力成本占业绩比例过高',
            content: `${segmentLabel}人力成本 ${formatWan(currentDept.laborCost)} 占${revenueName[segmentKey]} ${formatWan(segRevenue)} 的 ${formatPct(costRatio)}，盈利空间极小。`,
          });
        } else if (costRatio < 25) {
          items.push({
            type: 'positive',
            title: '人力成本占业绩比例合理',
            content: `${segmentLabel}人力成本 ${formatWan(currentDept.laborCost)} 占${revenueName[segmentKey]} ${formatWan(segRevenue)} 的 ${formatPct(costRatio)}，人效表现良好。`,
          });
        }
      }
    }
  }

  // ===== 2. 环比变化分析 =====
  if (prevDept && viewMode === 'current') {
    const costDiff = currentDept.laborCost - prevDept.laborCost;
    const costPct = changeRate(currentDept.laborCost, prevDept.laborCost);
    if (costDiff > 0 && costPct !== null && costPct > 5) {
      items.push({
        type: 'warning',
        title: '人力成本环比上升',
        content: `较上月增加 ${formatWan(costDiff)}（${formatSignedPct(costPct)}），需重点关注是否带来对应业务增量。`,
      });
    } else if (costDiff < 0 && costPct !== null) {
      items.push({
        type: 'positive',
        title: '人力成本环比下降',
        content: `较上月减少 ${formatWan(Math.abs(costDiff))}（${formatSignedPct(costPct)}），成本控制有效。`,
      });
    }
  }

  // ===== 3. 同比变化分析 =====
  if (prevYearDept) {
    const yoyCostDiff = currentDept.laborCost - prevYearDept.laborCost;
    const yoyCostPct = changeRate(currentDept.laborCost, prevYearDept.laborCost);
    if (yoyCostPct !== null) {
      if (yoyCostPct > 10) {
        items.push({
          type: 'warning',
          title: '人力成本同比增长较快',
          content: `较去年同期增加 ${formatWan(yoyCostDiff)}（${formatSignedPct(yoyCostPct)}），需评估增长合理性。`,
        });
      } else if (yoyCostPct < -5) {
        items.push({
          type: 'positive',
          title: '人力成本同比下降',
          content: `较去年同期减少 ${formatWan(Math.abs(yoyCostDiff))}（${formatSignedPct(yoyCostPct)}），同比优化效果显著。`,
        });
      }
    }
  }

  // ===== 4. 人数变化分析 =====
  if (prevDept && viewMode === 'current') {
    const hcDiff = currentDept.headcount - prevDept.headcount;
    if (Math.abs(hcDiff) >= 3) {
      items.push({
        type: hcDiff > 0 ? 'info' : 'positive',
        title: hcDiff > 0 ? '人数环比增加' : '人数环比减少',
        content: `${segmentLabel}人数${hcDiff > 0 ? '增加' : '减少'} ${Math.abs(hcDiff)} 人，当前 ${currentDept.headcount} 人（${prevDept.headcount} → ${currentDept.headcount}）。${hcDiff > 0 ? '关注新增人员产出匹配。' : '人效有望提升。'}`,
      });
    }
  }

  // ===== 5. 人效/店效分析 =====
  const isSelfOperated = segmentKey === '自营';
  if (isSelfOperated) {
    if (prevDept && viewMode === 'current') {
      const effDiff = currentDept.storeEfficiency - prevDept.storeEfficiency;
      if (Math.abs(effDiff) > 1) {
        items.push({
          type: effDiff > 0 ? 'positive' : 'warning',
          title: '店效环比变化',
          content: `店效从 ${safeNum(prevDept.storeEfficiency).toFixed(2)} ${effDiff > 0 ? '提升' : '下降'}至 ${safeNum(currentDept.storeEfficiency).toFixed(2)}，单店产出${effDiff > 0 ? '改善' : '承压'}。`,
        });
      }
    }
  } else if (currentDept.headcount > 0) {
    const perCapitaLabor = currentDept.laborCost / currentDept.headcount;
    if (perCapitaLabor > 2) {
      items.push({
        type: 'info',
        title: '人均人力成本偏高',
        content: `${segmentLabel}人均人力成本 ${safeNum(perCapitaLabor).toFixed(2)} 万元/人，需关注人效水平。`,
      });
    } else if (perCapitaLabor < 1) {
      items.push({
        type: 'positive',
        title: '人均人力成本合理',
        content: `${segmentLabel}人均人力成本 ${safeNum(perCapitaLabor).toFixed(2)} 万元/人，处于合理水平。`,
      });
    }
  }

  // ===== 6. 固浮比分析 =====
  const comp = compositions.find(
    (c) => c.month === selectedMonth && c.department === segmentKey
  );
  if (comp) {
    const totalComp = comp.fixedIncome + comp.floatingIncome + comp.socialInsurance + comp.severance + comp.outsourcing;
    if (totalComp > 0) {
      const fixedRatio = (comp.fixedIncome / totalComp) * 100;
      const floatingRatio = (comp.floatingIncome / totalComp) * 100;
      if (segmentKey === '总部' && fixedRatio > 75) {
        items.push({
          type: 'info',
          title: '固浮比结构：固定为主',
          content: `总部固定收入占比 ${formatPct(fixedRatio)}，浮动收入占比 ${formatPct(floatingRatio)}，成本刚性较强。压降空间主要来自编制与职能优化。`,
        });
      } else if (segmentKey === '自营' && floatingRatio < 30) {
        items.push({
          type: 'warning',
          title: '固浮比结构：激励不足',
          content: `自营区域浮动收入占比仅 ${formatPct(floatingRatio)}，与销售业绩联动性弱，建议加强业绩挂钩激励。`,
        });
      } else if (segmentKey === '自营' && floatingRatio > 40) {
        items.push({
          type: 'positive',
          title: '固浮比结构：激励有效',
          content: `自营区域浮动收入占比 ${formatPct(floatingRatio)}，与销售业绩高度联动，激励机制有效。`,
        });
      } else if (segmentKey === '线上' && fixedRatio > 40) {
        items.push({
          type: 'info',
          title: '固浮比结构：固定占比较大',
          content: `线上板块固定工资占比 ${formatPct(fixedRatio)}，体量较小，需关注新增账号的产出匹配。`,
        });
      } else if (segmentKey === '犀利工厂' && fixedRatio > 75) {
        items.push({
          type: 'info',
          title: '固浮比结构：计件/绩效占比低',
          content: `犀利工厂以固定工资为主（${formatPct(fixedRatio)}），建议增加产出挂钩的浮动激励。`,
        });
      }
    }
  }

  // 最多保留 3 条分析
  return items.slice(0, 3);
}

/**
 * 生成数据来源描述
 */
export function getSegmentDataSource(
  segmentKey: string,
  viewMode: 'current' | 'cumulative',
): string {
  const mode = viewMode === 'cumulative' ? '累计（1月-当前月）' : '当期';
  return `数据管理 → 部门数据（${segmentKey}，${mode}） · 月度总览（业绩字段）`;
}
