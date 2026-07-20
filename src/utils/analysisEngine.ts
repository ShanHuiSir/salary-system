import type { DepartmentData, MonthlyOverview, CostComposition, PositionLevelData } from '@/types';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

/** 分析项类型 */
export type AnalysisType = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

/** 分析项 */
export interface AnalysisItem {
  type: AnalysisType;
  title: string;
  content: string;
  detail?: string;
}

/** 板块分析结果 */
export interface SegmentAnalysis {
  dimension: string;
  items: AnalysisItem[];
  summary: string;
}

// ===== 工具函数 =====

function formatWan(value: number): string {
  return `${safeNum(value).toFixed(1)}万`;
}

function formatPct(value: number): string {
  return `${safeNum(value).toFixed(2)}%`;
}

function formatSignedPct(value: number, suffix: string = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${safeNum(value).toFixed(2)}${suffix}`;
}

// 获取上个月
function getPrevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
}

// 获取去年同月
function getPrevYearMonth(month: string): string {
  const [year, m] = month.split('-');
  return `${parseInt(year) - 1}-${m}`;
}

/** 判断趋势方向 */
function trendDirection(value: number, threshold = 0): 'up' | 'down' | 'flat' {
  if (value > threshold) return 'up';
  if (value < -threshold) return 'down';
  return 'flat';
}

/** 计算变化率 */
function changeRate(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

// ===== 板块分析生成器 =====

/**
 * 为单个板块生成数据分析
 */
export function generateSegmentAnalysis(
  dimension: string,
  deptKey: string,
  selectedMonth: string,
  departments: DepartmentData[],
  overviews: MonthlyOverview[],
  compositions: CostComposition[],
  positions: PositionLevelData[],
  viewMode: 'current' | 'cumulative' = 'current',
): SegmentAnalysis {
  const items: AnalysisItem[] = [];

  const isOverview = deptKey === '全公司';

  // 获取当前数据
  const currentDept = isOverview
    ? departments.find((d) => d.month === selectedMonth && d.department === '全公司')
    : departments.find((d) => d.month === selectedMonth && d.department === deptKey);

  const currentOverview = overviews.find((o) => o.month === selectedMonth);

  if (!currentDept) {
    return {
      dimension,
      items: [{ type: 'info', title: '暂无数据', content: '当前月份暂无该板块的数据，请先在数据管理中添加。' }],
      summary: '暂无数据',
    };
  }

  // ===== 1. 人力成本分析 =====
  const prevMonth = getPrevMonth(selectedMonth);
  const prevYearMonth = getPrevYearMonth(selectedMonth);

  const prevDept = departments.find(
    (d) => d.month === prevMonth && d.department === (isOverview ? '全公司' : deptKey)
  );
  const prevYearDept = departments.find(
    (d) => d.month === prevYearMonth && d.department === (isOverview ? '全公司' : deptKey)
  );

  // 人力成本环比
  if (prevDept && viewMode === 'current') {
    const costDiff = currentDept.laborCost - prevDept.laborCost;
    const costPct = changeRate(currentDept.laborCost, prevDept.laborCost);
    const dir = trendDirection(costDiff);

    if (dir === 'down') {
      items.push({
        type: 'positive',
        title: '人力成本环比下降',
        content: `${dimension}人力成本环比减少 ${formatWan(Math.abs(costDiff))}（${formatSignedPct(costPct || 0, '%')}），降至 ${formatWan(currentDept.laborCost)}。`,
        detail: `上月人力成本为 ${formatWan(prevDept.laborCost)}，本月减少至 ${formatWan(currentDept.laborCost)}。`,
      });
    } else if (dir === 'up') {
      const isLargeIncrease = costPct !== null && costPct > 5;
      items.push({
        type: isLargeIncrease ? 'warning' : 'negative',
        title: '人力成本环比上升',
        content: `${dimension}人力成本环比增加 ${formatWan(costDiff)}（${formatSignedPct(costPct || 0, '%')}），升至 ${formatWan(currentDept.laborCost)}。${isLargeIncrease ? '增幅较大，建议关注原因。' : ''}`,
        detail: `上月人力成本为 ${formatWan(prevDept.laborCost)}，本月增至 ${formatWan(currentDept.laborCost)}。`,
      });
    } else {
      items.push({
        type: 'neutral',
        title: '人力成本环比持平',
        content: `${dimension}人力成本环比基本持平，维持在 ${formatWan(currentDept.laborCost)} 水平。`,
      });
    }
  }

  // 人力成本同比
  if (prevYearDept) {
    const yoyCostDiff = currentDept.laborCost - prevYearDept.laborCost;
    const yoyCostPct = changeRate(currentDept.laborCost, prevYearDept.laborCost);
    const dir = trendDirection(yoyCostDiff);

    if (dir === 'down') {
      items.push({
        type: 'positive',
        title: '人力成本同比下降',
        content: `较去年同期，人力成本下降 ${formatWan(Math.abs(yoyCostDiff))}（${formatSignedPct(yoyCostPct || 0, '%')}），去年同期为 ${formatWan(prevYearDept.laborCost)}。`,
      });
    } else if (dir === 'up') {
      items.push({
        type: 'warning',
        title: '人力成本同比上升',
        content: `较去年同期，人力成本增加 ${formatWan(yoyCostDiff)}（${formatSignedPct(yoyCostPct || 0, '%')}），去年同期为 ${formatWan(prevYearDept.laborCost)}。`,
      });
    }
  }

  // ===== 2. 人数变化分析 =====
  if (prevDept && viewMode === 'current') {
    const hcDiff = currentDept.headcount - prevDept.headcount;
    const hcPct = changeRate(currentDept.headcount, prevDept.headcount);
    const dir = trendDirection(hcDiff, 2); // 2人以内算持平

    if (dir === 'down') {
      items.push({
        type: 'positive',
        title: '人数环比减少',
        content: `${dimension}人数环比减少 ${Math.abs(hcDiff)} 人至 ${currentDept.headcount} 人（${formatSignedPct(hcPct || 0, '%')}），人效有望提升。`,
      });
    } else if (dir === 'up') {
      items.push({
        type: 'info',
        title: '人数环比增加',
        content: `${dimension}人数环比增加 ${hcDiff} 人至 ${currentDept.headcount} 人（${formatSignedPct(hcPct || 0, '%')}），需关注新增人员的产出匹配。`,
      });
    }
  }

  if (prevYearDept) {
    const yoyHcDiff = currentDept.headcount - prevYearDept.headcount;
    if (Math.abs(yoyHcDiff) >= 5) {
      items.push({
        type: yoyHcDiff > 0 ? 'warning' : 'positive',
        title: yoyHcDiff > 0 ? '人数同比增加' : '人数同比下降',
        content: `较去年同期，人数${yoyHcDiff > 0 ? '增加' : '减少'} ${Math.abs(yoyHcDiff)} 人（去年 ${prevYearDept.headcount} → 今年 ${currentDept.headcount}）。`,
      });
    }
  }

  // ===== 3. 人效/店效分析 =====
  const isSelfOperated = deptKey === '自营';
  const efficiencyLabel = isSelfOperated ? '店效' : '人均营收';
  const efficiencyValue = isSelfOperated ? currentDept.storeEfficiency : currentDept.perCapitaRevenue;

  if (prevDept && viewMode === 'current') {
    const prevEff = isSelfOperated ? prevDept.storeEfficiency : prevDept.perCapitaRevenue;
    if (prevEff > 0) {
      const effDiff = efficiencyValue - prevEff;
      const effPct = changeRate(efficiencyValue, prevEff);
      const dir = trendDirection(effDiff, 0.1);

      if (dir === 'up') {
        items.push({
          type: 'positive',
          title: `${efficiencyLabel}环比提升`,
          content: `${efficiencyLabel}从 ${safeNum(prevEff).toFixed(2)} 提升至 ${safeNum(efficiencyValue).toFixed(2)}（${formatSignedPct(effPct || 0, '%')}），运营效率改善。`,
        });
      } else if (dir === 'down') {
        items.push({
          type: 'warning',
          title: `${efficiencyLabel}环比下降`,
          content: `${efficiencyLabel}从 ${safeNum(prevEff).toFixed(2)} 降至 ${safeNum(efficiencyValue).toFixed(2)}（${formatSignedPct(effPct || 0, '%')}），需关注产出效率。`,
        });
      }
    }
  }

  // ===== 4. 人力成本占比分析 =====
  if (currentOverview && (isOverview || currentOverview)) {
    const ratio = currentDept.laborCostRatio;
    let benchmark = 25; // 默认基准
    if (deptKey === '总部') benchmark = 12;
    else if (deptKey === '自营') benchmark = 21;
    else if (deptKey === '线上') benchmark = 8;
    else if (deptKey === '犀利工厂') benchmark = 2;
    else benchmark = 24; // 全公司

    const ratioDiff = ratio - benchmark;

    if (ratioDiff > 2) {
      items.push({
        type: 'warning',
        title: '人力成本占比偏高',
        content: `${dimension}人力成本占比为 ${formatPct(ratio)}，高于板块基准 ${formatPct(benchmark)} 约 ${safeNum(ratioDiff).toFixed(2)}pp，建议关注成本控制。`,
      });
    } else if (ratioDiff < -2) {
      items.push({
        type: 'positive',
        title: '人力成本占比合理',
        content: `${dimension}人力成本占比为 ${formatPct(ratio)}，低于板块基准 ${formatPct(benchmark)} 约 ${Math.abs(ratioDiff).toFixed(2)}pp，成本控制良好。`,
      });
    } else {
      items.push({
        type: 'neutral',
        title: '人力成本占比稳定',
        content: `${dimension}人力成本占比为 ${formatPct(ratio)}，处于板块基准 ${formatPct(benchmark)} 附近，整体合理。`,
      });
    }
  }

  // ===== 5. 成本构成分析 =====
  const comp = compositions.find(
    (c) => c.month === selectedMonth && c.department === deptKey
  );

  if (comp && !isOverview) {
    const totalComp = comp.fixedIncome + comp.floatingIncome + comp.socialInsurance + comp.severance + comp.outsourcing;
    if (totalComp > 0) {
      const fixedRatio = (comp.fixedIncome / totalComp) * 100;
      const floatingRatio = (comp.floatingIncome / totalComp) * 100;
      const socialRatio = (comp.socialInsurance / totalComp) * 100;

      // 固浮比分析
      let fixedVarComment = '';
      let fixedVarType: AnalysisType = 'neutral';

      if (deptKey === '总部') {
        if (fixedRatio > 75) {
          fixedVarComment = '总部以固定收入为主（固浮比偏高），成本刚性较强，压降空间主要来自编制与职能优化。';
          fixedVarType = 'info';
        } else {
          fixedVarComment = '总部固浮比相对均衡，浮动收入占比合理。';
          fixedVarType = 'positive';
        }
      } else if (deptKey === '自营') {
        if (floatingRatio > 40) {
          fixedVarComment = '自营区域浮动收入占比高，与销售业绩高度联动，激励机制有效。';
          fixedVarType = 'positive';
        } else {
          fixedVarComment = '自营区域浮动收入占比偏低，建议加强业绩挂钩激励。';
          fixedVarType = 'info';
        }
      } else if (deptKey === '线上') {
        if (fixedRatio > 40) {
          fixedVarComment = '线上板块固定成本占比较大，体量较小，需关注新增账号的产出匹配。';
          fixedVarType = 'info';
        }
      } else if (deptKey === '犀利工厂') {
        if (fixedRatio > 75) {
          fixedVarComment = '犀利工厂以固定收入为主，计件/绩效浮动占比低，建议增加产出挂钩的浮动激励。';
          fixedVarType = 'info';
        }
      }

      if (fixedVarComment) {
        items.push({
          type: fixedVarType,
          title: '固浮比结构分析',
          content: `${fixedVarComment} 固定收入占比 ${formatPct(fixedRatio)}，浮动收入占比 ${formatPct(floatingRatio)}，社保公积金占比 ${formatPct(socialRatio)}。`,
        });
      }
    }
  }

  // ===== 6. 板块特有分析 =====

  // 犀利工厂：成本与产值对比
  if (deptKey === '犀利工厂' && currentOverview) {
    const factoryRevenue = currentOverview.factoryRevenue ?? 0;
    const factoryCost = currentDept.laborCost;
    if (factoryRevenue > 0) {
      const costRatio = (factoryCost / factoryRevenue) * 100;
      if (costRatio > 80) {
        items.push({
          type: 'warning',
          title: '人力成本接近或超过产值',
          content: `犀利工厂人力成本 ${formatWan(factoryCost)} 占产值 ${formatWan(factoryRevenue)} 的 ${formatPct(costRatio)}，${costRatio > 100 ? '已超过产值，属于异常状态' : '接近产值，盈利空间极小'}，是最需要被追踪的异常板块。`,
        });
      } else if (costRatio > 50) {
        items.push({
          type: 'negative',
          title: '人力成本占产值比例偏高',
          content: `犀利工厂人力成本占产值的 ${formatPct(costRatio)}，盈利空间受限。`,
        });
      }
    }
  }

  // 自营区域：区域差异分析
  if (deptKey === '自营' && positions.length > 0) {
    const selfPositions = positions.filter(
      (p) => p.month === selectedMonth && p.department === '自营'
    );
    if (selfPositions.length > 0) {
      const maxCost = Math.max(...selfPositions.map((p) => p.laborCost));
      const minCost = Math.min(...selfPositions.map((p) => p.laborCost));
      const maxLevel = selfPositions.find((p) => p.laborCost === maxCost);
      const minLevel = selfPositions.find((p) => p.laborCost === minCost);

      if (maxLevel && minLevel && maxCost !== minCost) {
        items.push({
          type: 'info',
          title: '职级成本分布',
          content: `自营区域人力成本最高的职级为「${maxLevel.level}」（${formatWan(maxCost)}，占比 ${formatPct(maxLevel.ratio)}），最低为「${minLevel.level}」（${formatWan(minCost)}，占比 ${formatPct(minLevel.ratio)}）。`,
        });
      }
    }
  }

  // 总部：业务线成本分析
  if (deptKey === '总部' && positions.length > 0) {
    const hqPositions = positions.filter(
      (p) => p.month === selectedMonth && p.department === '总部'
    );
    if (hqPositions.length > 0) {
      const sorted = [...hqPositions].sort((a, b) => b.laborCost - a.laborCost);
      const top = sorted[0];
      items.push({
        type: 'info',
        title: '职级成本集中度',
        content: `总部人力成本最高的职级为「${top.level}」（${formatWan(top.laborCost)}，占比 ${formatPct(top.ratio)}），共 ${top.headcount} 人。`,
      });
    }
  }

  // 线上：人均产出分析
  if (deptKey === '线上' && currentOverview) {
    const onlineRevenue = currentOverview.platformRevenue;
    const onlineHc = currentDept.headcount;
    if (onlineHc > 0 && onlineRevenue > 0) {
      const perCapita = onlineRevenue / onlineHc;
      items.push({
        type: perCapita > 15 ? 'positive' : 'info',
        title: '线上人均产出',
        content: `线上板块人均产出为 ${safeNum(perCapita).toFixed(2)}万/人，总业绩 ${formatWan(onlineRevenue)}，人数 ${onlineHc} 人。${perCapita > 15 ? '人效表现优异。' : '人效有提升空间。'}`,
      });
    }
  }

  // ===== 7. 累计模式下的趋势分析 =====
  if (viewMode === 'cumulative') {
    const [year] = selectedMonth.split('-');
    const monthsInYear = departments
      .filter((d) => d.month.startsWith(year) && d.month <= selectedMonth && d.department === (isOverview ? '全公司' : deptKey))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (monthsInYear.length >= 2) {
      const first = monthsInYear[0];
      const last = monthsInYear[monthsInYear.length - 1];
      const hcTrend = last.headcount - first.headcount;

      if (Math.abs(hcTrend) >= 5) {
        items.push({
          type: hcTrend > 0 ? 'warning' : 'positive',
          title: '年度人数趋势',
          content: `${year}年初至今，${dimension}人数从 ${first.headcount} 人${hcTrend > 0 ? '增长' : '减少'}至 ${last.headcount} 人，净${hcTrend > 0 ? '增' : '减'} ${Math.abs(hcTrend)} 人。`,
        });
      }
    }
  }

  // ===== 8. 总览特有分析 =====
  if (isOverview && currentOverview) {
    // 各渠道业绩变化
    if (prevMonth) {
      const prevOverview = overviews.find((o) => o.month === prevMonth);
      if (prevOverview && viewMode === 'current') {
        const selfChange = currentOverview.selfOperatedRevenue - prevOverview.selfOperatedRevenue;
        const franchiseChange = currentOverview.franchiseRevenue - prevOverview.franchiseRevenue;
        const platformChange = currentOverview.platformRevenue - prevOverview.platformRevenue;

        const channels = [
          { name: '自营区域', change: selfChange, value: currentOverview.selfOperatedRevenue },
          { name: '加盟', change: franchiseChange, value: currentOverview.franchiseRevenue },
          { name: '线上', change: platformChange, value: currentOverview.platformRevenue },
        ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        const topChannel = channels[0];
        if (Math.abs(topChannel.change) > 10) {
          items.push({
            type: topChannel.change > 0 ? 'positive' : 'negative',
            title: '渠道业绩变化',
            content: `业绩变化最大的渠道为「${topChannel.name}」，环比${topChannel.change > 0 ? '增长' : '下降'} ${formatWan(Math.abs(topChannel.change))}（当前 ${formatWan(topChannel.value)}）。`,
          });
        }
      }
    }

    // 板块间对比
    const allDepts = departments.filter((d) => d.month === selectedMonth && d.department !== '全公司');
    if (allDepts.length > 0) {
      const sorted = [...allDepts].sort((a, b) => b.laborCost - a.laborCost);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      const topLabel = top.department === '自营' ? '自营区域' : top.department;

      items.push({
        type: 'info',
        title: '板块成本对比',
        content: `当前月份人力成本最高的板块为「${topLabel}」（${formatWan(top.laborCost)}，占 ${formatPct((top.laborCost / currentDept.laborCost) * 100)}），最低为「${bottom.department === '自营' ? '自营区域' : bottom.department}」（${formatWan(bottom.laborCost)}）。`,
      });
    }
  }

  // 生成摘要
  const positiveCount = items.filter((i) => i.type === 'positive').length;
  const warningCount = items.filter((i) => i.type === 'warning').length;
  const negativeCount = items.filter((i) => i.type === 'negative').length;

  let summary = '';
  if (warningCount > 0) {
    summary = `${dimension}存在 ${warningCount} 项需关注的问题`;
  } else if (positiveCount > 0 && negativeCount === 0) {
    summary = `${dimension}整体表现良好`;
  } else if (positiveCount > negativeCount) {
    summary = `${dimension}整体稳中向好`;
  } else if (negativeCount > positiveCount) {
    summary = `${dimension}整体承压`;
  } else {
    summary = `${dimension}整体运行平稳`;
  }

  return {
    dimension,
    items,
    summary,
  };
}

// ===== 总览综合分析 =====

export function generateOverviewAnalysis(
  selectedMonth: string,
  departments: DepartmentData[],
  overviews: MonthlyOverview[],
  _compositions: CostComposition[],
  viewMode: 'current' | 'cumulative' = 'current',
): SegmentAnalysis {
  const items: AnalysisItem[] = [];
  const currentOverview = overviews.find((o) => o.month === selectedMonth);
  const allDept = departments.find((d) => d.month === selectedMonth && d.department === '全公司');

  if (!currentOverview || !allDept) {
    return {
      dimension: '全公司',
      items: [{ type: 'info', title: '暂无数据', content: '当前月份暂无总览数据。' }],
      summary: '暂无数据',
    };
  }

  // 1. 总业绩分析
  const prevMonth = getPrevMonth(selectedMonth);
  const prevYearMonth = getPrevYearMonth(selectedMonth);
  const prevOverview = overviews.find((o) => o.month === prevMonth);
  const prevYearOverview = overviews.find((o) => o.month === prevYearMonth);

  if (prevOverview && viewMode === 'current') {
    const revDiff = currentOverview.totalRevenue - prevOverview.totalRevenue;
    const revPct = changeRate(currentOverview.totalRevenue, prevOverview.totalRevenue);
    const dir = trendDirection(revDiff, 10);

    if (dir === 'up') {
      items.push({
        type: 'positive',
        title: '总业绩环比增长',
        content: `全公司总业绩环比增长 ${formatWan(revDiff)}（${formatSignedPct(revPct || 0, '%')}），达 ${formatWan(currentOverview.totalRevenue)}。`,
      });
    } else if (dir === 'down') {
      items.push({
        type: 'negative',
        title: '总业绩环比下降',
        content: `全公司总业绩环比下降 ${formatWan(Math.abs(revDiff))}（${formatSignedPct(revPct || 0, '%')}），降至 ${formatWan(currentOverview.totalRevenue)}。`,
      });
    }
  }

  if (prevYearOverview) {
    const yoyRevDiff = currentOverview.totalRevenue - prevYearOverview.totalRevenue;
    const yoyRevPct = changeRate(currentOverview.totalRevenue, prevYearOverview.totalRevenue);

    if (yoyRevPct !== null && yoyRevPct < -5) {
      items.push({
        type: 'warning',
        title: '总业绩同比下滑明显',
        content: `较去年同期，总业绩下降 ${formatWan(Math.abs(yoyRevDiff))}（${formatSignedPct(yoyRevPct, '%')}），去年同期为 ${formatWan(prevYearOverview.totalRevenue)}。`,
      });
    } else if (yoyRevPct !== null && yoyRevPct > 0) {
      items.push({
        type: 'positive',
        title: '总业绩同比增长',
        content: `较去年同期，总业绩增长 ${formatWan(yoyRevDiff)}（${formatSignedPct(yoyRevPct, '%')}）。`,
      });
    }
  }

  // 2. 人力成本占比
  const ratio = currentOverview.laborCostRatio;
  const ratioBenchmark = 24;
  if (ratio > ratioBenchmark + 2) {
    items.push({
      type: 'warning',
      title: '人力成本占比偏高',
      content: `全公司人力成本占比为 ${formatPct(ratio)}，高于基准线 ${formatPct(ratioBenchmark)} 约 ${(ratio - ratioBenchmark).toFixed(2)}pp，需关注人效提升。`,
    });
  } else if (ratio < ratioBenchmark - 2) {
    items.push({
      type: 'positive',
      title: '人力成本占比合理',
      content: `全公司人力成本占比为 ${formatPct(ratio)}，低于基准线 ${formatPct(ratioBenchmark)}，成本控制良好。`,
    });
  }

  // 3. 各板块成本占比排名
  const segments = [
    { key: '总部', label: '总部' },
    { key: '自营', label: '自营区域' },
    { key: '线上', label: '线上' },
    { key: '犀利工厂', label: '犀利工厂' },
  ] as const;

  const segCosts = segments.map((seg) => {
    const dept = departments.find((d) => d.month === selectedMonth && d.department === seg.key);
    return {
      label: seg.label,
      cost: dept?.laborCost ?? 0,
      headcount: dept?.headcount ?? 0,
    };
  });

  const totalCost = segCosts.reduce((s, c) => s + c.cost, 0);
  if (totalCost > 0) {
    const sorted = [...segCosts].sort((a, b) => b.cost - a.cost);
    const top = sorted[0];
    items.push({
      type: 'info',
      title: '成本结构分布',
      content: `人力成本主要集中在「${top.label}」（${formatWan(top.cost)}，占 ${formatPct((top.cost / totalCost) * 100)}），全公司总人力成本 ${formatWan(totalCost)}，总人数 ${allDept.headcount} 人。`,
    });
  }

  // 4. 犀利工厂异常预警
  const factoryRevenue = currentOverview.factoryRevenue ?? 0;
  const factoryDept = departments.find((d) => d.month === selectedMonth && d.department === '犀利工厂');
  if (factoryDept && factoryRevenue > 0) {
    const factoryRatio = (factoryDept.laborCost / factoryRevenue) * 100;
    if (factoryRatio > 80) {
      items.push({
        type: 'warning',
        title: '犀利工厂成本异常',
        content: `犀利工厂人力成本 ${formatWan(factoryDept.laborCost)} 占产值 ${formatWan(factoryRevenue)} 的 ${formatPct(factoryRatio)}，${factoryRatio > 100 ? '已超过产值' : '接近产值'}，是最需要被追踪的异常板块。`,
      });
    }
  }

  // 5. 线上板块表现
  const onlineRevenue = currentOverview.platformRevenue;
  const onlineDept = departments.find((d) => d.month === selectedMonth && d.department === '线上');
  if (onlineDept && onlineRevenue > 0 && prevOverview && viewMode === 'current') {
    const onlineGrowth = ((onlineRevenue - prevOverview.platformRevenue) / prevOverview.platformRevenue) * 100;
    if (Math.abs(onlineGrowth) > 10) {
      items.push({
        type: onlineGrowth > 0 ? 'positive' : 'negative',
        title: '线上板块业绩波动',
        content: `线上板块业绩环比${onlineGrowth > 0 ? '增长' : '下降'} ${Math.abs(onlineGrowth).toFixed(1)}%，当前 ${formatWan(onlineRevenue)}，人数 ${onlineDept.headcount} 人。`,
      });
    }
  }

  // 6. 自营区域店效
  const selfDept = departments.find((d) => d.month === selectedMonth && d.department === '自营');
  if (selfDept && prevOverview && viewMode === 'current') {
    const prevSelfDept = departments.find((d) => d.month === prevMonth && d.department === '自营');
    if (prevSelfDept) {
      const seDiff = selfDept.storeEfficiency - prevSelfDept.storeEfficiency;
      if (Math.abs(seDiff) > 1) {
        items.push({
          type: seDiff > 0 ? 'positive' : 'warning',
          title: '自营区域店效变化',
          content: `自营区域店效环比${seDiff > 0 ? '提升' : '下降'} ${Math.abs(seDiff).toFixed(2)}，从 ${safeNum(prevSelfDept.storeEfficiency).toFixed(2)} 变为 ${safeNum(selfDept.storeEfficiency).toFixed(2)}。`,
        });
      }
    }
  }

  // 摘要
  const positiveCount = items.filter((i) => i.type === 'positive').length;
  const warningCount = items.filter((i) => i.type === 'warning').length;
  const negativeCount = items.filter((i) => i.type === 'negative').length;

  let summary = '';
  if (warningCount > 0) {
    summary = `存在 ${warningCount} 项需关注的问题`;
  } else if (positiveCount > 0 && negativeCount === 0) {
    summary = '整体表现良好';
  } else if (positiveCount > negativeCount) {
    summary = '整体稳中向好';
  } else if (negativeCount > positiveCount) {
    summary = '整体承压';
  } else {
    summary = '整体运行平稳';
  }

  return {
    dimension: '全公司',
    items,
    summary,
  };
}
