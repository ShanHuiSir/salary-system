# DashboardPage 详细重构方案

> 目标：将 1672 行的单文件拆分为可维护的模块化结构

---

## 1. 现状分析

### 1.1 当前 DashboardPage.tsx 职责清单

| 职责 | 行数占比 | 问题 |
|------|---------|------|
| 数据获取与派生 | ~20% | `overviews` useMemo 重复了 DataBindingPage 的逻辑 |
| KPI 趋势计算 | ~10% | overviewKpiTrends / cumulativeKpiTrends |
| 累计模式计算 | ~8% | getCumulativeOverview / getCumulativeDeptData 硬编码 |
| 图表数据准备 | ~15% | 6+ 个 useMemo 准备图表数据 |
| 5 维度 × 2 模式渲染 | ~35% | 大量条件渲染嵌套 |
| 布局/交互 | ~10% | 月份选择、维度切换、自定义排版 |
| 其他 (imports, types, helpers) | ~2% | - |

### 1.2 重构原则

1. **单一职责**：每个 hook 只做一件事；每个组件只渲染一个区域
2. **保持 API 兼容**：DashboardPage 对外接口不变，内部重组
3. **渐进式**：可分阶段迁移，新旧代码可共存
4. **可测试性**：hooks 可独立测试，组件可独立 Storybook

---

## 2. 目标文件结构

```
src/pages/dashboard/
├── DashboardPage.tsx              # 主页面（~200行，组合各 Section）
├── hooks/
│   ├── useDashboardMonths.ts      # 月份/维度/视图模式 URL 状态管理
│   ├── useDerivedOverviews.ts     # 数据派生（从 overviews + departments）
│   ├── useOverviewKpi.ts          # 总览 KPI 趋势计算
│   ├── useSegmentStats.ts         # 板块统计（按维度取数据）
│   ├── useCumulativeData.ts       # 累计模式计算（封装 cumulativeData.ts）
│   └── useChartData.ts            # 图表数据准备（整合 6+ useMemo）
├── sections/
│   ├── DashboardHeader.tsx        # 标题栏 + 月份选择器 + 维度切换按钮
│   ├── KpiCardsSection.tsx        # 4 个 KPI 卡片（总览/板块 × 当期/累计）
│   ├── ChannelRevenueSection.tsx  # 渠道业绩明细（总览 only）
│   ├── SegmentOverviewSection.tsx # 四大板块卡片
│   ├── BudgetUsageSection.tsx     # 预算使用率图表（总览 only）
│   ├── CostStructureSection.tsx   # 人力成本组成饼图/堆叠图
│   ├── TrendChartsSection.tsx     # 趋势图 + 部门对比/成本构成
│   ├── SecondaryChartsSection.tsx # 副图表行（职级/成本/业绩趋势）
│   └── AnalysisSection.tsx        # 数据分析面板
├── components/
│   ├── KpiCardGrid.tsx            # KPI 卡片网格布局
│   └── ChartCard.tsx              # 通用图表卡片容器
└── utils.ts                       # 本页面特有工具函数（如有）
```

---

## 3. 各文件详细设计

### 3.1 `DashboardPage.tsx`（主页面，~200行）

```typescript
export function DashboardPage() {
  // 1. URL 状态管理
  const { dimension, deptKey, isOverview, viewMode, selectedMonth,
          setMonth, setViewMode } = useDashboardMonths();

  // 2. 数据获取
  const { derivedOverviews, allDepts } = useDerivedOverviews();
  const { overviewKpi, cumulativeKpi } = useOverviewKpi(
    derivedOverviews, selectedMonth, viewMode
  );
  const { currentDept, cumulativeDept } = useSegmentStats(
    deptKey, selectedMonth, viewMode
  );

  // 3. 图表数据
  const chartData = useChartData(derivedOverviews, allDepts, selectedMonth,
                                  deptKey, isOverview, viewMode);

  // 4. 布局
  const layout = useDashboardLayout();
  const [customizerOpen, setCustomizerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <DashboardHeader
        dimension={dimension}
        viewMode={viewMode}
        selectedMonth={selectedMonth}
        onMonthChange={setMonth}
        onViewModeChange={setViewMode}
        onCustomize={() => setCustomizerOpen(true)}
      />

      <KpiCardsSection
        isOverview={isOverview}
        deptKey={deptKey}
        viewMode={viewMode}
        overviewKpi={overviewKpi}
        cumulativeKpi={cumulativeKpi}
        currentDept={currentDept}
        cumulativeDept={cumulativeDept}
        dimension={dimension}
      />

      {isOverview && (
        <ChannelRevenueSection data={chartData.channelRevenue} ... />
      )}

      {isOverview && (
        <SegmentOverviewSection
          segments={chartData.segments}
          viewMode={viewMode}
          overviewKpi={overviewKpi}
          ...
        />
      )}

      {isOverview && chartData.budgetUsage.length > 0 && (
        <BudgetUsageSection data={chartData.budgetUsage} ... />
      )}

      {layout.isVisible('cost-structure') && (
        <CostStructureSection
          data={chartData.costStructure}
          dimension={dimension}
          isOverview={isOverview}
          viewMode={viewMode}
        />
      )}

      <TrendChartsSection
        data={chartData.trend}
        comparisonData={chartData.deptComparison}
        isOverview={isOverview}
        dimension={dimension}
        viewMode={viewMode}
      />

      <SecondaryChartsSection
        data={chartData.secondary}
        isOverview={isOverview}
        dimension={dimension}
      />

      {layout.isVisible('analysis-panel') && (
        <AnalysisSection analysis={chartData.analysis} ... />
      )}

      <DashboardCustomizer ... />
    </div>
  );
}
```

### 3.2 `hooks/useDashboardMonths.ts`

```typescript
/**
 * Dashboard 月份/维度/视图模式的 URL 状态管理。
 * 所有状态通过 URL searchParams 持久化，支持浏览器前进/后退。
 */
export function useDashboardMonths() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dimension = parseDimension(searchParams.get('dimension'));
  const deptKey = DIMENSION_MAP[dimension];
  const isOverview = dimension === '总览';
  const viewMode = parseViewMode(searchParams.get('view'));
  const selectedMonth = searchParams.get('month') || ...;

  const setMonth = (month: string) => { ... };
  const setViewMode = (mode: string) => { ... };
  const setDimension = (dim: Dimension) => { ... };

  return { dimension, deptKey, isOverview, viewMode, selectedMonth,
           setMonth, setViewMode, setDimension };
}
```

### 3.3 `hooks/useDerivedOverviews.ts`

```typescript
/**
 * 从 rawOverviews + departments 派生看板使用的 overviews 数组。
 * 如果 overviews 中某月缺失，从 department 数据回退派生。
 *
 * 此 hook 替代了当前 DashboardPage 中 ~50 行的 overviews useMemo。
 */
export function useDerivedOverviews() {
  const { overviews: rawOverviews, departments } = useData();

  const derivedOverviews = useMemo(() => {
    // ... 现有派生逻辑 (当前 DashboardPage line 198-250)
  }, [rawOverviews, departments]);

  const availableMonths = useMemo(() =>
    [...new Set(derivedOverviews.map(o => o.month))].sort((a, b) => b.localeCompare(a)),
    [derivedOverviews]
  );

  return { derivedOverviews, availableMonths, departments };
}
```

### 3.4 `hooks/useOverviewKpi.ts`

```typescript
/**
 * 计算总览维度的 KPI 趋势数据。
 * 包含：当期环比/同比、累计同比。
 */
export function useOverviewKpi(
  overviews: MonthlyOverview[],
  departments: DepartmentData[],
  selectedMonth: string,
  viewMode: ViewMode
) {
  const currentOverview = useMemo(...);
  const previousOverview = useMemo(...);
  const previousYearOverview = useMemo(...);

  const overviewKpiTrends = useMemo(() => {
    // ... 现有 overviewKpiTrends 逻辑
  }, [currentOverview, previousOverview, previousYearOverview]);

  const cumulativeKpiTrends = useMemo(() => {
    // ... 现有 cumulativeKpiTrends 逻辑
  }, [cumulativeOverview, prevYearCumulativeOverview]);

  return { currentOverview, overviewKpiTrends, cumulativeKpiTrends };
}
```

### 3.5 `hooks/useSegmentStats.ts`

```typescript
/**
 * 获取当前维度的当期和累计部门统计数据。
 */
export function useSegmentStats(
  deptKey: string,
  departments: DepartmentData[],
  selectedMonth: string,
  viewMode: ViewMode
) {
  const currentDept = useMemo(...);
  const previousDept = useMemo(...);
  const cumulativeDept = useMemo(() =>
    getCumulativeDeptData(departments, selectedMonth, deptKey),
    [departments, selectedMonth, deptKey]
  );

  return { currentDept, previousDept, cumulativeDept, deptSeries };
}
```

### 3.6 `hooks/useChartData.ts`

```typescript
/**
 * 统一准备所有图表所需的数据。
 * 整合了当前 DashboardPage 中的 6+ 个 useMemo：
 *   - compositionChartData
 *   - positionChartData
 *   - trendData
 *   - deptCompareData
 *   - compositionStackData
 *   - budgetUsageData
 *   - costStructureChartData
 *
 * 每个图表数据独立 memo，只在依赖变化时重算。
 */
export function useChartData(
  overviews, departments, compositions, positions, stores,
  budgets, costStructures,
  selectedMonth, deptKey, isOverview, viewMode
) {
  const compositionChartData = useMemo(...);
  const positionChartData = useMemo(...);
  const trendData = useMemo(...);
  const deptCompareData = useMemo(...);
  const compositionStackData = useMemo(...);
  const budgetUsageData = useMemo(...);
  const costStructureChartData = useMemo(...);
  const cumulativeTrendData = useMemo(...);
  const analysis = useMemo(...);

  return {
    compositionChartData,
    positionChartData,
    trendData,
    deptCompareData,
    compositionStackData,
    budgetUsageData,
    costStructureChartData,
    cumulativeTrendData,
    analysis,
  };
}
```

### 3.7 `sections/KpiCardsSection.tsx`（~150行）

将当前 4 个 KPI 卡片的 4 种排列（总览当/累 + 板块当/累）拆分为独立子组件：

```typescript
// 内部子组件
function OverviewCurrentKpis({ overviewKpi, ... }) { ... }
function OverviewCumulativeKpis({ cumulativeKpi, ... }) { ... }
function SegmentCurrentKpis({ currentDept, ... }) { ... }
function SegmentCumulativeKpis({ cumulativeDept, ... }) { ... }

// 对外组件
export function KpiCardsSection({ isOverview, viewMode, ... }) {
  if (isOverview) {
    return viewMode === 'cumulative'
      ? <OverviewCumulativeKpis ... />
      : <OverviewCurrentKpis ... />;
  }
  return viewMode === 'cumulative'
    ? <SegmentCumulativeKpis ... />
    : <SegmentCurrentKpis ... />;
}
```

### 3.8 `sections/KpiCardsSection.tsx` — KPI 卡片数据规范

每个 KPI 卡片使用统一接口：

```typescript
interface KpiCardData {
  title: string;
  value: string;
  trend: number;          // 环比/同比变化值
  trendLabel: string;      // "环比" / "同比"
  reverseTrend?: boolean;
  icon: ReactNode;
  metricKey?: string;      // 用于 DataPathTracer
  dashboardValue?: number; // 用于数据溯源
}
```

### 3.9 其他 Section 组件

每个 Section 组件遵循同一模式：

```typescript
interface SectionProps {
  data: ChartDataType;
  dimension: string;
  isOverview: boolean;
  viewMode: ViewMode;
  selectedMonth: string;
}

export function XxxSection({ data, ... }: SectionProps) {
  if (!data || data.length === 0) {
    return <EmptyChart message="暂无数据" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getTitle(dimension, viewMode)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer>
          <ChartImplementation data={data} />
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

---

## 4. 数据流变化

### 重构前
```
DashboardPage (1672行)
  ├── 15+ useMemo（数据派生、KPI计算、图表数据准备）
  ├── 5维 × 2模式 条件渲染（大量 JSX 嵌套）
  └── 内联 helper 函数
```

### 重构后
```
DashboardPage (200行)
  ├── useDashboardMonths → URL params
  ├── useDerivedOverviews → derivedOverviews, departments
  ├── useOverviewKpi → overviewKpi, cumulativeKpi
  ├── useSegmentStats → currentDept, cumulativeDept
  ├── useChartData → { compositionData, trendData, budgetData, ... }
  └── 渲染 9 个 Section 组件（按需条件渲染）
```

---

## 5. 重构步骤

### 第一阶段：提取工具函数（1-2小时，低风险）

1. 已创建 `src/utils/numberUtils.ts` — safeNum、roundTo、safeDivide、safePercent
2. 已创建 `src/utils/dateUtils.ts` — addMonths、getPrevMonth、getMonthLabel 等
3. 已创建 `src/utils/cumulativeData.ts` — getCumulativeOverview、getCumulativeDeptData
4. 更新 `src/utils/salaryCalculations.ts` — 使用新工具函数

### 第二阶段：提取 Hooks（2-3小时，中风险）

1. 创建 `src/pages/dashboard/hooks/useDashboardMonths.ts`
2. 创建 `src/pages/dashboard/hooks/useDerivedOverviews.ts`
3. 创建 `src/pages/dashboard/hooks/useOverviewKpi.ts`
4. 创建 `src/pages/dashboard/hooks/useSegmentStats.ts`
5. 创建 `src/pages/dashboard/hooks/useChartData.ts`

**验证**：DashboardPage 引用新 hooks，行为不变

### 第三阶段：拆分 Section 组件（3-4小时，中风险）

按顺序逐个迁移，每个 Section 拆出后立即验证：

1. `DashboardHeader.tsx` — 标题栏
2. `KpiCardsSection.tsx` — KPI 卡片（最复杂，4 种排列）
3. `ChannelRevenueSection.tsx` — 渠道业绩（最简单）
4. `SegmentOverviewSection.tsx` — 四大板块
5. `BudgetUsageSection.tsx` — 预算使用率
6. `CostStructureSection.tsx` — 薪资组成
7. `TrendChartsSection.tsx` — 趋势图
8. `SecondaryChartsSection.tsx` — 副图表
9. `AnalysisSection.tsx` — 分析面板

### 第四阶段：清理与优化（1小时）

1. 移除 DashboardPage 中的内联 helper 函数
2. 统一所有 Section 的 Props 接口
3. 确保所有 useMemo 依赖正确
4. 运行 `npm run build` 确认无类型错误

---

## 6. 验证方案

### 构建验证
```bash
npm run typecheck    # TypeScript 类型检查
npm run build        # 生产构建
```

### 功能验证（手动）
1. 启动开发服务器 `npm run dev`
2. 测试 5 个维度切换（总览/总部/自营/线上/犀利工厂）
3. 测试当期/累计模式切换
4. 测试月份选择器（选择不同月份）
5. 测试数据联动（在数据管理中编辑后，看板实时更新）
6. 测试 KPI 卡片数据溯源（hover DataPathTracer）
7. 测试预算使用率颜色变化（绿/黄/红）
8. 测试空数据状态（清空数据后看板显示）
9. 测试自定义排版功能

### 回归验证
- 所有现有报表页面正常工作
- 数据管理 CRUD 正常工作
- CSV 导入正常工作

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| useMemo 依赖遗漏 | 数据不更新 | 使用 eslint-plugin-react-hooks exhaustive-deps |
| 组件 Props 传递错误 | 显示异常 | 逐步迁移，每步验证 |
| 累计计算逻辑变化 | 累计模式显示错误 | 提取前先写单元测试（可选） |
| 重构后 bundle 增大 | 首次加载变慢 | 拆分后更利于 tree-shaking，总体应减小 |

---

## 8. 预期收益

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| DashboardPage 行数 | 1672 | ~200 |
| 最大单文件行数 | 1672 | ~250 (useChartData.ts) |
| 可独立测试的单元 | 0 | ~6 hooks + ~9 components |
| 新人理解时间 | 2-3天 | 0.5-1天 |
| 修改一个图表影响范围 | 整个 DashboardPage | 单个 Section + 对应 hook |
