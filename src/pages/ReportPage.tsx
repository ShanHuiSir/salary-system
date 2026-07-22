import { Fragment, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

type ReportScope = 'hq' | 'self' | 'online' | 'factory' | 'overview';
type ReportType = 'fixed-variable' | 'business-line' | 'department' | 'level' | 'region' | 'platform' | 'cost-comparison';

const SCOPE_LABELS: Record<ReportScope, string> = {
  hq: '总部',
  self: '自营区域',
  online: '线上',
  factory: '犀利工厂',
  overview: '总览',
};

const TYPE_LABELS: Record<ReportType, string> = {
  'fixed-variable': '固浮比',
  'business-line': '业务线',
  'department': '部门',
  'level': '层级',
  'region': '区域人效',
  'platform': '各平台',
  'cost-comparison': '人力成本对比表',
};

const DEPT_MAP: Record<ReportScope, string> = {
  hq: '总部',
  self: '自营',
  online: '线上',
  factory: '犀利工厂',
  overview: '全公司',
};

// Segments for cost comparison
const COST_SEGMENTS = ['总部', '自营', '线上', '犀利工厂'] as const;
const SEGMENT_LABELS: Record<string, string> = {
  '总部': '总部',
  '自营': '自营区域',
  '线上': '线上',
  '犀利工厂': '犀利工厂',
};

function getMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
}

function formatWan(v: number) { return `${safeNum(v).toFixed(1)}万`; }

export function ReportPage() {
  const { scope, type } = useParams<{ scope: ReportScope; type: ReportType }>();
  const { compositions, positions, stores, platforms, departments, budgets, hqBusinessLines, overviews } = useData();
  const [reportSearchParams, setReportSearchParams] = useSearchParams();

  const scopeLabel = scope ? SCOPE_LABELS[scope] : '';
  const typeLabel = scope === 'self' && type === 'business-line'
    ? '区域'
    : scope === 'self' && type === 'department'
    ? '店铺'
    : type
    ? TYPE_LABELS[type]
    : '';

  // Get latest month from department data
  const latestMonth = useMemo(() => {
    if (scope === 'overview') {
      // For overview, use the latest month from any data source
      const allMonths = [
        ...overviews.map((o) => o.month),
        ...departments.map((d) => d.month),
        ...budgets.map((b) => b.month),
      ].sort((a, b) => b.localeCompare(a));
      return allMonths[0] ?? undefined;
    }
    const deptKey = scope ? DEPT_MAP[scope] : '';
    const deptData = departments.filter((d) => d.department === deptKey);
    if (deptData.length === 0) return undefined;
    return deptData.sort((a, b) => a.month.localeCompare(b.month))[deptData.length - 1]?.month;
  }, [departments, scope, overviews, budgets]);

  // Report-level URL params for month and view mode (used by business-line & department reports)
  const reportMonth = reportSearchParams.get('month') || '';
  const reportViewMode = (reportSearchParams.get('view') === 'cumulative' ? 'cumulative' : 'current') as 'current' | 'cumulative';
  const currentCalendarYear = String(new Date().getFullYear());

  const handleReportMonthChange = (month: string) => {
    const params = new URLSearchParams(reportSearchParams);
    params.set('month', month);
    setReportSearchParams(params, { replace: true });
  };

  const handleReportViewModeChange = (mode: string) => {
    const params = new URLSearchParams(reportSearchParams);
    params.set('view', mode);
    setReportSearchParams(params, { replace: true });
  };

  if (!scope || !type) {
    return <div className="p-8 text-center text-muted-foreground">无效的报表路径</div>;
  }

  // ========== 固浮比（总人力成本口径） ==========
  if (type === 'fixed-variable') {
    const deptKey = DEPT_MAP[scope];
    const monthComps = compositions
      .filter((c) => c.department === deptKey)
      .sort((a, b) => b.month.localeCompare(a.month));
    const chartMonthComps = monthComps.filter((c) => c.month.startsWith(`${currentCalendarYear}-`));

    const latestComp = monthComps[0];
    const latestChartComp = chartMonthComps[0];

    const totalLaborCost = (c: typeof monthComps[0]) =>
      c.fixedIncome + c.floatingIncome + c.socialInsurance + c.severance + c.outsourcing;

    const pieData = latestChartComp
      ? [
          { name: '固定收入', value: latestChartComp.fixedIncome },
          { name: '浮动收入', value: latestChartComp.floatingIncome },
          { name: '社保公积金', value: latestChartComp.socialInsurance },
          { name: '经济补偿金', value: latestChartComp.severance },
          { name: '外包费用', value: latestChartComp.outsourcing },
        ].filter((d) => d.value > 0)
      : [];

    const trendData = chartMonthComps.slice().reverse().map((c) => ({
      month: c.month,
      固定收入: c.fixedIncome,
      浮动收入: c.floatingIncome,
      社保公积金: c.socialInsurance,
      经济补偿金: c.severance,
      外包费用: c.outsourcing,
    }));

    const totalFixed = latestComp?.fixedIncome ?? 0;
    const totalVariable = latestComp?.floatingIncome ?? 0;
    const totalLabor = latestComp ? totalLaborCost(latestComp) : 0;
    const fixedRatio = totalFixed + totalVariable > 0 ? (totalFixed / (totalFixed + totalVariable)) * 100 : 0;
    const variableRatio = totalFixed + totalVariable > 0 ? (totalVariable / (totalFixed + totalVariable)) * 100 : 0;

    return (
      <ReportLayout title={`${scopeLabel} · ${typeLabel}`} subtitle={`最新数据月份：${latestComp?.month ?? '--'}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBox title="固定收入" value={formatWan(totalFixed)} ratio={`${safeNum(fixedRatio).toFixed(1)}%`} color="text-blue-600" />
          <KpiBox title="浮动收入" value={formatWan(totalVariable)} ratio={`${safeNum(variableRatio).toFixed(1)}%`} color="text-green-600" />
          <KpiBox title="固浮比" value={`${safeNum(fixedRatio).toFixed(0)}:${safeNum(variableRatio).toFixed(0)}`} color="text-purple-600" />
          <KpiBox title="总人力成本" value={formatWan(totalLabor)} color="text-orange-600" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">成本构成（{currentCalendarYear}年最新月份）</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}万`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">人力成本月度趋势（{currentCalendarYear}年）</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Bar dataKey="固定收入" stackId="a" fill={CHART_COLORS[0]} />
                      <Bar dataKey="浮动收入" stackId="a" fill={CHART_COLORS[1]} />
                      <Bar dataKey="社保公积金" stackId="a" fill={CHART_COLORS[2]} />
                      <Bar dataKey="经济补偿金" stackId="a" fill={CHART_COLORS[3]} />
                      <Bar dataKey="外包费用" stackId="a" fill={CHART_COLORS[4]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">月度固浮比明细</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>月份</TableHead>
                    <TableHead>固定收入(万)</TableHead>
                    <TableHead>浮动收入(万)</TableHead>
                    <TableHead>社保公积金(万)</TableHead>
                    <TableHead>经济补偿金(万)</TableHead>
                    <TableHead>外包费用(万)</TableHead>
                    <TableHead>人力成本合计(万)</TableHead>
                    <TableHead>固浮比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthComps.map((c) => {
                    const total = totalLaborCost(c);
                    const fvTotal = c.fixedIncome + c.floatingIncome;
                    const fr = fvTotal > 0 ? (c.fixedIncome / fvTotal) * 100 : 0;
                    const vr = fvTotal > 0 ? (c.floatingIncome / fvTotal) * 100 : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.month}</TableCell>
                        <TableCell>{safeNum(c.fixedIncome).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(c.floatingIncome).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(c.socialInsurance).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(c.severance).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(c.outsourcing).toFixed(1)}</TableCell>
                        <TableCell className="font-semibold">{safeNum(total).toFixed(1)}</TableCell>
                        <TableCell><Badge variant="outline">{safeNum(fr).toFixed(0)}:{safeNum(vr).toFixed(0)}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 总部-各业务线固浮比 */}
        {scope === 'hq' && (() => {
          const blLatest = hqBusinessLines.filter((d) => d.month === (latestComp?.month ?? ''));
          const blChartLatest = hqBusinessLines.filter((d) => d.month === (latestChartComp?.month ?? ''));
          const blChartData = blChartLatest.map((d) => ({
            name: d.businessLine,
            固定收入: d.fixedSalary,
            浮动收入: d.variableSalary,
            社保公积金: d.socialBenefits,
          }));
          const blTotalLabor = blLatest.reduce((s, d) => s + d.laborCost, 0);

          return (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">各业务线固浮比对比（{latestChartComp?.month ?? `${currentCalendarYear}年`}）</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-72">
                      {blChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={blChartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                            <Tooltip formatter={(v, name) => [`${Number(v).toFixed(1)}万`, String(name)]} />
                            <Legend />
                            <Bar dataKey="固定收入" stackId="a" fill={CHART_COLORS[0]} />
                            <Bar dataKey="浮动收入" stackId="a" fill={CHART_COLORS[1]} />
                            <Bar dataKey="社保公积金" stackId="a" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <EmptyState />}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">各业务线固浮比占比（{latestChartComp?.month ?? `${currentCalendarYear}年`}）</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-72">
                      {blChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={blChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                            <Tooltip formatter={(v, name) => [`${Number(v).toFixed(1)}万`, String(name)]} />
                            <Legend />
                            <Bar dataKey="固定收入" stackId="a" fill={CHART_COLORS[0]} />
                            <Bar dataKey="浮动收入" stackId="a" fill={CHART_COLORS[1]} />
                            <Bar dataKey="社保公积金" stackId="a" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <EmptyState />}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">业务线固浮比明细</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-md border max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>业务线</TableHead>
                          <TableHead className="text-right">人数</TableHead>
                          <TableHead className="text-right">固定收入(万)</TableHead>
                          <TableHead className="text-right">浮动收入(万)</TableHead>
                          <TableHead className="text-right">社保公积金(万)</TableHead>
                          <TableHead className="text-right">人力成本(万)</TableHead>
                          <TableHead className="text-right">占比</TableHead>
                          <TableHead className="text-right">固浮比</TableHead>
                          <TableHead className="text-right">人均成本(万)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blLatest.map((d) => {
                          const total = d.fixedSalary + d.variableSalary;
                          const fr = total > 0 ? (d.fixedSalary / total) * 100 : 0;
                          const vr = total > 0 ? (d.variableSalary / total) * 100 : 0;
                          const perCapita = d.headcount > 0 ? d.laborCost / d.headcount : 0;
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium">{d.businessLine}</TableCell>
                              <TableCell className="text-right">{d.headcount}</TableCell>
                              <TableCell className="text-right">{safeNum(d.fixedSalary).toFixed(1)}</TableCell>
                              <TableCell className="text-right">{safeNum(d.variableSalary).toFixed(1)}</TableCell>
                              <TableCell className="text-right">{safeNum(d.socialBenefits).toFixed(1)}</TableCell>
                              <TableCell className="text-right font-semibold">{safeNum(d.laborCost).toFixed(1)}</TableCell>
                              <TableCell className="text-right">{((d.laborCost / blTotalLabor) * 100).toFixed(1)}%</TableCell>
                              <TableCell className="text-right"><Badge variant="outline">{safeNum(fr).toFixed(0)}:{safeNum(vr).toFixed(0)}</Badge></TableCell>
                              <TableCell className="text-right">{safeNum(perCapita).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>合计</TableCell>
                          <TableCell className="text-right">{blLatest.reduce((s, d) => s + d.headcount, 0)}</TableCell>
                          <TableCell className="text-right">{blLatest.reduce((s, d) => s + d.fixedSalary, 0).toFixed(1)}</TableCell>
                          <TableCell className="text-right">{blLatest.reduce((s, d) => s + d.variableSalary, 0).toFixed(1)}</TableCell>
                          <TableCell className="text-right">{blLatest.reduce((s, d) => s + d.socialBenefits, 0).toFixed(1)}</TableCell>
                          <TableCell className="text-right">{safeNum(blTotalLabor).toFixed(1)}</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className="text-right">{(blTotalLabor / blLatest.reduce((s, d) => s + d.headcount, 0)).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          );
        })()}
      </ReportLayout>
    );
  }

  // ========== 业务线 (all scopes, using budget data) ==========
  if (type === 'business-line') {
    const segmentKey = DEPT_MAP[scope];
    const lineLabel = scope === 'self' ? '区域' : '业务线';
    const scopeBudgets = budgets.filter((b) => b.segment === segmentKey);

    // Available months from budget data
    const reportMonths = [...new Set(scopeBudgets.map((b) => b.month))].sort((a, b) => b.localeCompare(a));
    const selectedReportMonth = reportMonth || reportMonths[0] || latestMonth || '';

    // Aggregate by businessLine (IIFE instead of useMemo to avoid conditional hooks)
    const blData = (() => {
      if (!selectedReportMonth) return [];

      // Compute previous month for MoM
      const [year, monthNum] = selectedReportMonth.split('-').map(Number);
      const prevDate = new Date(year, monthNum - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const yoyMonth = `${year - 1}-${String(monthNum).padStart(2, '0')}`;

      const aggregateByBL = (monthFilter: string) => {
        const monthData = scopeBudgets.filter((b) => b.month === monthFilter);
        const grouped = new Map<string, { businessLine: string; headcount: number; laborCost: number; budgetLaborCost: number }>();
        monthData.forEach((b) => {
          const existing = grouped.get(b.businessLine) ?? { businessLine: b.businessLine, headcount: 0, laborCost: 0, budgetLaborCost: 0 };
          existing.headcount += b.headcount;
          existing.laborCost += b.laborCost;
          existing.budgetLaborCost += b.budgetLaborCost;
          grouped.set(b.businessLine, existing);
        });
        return grouped;
      };

      if (reportViewMode === 'cumulative') {
        const monthsData = scopeBudgets.filter((b) => b.month.startsWith(String(year)) && b.month <= selectedReportMonth);
        const grouped = new Map<string, { businessLine: string; laborCost: number; budgetLaborCost: number }>();
        monthsData.forEach((b) => {
          const existing = grouped.get(b.businessLine) ?? { businessLine: b.businessLine, laborCost: 0, budgetLaborCost: 0 };
          existing.laborCost += b.laborCost;
          existing.budgetLaborCost += b.budgetLaborCost;
          grouped.set(b.businessLine, existing);
        });
        const latestMonthData = scopeBudgets.filter((b) => b.month === selectedReportMonth);

        // Previous month cumulative for MoM
        const prevCumData = scopeBudgets.filter((b) => b.month.startsWith(String(year)) && b.month <= prevMonth);
        const prevGrouped = new Map<string, { laborCost: number }>();
        prevCumData.forEach((b) => {
          const existing = prevGrouped.get(b.businessLine) ?? { laborCost: 0 };
          existing.laborCost += b.laborCost;
          prevGrouped.set(b.businessLine, existing);
        });

        // YoY (same period last year)
        const yoyCumData = scopeBudgets.filter((b) => b.month.startsWith(String(year - 1)) && b.month <= yoyMonth);
        const yoyGrouped = new Map<string, { laborCost: number }>();
        yoyCumData.forEach((b) => {
          const existing = yoyGrouped.get(b.businessLine) ?? { laborCost: 0 };
          existing.laborCost += b.laborCost;
          yoyGrouped.set(b.businessLine, existing);
        });

        return Array.from(grouped.values()).map((g) => {
          const latestItems = latestMonthData.filter((b) => b.businessLine === g.businessLine);
          const hc = latestItems.reduce((s, b) => s + b.headcount, 0);
          const prevLabor = prevGrouped.get(g.businessLine)?.laborCost ?? 0;
          const yoyLabor = yoyGrouped.get(g.businessLine)?.laborCost ?? 0;
          const momRate = prevLabor > 0 ? ((g.laborCost - prevLabor) / prevLabor) * 100 : 0;
          const yoyRate = yoyLabor > 0 ? ((g.laborCost - yoyLabor) / yoyLabor) * 100 : 0;
          return {
            ...g,
            headcount: hc,
            prevLaborCost: prevLabor,
            yoyLaborCost: yoyLabor,
            momRate,
            yoyRate,
            perCapitaCost: hc > 0 ? g.laborCost / hc : 0,
          };
        });
      }

      // Current month
      const grouped = aggregateByBL(selectedReportMonth);
      const prevGrouped = aggregateByBL(prevMonth);
      const yoyGrouped = aggregateByBL(yoyMonth);

      return Array.from(grouped.values()).map((g) => {
        const prevLabor = prevGrouped.get(g.businessLine)?.laborCost ?? 0;
        const yoyLabor = yoyGrouped.get(g.businessLine)?.laborCost ?? 0;
        const momRate = prevLabor > 0 ? ((g.laborCost - prevLabor) / prevLabor) * 100 : 0;
        const yoyRate = yoyLabor > 0 ? ((g.laborCost - yoyLabor) / yoyLabor) * 100 : 0;
        return {
          ...g,
          prevLaborCost: prevLabor,
          yoyLaborCost: yoyLabor,
          momRate,
          yoyRate,
          perCapitaCost: g.headcount > 0 ? g.laborCost / g.headcount : 0,
        };
      });
    })();

    // Totals
    const totalHeadcount = blData.reduce((s, d) => s + d.headcount, 0);
    const totalLaborCost = blData.reduce((s, d) => s + d.laborCost, 0);
    const totalBudget = blData.reduce((s, d) => s + d.budgetLaborCost, 0);
    const totalUsageRate = totalBudget > 0 ? (totalLaborCost / totalBudget) * 100 : 0;

    const chartData = blData.map((d) => ({
      name: d.businessLine,
      人力成本: d.laborCost,
      预算: d.budgetLaborCost,
    }));

    const cumLabel = reportViewMode === 'cumulative'
      ? `${selectedReportMonth.split('-')[0]}年1-${parseInt(selectedReportMonth.split('-')[1])}月累计`
      : '';

    return (
      <ReportLayout
        title={`${scopeLabel} · ${typeLabel}`}
        subtitle={reportViewMode === 'cumulative' ? cumLabel : `数据月份：${getMonthLabel(selectedReportMonth)}`}
      >
        {/* Month selector + view mode toggle */}
        <div className="flex items-center gap-3">
          <Select value={selectedReportMonth} onValueChange={handleReportMonthChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {reportMonths.map((m) => (
                <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={reportViewMode} onValueChange={handleReportViewModeChange}>
            <TabsList>
              <TabsTrigger value="current">当期</TabsTrigger>
              <TabsTrigger value="cumulative">年度累计</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBox title="总人数" value={`${totalHeadcount}人`} color="text-blue-600" />
          <KpiBox title="总人力成本" value={formatWan(totalLaborCost)} color="text-orange-600" />
          <KpiBox title="总预算人力成本" value={formatWan(totalBudget)} color="text-green-600" />
          <KpiBox
            title="人力成本预算使用率"
            value={`${safeNum(totalUsageRate).toFixed(1)}%`}
            color={totalUsageRate > 100 ? 'text-red-600' : 'text-emerald-600'}
          />
        </div>

        {/* Chart: budget vs actual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {reportViewMode === 'cumulative' ? `各${lineLabel}人力成本与预算对比（累计）` : `各${lineLabel}人力成本与预算对比`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip formatter={(v, name) => [`${Number(v).toFixed(1)}万`, String(name)]} />
                    <Legend />
                    <Bar dataKey="人力成本" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="预算" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </CardContent>
        </Card>

        {/* Detail table */}
        <Card>
          <CardHeader><CardTitle className="text-base">{lineLabel}明细</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>{lineLabel}</TableHead>
                    <TableHead className="text-right">人数</TableHead>
                    <TableHead className="text-right">人力成本(万)</TableHead>
                    <TableHead className="text-right">预算人力成本(万)</TableHead>
                    <TableHead className="text-right">预算差异(万)</TableHead>
                    <TableHead className="text-right">预算使用率</TableHead>
                    <TableHead className="text-right">环比</TableHead>
                    <TableHead className="text-right">同比</TableHead>
                    <TableHead className="text-right">人均人力成本(万)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blData.map((d) => {
                    const usageRate = d.budgetLaborCost > 0 ? (d.laborCost / d.budgetLaborCost) * 100 : 0;
                    const diff = d.laborCost - d.budgetLaborCost;
                    return (
                      <TableRow key={d.businessLine}>
                        <TableCell className="font-medium">{d.businessLine}</TableCell>
                        <TableCell className="text-right">{d.headcount}</TableCell>
                        <TableCell className="text-right">{safeNum(d.laborCost).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{safeNum(d.budgetLaborCost).toFixed(1)}</TableCell>
                        <TableCell className={`text-right ${diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {diff > 0 ? '+' : ''}{safeNum(diff).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={usageRate > 100 ? 'destructive' : 'outline'}>
                            {safeNum(usageRate).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right ${d.momRate < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {d.prevLaborCost > 0 ? `${d.momRate > 0 ? '+' : ''}${safeNum(d.momRate).toFixed(1)}%` : '--'}
                        </TableCell>
                        <TableCell className={`text-right ${d.yoyRate < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {d.yoyLaborCost > 0 ? `${d.yoyRate > 0 ? '+' : ''}${safeNum(d.yoyRate).toFixed(1)}%` : '--'}
                        </TableCell>
                        <TableCell className="text-right">{d.perCapitaCost > 0 ? safeNum(d.perCapitaCost).toFixed(2) : '--'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Summary row */}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>合计</TableCell>
                    <TableCell className="text-right">{totalHeadcount}</TableCell>
                    <TableCell className="text-right">{safeNum(totalLaborCost).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{safeNum(totalBudget).toFixed(1)}</TableCell>
                    <TableCell className={`text-right ${totalLaborCost - totalBudget > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {totalLaborCost - totalBudget > 0 ? '+' : ''}{(totalLaborCost - totalBudget).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={totalUsageRate > 100 ? 'destructive' : 'outline'}>
                        {safeNum(totalUsageRate).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">{totalHeadcount > 0 ? (totalLaborCost / totalHeadcount).toFixed(2) : '--'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ReportLayout>
    );
  }

  // ========== 部门 (all scopes, using budget data) ==========
  if (type === 'department') {
    const segmentKey = DEPT_MAP[scope];
    const deptLabel = scope === 'self' ? '店铺' : '部门';
    const lineLabel = scope === 'self' ? '区域' : '业务线';
    const groupLabel = scope === 'self' ? '区域' : '中心';
    const scopeBudgets = budgets.filter((b) => b.segment === segmentKey);

    // Available months
    const reportMonths = [...new Set(scopeBudgets.map((b) => b.month))].sort((a, b) => b.localeCompare(a));
    const selectedReportMonth = reportMonth || reportMonths[0] || latestMonth || '';

    // Department-level data (IIFE to avoid conditional hooks)
    const deptData = (() => {
      if (!selectedReportMonth) return [];
      if (reportViewMode === 'cumulative') {
        const [year] = selectedReportMonth.split('-');
        const monthsData = scopeBudgets.filter((b) => b.month.startsWith(year) && b.month <= selectedReportMonth);
        // Group by center -> department
        const grouped = new Map<string, { center: string; department: string; businessLine: string; laborCost: number; budgetLaborCost: number }>();
        monthsData.forEach((b) => {
          const key = `${b.center}|||${b.department}`;
          const existing = grouped.get(key) ?? { center: b.center, department: b.department, businessLine: b.businessLine, laborCost: 0, budgetLaborCost: 0 };
          existing.laborCost += b.laborCost;
          existing.budgetLaborCost += b.budgetLaborCost;
          grouped.set(key, existing);
        });
        // Headcount: use latest month snapshot
        const latestMonthData = scopeBudgets.filter((b) => b.month === selectedReportMonth);
        return Array.from(grouped.values()).map((g) => {
          const latestItem = latestMonthData.find((b) => b.center === g.center && b.department === g.department);
          return { ...g, headcount: latestItem ? latestItem.headcount : 0 };
        });
      }
      // Current month
      return scopeBudgets
        .filter((b) => b.month === selectedReportMonth)
        .map((b) => ({
          center: b.center,
          department: b.department,
          businessLine: b.businessLine,
          headcount: b.headcount,
          laborCost: b.laborCost,
          budgetLaborCost: b.budgetLaborCost,
        }));
    })();

    // Group by center (IIFE to avoid conditional hooks)
    const groupedByCenter = (() => {
      const grouped = new Map<string, typeof deptData>();
      deptData.forEach((d) => {
        if (!grouped.has(d.center)) grouped.set(d.center, []);
        grouped.get(d.center)!.push(d);
      });
      return Array.from(grouped.entries());
    })();

    // Totals
    const totalHeadcount = deptData.reduce((s, d) => s + d.headcount, 0);
    const totalLaborCost = deptData.reduce((s, d) => s + d.laborCost, 0);
    const totalBudget = deptData.reduce((s, d) => s + d.budgetLaborCost, 0);
    const totalUsageRate = totalBudget > 0 ? (totalLaborCost / totalBudget) * 100 : 0;

    const cumLabel = reportViewMode === 'cumulative'
      ? `${selectedReportMonth.split('-')[0]}年1-${parseInt(selectedReportMonth.split('-')[1])}月累计`
      : '';

    return (
      <ReportLayout
        title={`${scopeLabel} · ${typeLabel}`}
        subtitle={reportViewMode === 'cumulative' ? cumLabel : `数据月份：${getMonthLabel(selectedReportMonth)}`}
      >
        {/* Month selector + view mode toggle */}
        <div className="flex items-center gap-3">
          <Select value={selectedReportMonth} onValueChange={handleReportMonthChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {reportMonths.map((m) => (
                <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={reportViewMode} onValueChange={handleReportViewModeChange}>
            <TabsList>
              <TabsTrigger value="current">当期</TabsTrigger>
              <TabsTrigger value="cumulative">年度累计</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBox title="总人数" value={`${totalHeadcount}人`} color="text-blue-600" />
          <KpiBox title="总人力成本" value={formatWan(totalLaborCost)} color="text-orange-600" />
          <KpiBox title="总预算人力成本" value={formatWan(totalBudget)} color="text-green-600" />
          <KpiBox
            title="人力成本预算使用率"
            value={`${safeNum(totalUsageRate).toFixed(1)}%`}
            color={totalUsageRate > 100 ? 'text-red-600' : 'text-emerald-600'}
          />
        </div>

        {/* Detail table (unified, sticky header, center group rows) */}
        <Card>
          <CardHeader><CardTitle className="text-base">{deptLabel}明细（按{groupLabel}分组）</CardTitle></CardHeader>
          <CardContent>
            {groupedByCenter.length > 0 ? (
              <div className="max-h-[500px] overflow-auto rounded-md border">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="bg-card shadow-sm">
                    <TableRow>
                      <TableHead className="sticky top-0 z-20 min-w-[120px] bg-card">{deptLabel}</TableHead>
                      <TableHead className="sticky top-0 z-20 min-w-[100px] bg-card">{lineLabel}</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-card text-right">人数</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-card text-right">人力成本(万)</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-card text-right">预算人力成本(万)</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-card text-right">预算差异(万)</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-card text-right">预算使用率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByCenter.map(([center, items]) => {
                      const centerLabor = items.reduce((s, d) => s + d.laborCost, 0);
                      const centerBudget = items.reduce((s, d) => s + d.budgetLaborCost, 0);
                      const centerUsage = centerBudget > 0 ? (centerLabor / centerBudget) * 100 : 0;
                      const centerHeadcount = items.reduce((s, d) => s + d.headcount, 0);
                      const centerDiff = centerLabor - centerBudget;
                      return (
                        <Fragment key={center}>
                          {/* Center group header row */}
                          <TableRow className="bg-muted/50 border-y-2 border-border">
                            <TableCell colSpan={2} className="font-semibold text-sm">
                              {center}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{centerHeadcount}</TableCell>
                            <TableCell className="text-right font-semibold">{safeNum(centerLabor).toFixed(1)}</TableCell>
                            <TableCell className="text-right font-semibold">{safeNum(centerBudget).toFixed(1)}</TableCell>
                            <TableCell className={`text-right font-semibold ${centerDiff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {centerDiff > 0 ? '+' : ''}{safeNum(centerDiff).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={centerUsage > 100 ? 'destructive' : 'outline'}>
                                {safeNum(centerUsage).toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {/* Department rows */}
                          {items.map((d) => {
                            const usageRate = d.budgetLaborCost > 0 ? (d.laborCost / d.budgetLaborCost) * 100 : 0;
                            const diff = d.laborCost - d.budgetLaborCost;
                            return (
                              <TableRow key={`${d.center}-${d.department}`}>
                                <TableCell className="font-medium pl-6">{d.department}</TableCell>
                                <TableCell className="text-muted-foreground">{d.businessLine}</TableCell>
                                <TableCell className="text-right">{d.headcount}</TableCell>
                                <TableCell className="text-right">{safeNum(d.laborCost).toFixed(1)}</TableCell>
                                <TableCell className="text-right">{safeNum(d.budgetLaborCost).toFixed(1)}</TableCell>
                                <TableCell className={`text-right ${diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {diff > 0 ? '+' : ''}{safeNum(diff).toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={usageRate > 100 ? 'destructive' : 'outline'}>
                                    {safeNum(usageRate).toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card>
          <CardHeader><CardTitle className="text-base">预算执行汇总</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>板块</TableHead>
                    <TableHead className="text-right">人数</TableHead>
                    <TableHead className="text-right">人力成本(万)</TableHead>
                    <TableHead className="text-right">预算人力成本(万)</TableHead>
                    <TableHead className="text-right">预算差异(万)</TableHead>
                    <TableHead className="text-right">预算使用率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-semibold">
                    <TableCell>{scopeLabel}</TableCell>
                    <TableCell className="text-right">{totalHeadcount}</TableCell>
                    <TableCell className="text-right">{safeNum(totalLaborCost).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{safeNum(totalBudget).toFixed(1)}</TableCell>
                    <TableCell className={`text-right ${totalLaborCost - totalBudget > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {totalLaborCost - totalBudget > 0 ? '+' : ''}{(totalLaborCost - totalBudget).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={totalUsageRate > 100 ? 'destructive' : 'outline'}>
                        {safeNum(totalUsageRate).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ReportLayout>
    );
  }

  // ========== 总部-层级 ==========
  if (scope === 'hq' && type === 'level') {
    const data = positions
      .filter((p) => p.month === latestMonth && p.department === '总部')
      .sort((a, b) => b.laborCost - a.laborCost);

    const chartData = data.map((p) => ({
      name: p.level,
      人力成本: p.laborCost,
      人数: p.headcount,
    }));

    return (
      <ReportLayout title={`${scopeLabel} · ${typeLabel}`} subtitle={`最新数据月份：${latestMonth ?? '--'}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">各层级人力成本</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v) => [`${v}万`, '人力成本']} />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">各层级人数分布</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="人数" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">层级明细</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>层级</TableHead>
                    <TableHead>人数</TableHead>
                    <TableHead>人力成本(万)</TableHead>
                    <TableHead>占比</TableHead>
                    <TableHead>人均成本(万)</TableHead>
                    <TableHead>人数环比</TableHead>
                    <TableHead>人数同比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.level}</TableCell>
                      <TableCell>{p.headcount}</TableCell>
                      <TableCell>{safeNum(p.laborCost).toFixed(1)}</TableCell>
                      <TableCell>{safeNum(p.ratio).toFixed(2)}%</TableCell>
                      <TableCell>{p.headcount > 0 ? (p.laborCost / p.headcount).toFixed(2) : '--'}</TableCell>
                      <TableCell className={p.momHeadcount < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {p.momHeadcount > 0 ? '+' : ''}{p.momHeadcount}
                      </TableCell>
                      <TableCell className={p.yoyHeadcount < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {p.yoyHeadcount > 0 ? '+' : ''}{p.yoyHeadcount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ReportLayout>
    );
  }

  // ========== 自营-区域人效 ==========
  if (scope === 'self' && type === 'region') {
    const data = stores.filter((s) => s.month === latestMonth);
    const chartData = data.map((s) => ({
      name: s.region,
      店效: s.storeEfficiency,
      人效: s.personEfficiency,
      营收: s.revenue,
      人力成本: s.laborCost,
    }));

    return (
      <ReportLayout title={`${scopeLabel} · ${typeLabel}`} subtitle={`最新数据月份：${latestMonth ?? '--'}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">各区域店效与人效对比</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="店效" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="人效" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">各区域营收与人力成本</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Bar dataKey="营收" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">区域人效明细</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>区域</TableHead>
                    <TableHead>门店数</TableHead>
                    <TableHead>营收(万)</TableHead>
                    <TableHead>人力成本(万)</TableHead>
                    <TableHead>店效</TableHead>
                    <TableHead>人效</TableHead>
                    <TableHead>营收环比(万)</TableHead>
                    <TableHead>营收同比(万)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.region}</TableCell>
                      <TableCell>{s.storeCount}</TableCell>
                      <TableCell>{safeNum(s.revenue).toFixed(1)}</TableCell>
                      <TableCell>{safeNum(s.laborCost).toFixed(1)}</TableCell>
                      <TableCell>{safeNum(s.storeEfficiency).toFixed(2)}</TableCell>
                      <TableCell>{safeNum(s.personEfficiency).toFixed(2)}</TableCell>
                      <TableCell className={s.momRevenue < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {s.momRevenue > 0 ? '+' : ''}{safeNum(s.momRevenue).toFixed(1)}
                      </TableCell>
                      <TableCell className={s.yoyRevenue < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {s.yoyRevenue > 0 ? '+' : ''}{safeNum(s.yoyRevenue).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ReportLayout>
    );
  }

  // ========== 线上-各平台 ==========
  if (scope === 'online' && type === 'platform') {
    const data = platforms.filter((p) => p.month === latestMonth);
    const chartData = data.map((p) => ({
      name: p.platform,
      营收: p.revenue,
      人力成本: p.laborCost,
      固定工资: p.fixedSalary,
      变动工资: p.variableSalary,
    }));

    return (
      <ReportLayout title={`${scopeLabel} · ${typeLabel}`} subtitle={`最新数据月份：${latestMonth ?? '--'}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">各平台营收与人力成本</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Bar dataKey="营收" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="人力成本" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">各平台固浮比</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}万`} />
                      <Tooltip formatter={(v, name) => [`${v}万`, String(name)]} />
                      <Legend />
                      <Bar dataKey="固定工资" stackId="a" fill={CHART_COLORS[0]} />
                      <Bar dataKey="变动工资" stackId="a" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">平台明细</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>平台</TableHead>
                    <TableHead>人数</TableHead>
                    <TableHead>人力成本(万)</TableHead>
                    <TableHead>固定工资(万)</TableHead>
                    <TableHead>变动工资(万)</TableHead>
                    <TableHead>固浮比</TableHead>
                    <TableHead>营收(万)</TableHead>
                    <TableHead>人均营收(万)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((p) => {
                    const total = p.fixedSalary + p.variableSalary;
                    const fr = total > 0 ? (p.fixedSalary / total) * 100 : 0;
                    const vr = total > 0 ? (p.variableSalary / total) * 100 : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.platform}</TableCell>
                        <TableCell>{p.headcount}</TableCell>
                        <TableCell>{safeNum(p.laborCost).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(p.fixedSalary).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(p.variableSalary).toFixed(1)}</TableCell>
                        <TableCell><Badge variant="outline">{safeNum(fr).toFixed(0)}:{safeNum(vr).toFixed(0)}</Badge></TableCell>
                        <TableCell>{safeNum(p.revenue).toFixed(1)}</TableCell>
                        <TableCell>{safeNum(p.perCapitaRevenue).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ReportLayout>
    );
  }

  // ========== 人力成本对比表 (总览维度) ==========
  if (type === 'cost-comparison') {
    // Available months from all data sources (IIFE to avoid conditional hooks)
    const reportMonths = (() => {
      const months = new Set<string>();
      departments.forEach((d) => months.add(d.month));
      overviews.forEach((o) => months.add(o.month));
      return Array.from(months).sort((a, b) => b.localeCompare(a));
    })();

    const selectedReportMonth = reportMonth || reportMonths[0] || latestMonth || '';

    // Compute previous month and previous year same month strings (IIFE to avoid conditional hooks)
    const { prevMonthStr, yoyMonthStr } = (() => {
      if (!selectedReportMonth) return { prevMonthStr: '', yoyMonthStr: '' };
      const [year, monthNum] = selectedReportMonth.split('-').map(Number);
      const prevDate = new Date(year, monthNum - 2, 1);
      const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const yoyStr = `${year - 1}-${String(monthNum).padStart(2, '0')}`;
      return { prevMonthStr: prevStr, yoyMonthStr: yoyStr };
    })();

    // Build comparison data per segment with 环比/同比 (IIFE to avoid conditional hooks)
    const comparisonData = (() => {
      if (!selectedReportMonth) return [];

      return COST_SEGMENTS.map((seg) => {
        const deptKey = seg;
        // Current month
        const deptItem = departments.find(
          (d) => d.department === deptKey && d.month === selectedReportMonth
        );
        // Previous month (for computing 环比 of derived metrics)
        const prevDeptItem = departments.find(
          (d) => d.department === deptKey && d.month === prevMonthStr
        );
        // Previous year same month (for computing 同比 of derived metrics)
        const yoyDeptItem = departments.find(
          (d) => d.department === deptKey && d.month === yoyMonthStr
        );

        const headcount = deptItem?.headcount ?? 0;
        const laborCost = deptItem?.laborCost ?? 0;
        const laborCostRatio = deptItem?.laborCostRatio ?? 0;

        // 人数环比/同比 (absolute change)
        const momHeadcount = deptItem?.momHeadcount ?? null;
        const yoyHeadcount = deptItem?.yoyHeadcount ?? null;

        // 人均成本 = 人力成本 / 人数
        const perCapitaCost = headcount > 0 ? laborCost / headcount : 0;
        const prevPerCapitaCost = prevDeptItem && prevDeptItem.headcount > 0
          ? prevDeptItem.laborCost / prevDeptItem.headcount : 0;
        const yoyPerCapitaCost = yoyDeptItem && yoyDeptItem.headcount > 0
          ? yoyDeptItem.laborCost / yoyDeptItem.headcount : 0;

        // 人力成本环比/同比 (absolute 万元 difference)
        const momLaborCost = prevDeptItem ? laborCost - prevDeptItem.laborCost : null;
        const yoyLaborCost = yoyDeptItem ? laborCost - yoyDeptItem.laborCost : null;

        // 人均成本环比/同比 (absolute 万元 difference)
        const momPerCapita = prevPerCapitaCost > 0
          ? perCapitaCost - prevPerCapitaCost : null;
        const yoyPerCapita = yoyPerCapitaCost > 0
          ? perCapitaCost - yoyPerCapitaCost : null;

        // 人力成本率环比/同比 (percentage point change)
        const prevLaborCostRatio = prevDeptItem?.laborCostRatio ?? null;
        const yoyLaborCostRatio = yoyDeptItem?.laborCostRatio ?? null;

        return {
          segment: seg,
          label: SEGMENT_LABELS[seg] ?? seg,
          headcount,
          laborCost,
          laborCostRatio,
          perCapitaCost,
          momHeadcount,
          yoyHeadcount,
          momLaborCost,
          yoyLaborCost,
          momPerCapita,
          yoyPerCapita,
          prevLaborCostRatio,
          yoyLaborCostRatio,
        };
      });
    })();

    // Totals from monthly overview
    const overviewItem = overviews.find((o) => o.month === selectedReportMonth);
    const prevOverviewItem = overviews.find((o) => o.month === prevMonthStr);
    const yoyOverviewItem = overviews.find((o) => o.month === yoyMonthStr);
    const totalHeadcount = comparisonData.reduce((s, d) => s + d.headcount, 0);
    const totalLaborCost = comparisonData.reduce((s, d) => s + d.laborCost, 0);
    const totalRevenue = overviewItem?.totalRevenue ?? 0;
    const overallLaborCostRatio = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;
    const overallPerCapitaCost = totalHeadcount > 0 ? totalLaborCost / totalHeadcount : 0;

    // Overall 环比/同比 (computed from absolute differences)
    const overallMomLaborCost = prevOverviewItem ? totalLaborCost - prevOverviewItem.totalLaborCost : null;
    const overallYoyLaborCost = yoyOverviewItem ? totalLaborCost - yoyOverviewItem.totalLaborCost : null;
    const prevTotalHeadcount = prevOverviewItem
      ? (departments.filter((d) => d.month === prevMonthStr && d.department === '全公司')[0]?.headcount ??
         comparisonData.reduce((s, seg) => {
           const prev = departments.find((d) => d.department === seg.segment && d.month === prevMonthStr);
           return s + (prev?.headcount ?? 0);
         }, 0))
      : 0;
    const overallMomHeadcount = prevTotalHeadcount > 0 ? totalHeadcount - prevTotalHeadcount : null;
    const prevOverallPerCapita = prevTotalHeadcount > 0 && prevOverviewItem
      ? prevOverviewItem.totalLaborCost / prevTotalHeadcount : 0;
    const overallMomPerCapita = prevOverallPerCapita > 0
      ? overallPerCapitaCost - prevOverallPerCapita : null;
    const prevOverallRatio = prevOverviewItem?.laborCostRatio ?? null;
    const overallMomRatio = prevOverallRatio !== null
      ? overallLaborCostRatio - prevOverallRatio : null;

    // YoY for overall
    const yoyTotalHeadcount = yoyOverviewItem
      ? (departments.filter((d) => d.month === yoyMonthStr && d.department === '全公司')[0]?.headcount ??
         comparisonData.reduce((s, seg) => {
           const yoy = departments.find((d) => d.department === seg.segment && d.month === yoyMonthStr);
           return s + (yoy?.headcount ?? 0);
         }, 0))
      : 0;
    const overallYoyHeadcount = yoyTotalHeadcount > 0 ? totalHeadcount - yoyTotalHeadcount : null;
    const yoyOverallPerCapita = yoyTotalHeadcount > 0 && yoyOverviewItem
      ? yoyOverviewItem.totalLaborCost / yoyTotalHeadcount : 0;
    const overallYoyPerCapita = yoyOverallPerCapita > 0
      ? overallPerCapitaCost - yoyOverallPerCapita : null;
    const yoyOverallRatio = yoyOverviewItem?.laborCostRatio ?? null;
    const overallYoyRatio = yoyOverallRatio !== null
      ? overallLaborCostRatio - yoyOverallRatio : null;

    return (
      <ReportLayout
        title="总览 · 人力成本对比表"
        subtitle={`数据月份：${getMonthLabel(selectedReportMonth)}`}
      >
        {/* Month selector */}
        <div className="flex items-center gap-3">
          <Select value={selectedReportMonth} onValueChange={handleReportMonthChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {reportMonths.map((m) => (
                <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Comparison table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">各板块人力成本对比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  {/* Group header row */}
                  <TableRow>
                    <TableHead rowSpan={2} className="align-bottom min-w-[100px]">板块</TableHead>
                    <TableHead colSpan={3} className="text-center border-l">人数</TableHead>
                    <TableHead colSpan={3} className="text-center border-l">人力成本(万)</TableHead>
                    <TableHead colSpan={3} className="text-center border-l">人均成本(万)</TableHead>
                    <TableHead colSpan={3} className="text-center border-l">人力成本率</TableHead>
                  </TableRow>
                  {/* Sub header row */}
                  <TableRow>
                    <TableHead className="text-right border-l">本月</TableHead>
                    <TableHead className="text-right">环比</TableHead>
                    <TableHead className="text-right">同比</TableHead>
                    <TableHead className="text-right border-l">本月</TableHead>
                    <TableHead className="text-right">环比</TableHead>
                    <TableHead className="text-right">同比</TableHead>
                    <TableHead className="text-right border-l">本月</TableHead>
                    <TableHead className="text-right">环比</TableHead>
                    <TableHead className="text-right">同比</TableHead>
                    <TableHead className="text-right border-l">本月</TableHead>
                    <TableHead className="text-right">环比</TableHead>
                    <TableHead className="text-right">同比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((d) => (
                    <TableRow key={d.segment}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      {/* 人数 */}
                      <TableCell className="text-right border-l">{d.headcount}</TableCell>
                      <TableCell className={`text-right ${d.momHeadcount !== null && d.momHeadcount < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.momHeadcount !== null ? `${d.momHeadcount > 0 ? '+' : ''}${d.momHeadcount}` : '--'}
                      </TableCell>
                      <TableCell className={`text-right ${d.yoyHeadcount !== null && d.yoyHeadcount < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.yoyHeadcount !== null ? `${d.yoyHeadcount > 0 ? '+' : ''}${d.yoyHeadcount}` : '--'}
                      </TableCell>
                      {/* 人力成本 */}
                      <TableCell className="text-right border-l font-semibold">{safeNum(d.laborCost).toFixed(1)}</TableCell>
                      <TableCell className={`text-right ${d.momLaborCost !== null && d.momLaborCost < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.momLaborCost !== null ? `${d.momLaborCost > 0 ? '+' : ''}${safeNum(d.momLaborCost).toFixed(1)}` : '--'}
                      </TableCell>
                      <TableCell className={`text-right ${d.yoyLaborCost !== null && d.yoyLaborCost < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.yoyLaborCost !== null ? `${d.yoyLaborCost > 0 ? '+' : ''}${safeNum(d.yoyLaborCost).toFixed(1)}` : '--'}
                      </TableCell>
                      {/* 人均成本 */}
                      <TableCell className="text-right border-l">{d.perCapitaCost > 0 ? safeNum(d.perCapitaCost).toFixed(2) : '--'}</TableCell>
                      <TableCell className={`text-right ${d.momPerCapita !== null && d.momPerCapita < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.momPerCapita !== null ? `${d.momPerCapita > 0 ? '+' : ''}${safeNum(d.momPerCapita).toFixed(2)}` : '--'}
                      </TableCell>
                      <TableCell className={`text-right ${d.yoyPerCapita !== null && d.yoyPerCapita < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.yoyPerCapita !== null ? `${d.yoyPerCapita > 0 ? '+' : ''}${safeNum(d.yoyPerCapita).toFixed(2)}` : '--'}
                      </TableCell>
                      {/* 人力成本率 */}
                      <TableCell className="text-right border-l">{d.laborCostRatio > 0 ? safeNum(d.laborCostRatio).toFixed(1) : '--'}</TableCell>
                      <TableCell className={`text-right ${d.prevLaborCostRatio !== null && (d.laborCostRatio - d.prevLaborCostRatio) < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.prevLaborCostRatio !== null ? `${(d.laborCostRatio - d.prevLaborCostRatio) > 0 ? '+' : ''}${(d.laborCostRatio - d.prevLaborCostRatio).toFixed(1)}pp` : '--'}
                      </TableCell>
                      <TableCell className={`text-right ${d.yoyLaborCostRatio !== null && (d.laborCostRatio - d.yoyLaborCostRatio) < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.yoyLaborCostRatio !== null ? `${(d.laborCostRatio - d.yoyLaborCostRatio) > 0 ? '+' : ''}${(d.laborCostRatio - d.yoyLaborCostRatio).toFixed(1)}pp` : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-t-2 font-semibold bg-muted/30">
                    <TableCell>全公司</TableCell>
                    {/* 人数 */}
                    <TableCell className="text-right border-l">{totalHeadcount}</TableCell>
                    <TableCell className={`text-right ${overallMomHeadcount !== null && overallMomHeadcount < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallMomHeadcount !== null ? `${overallMomHeadcount > 0 ? '+' : ''}${overallMomHeadcount}` : '--'}
                    </TableCell>
                    <TableCell className={`text-right ${overallYoyHeadcount !== null && overallYoyHeadcount < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallYoyHeadcount !== null ? `${overallYoyHeadcount > 0 ? '+' : ''}${overallYoyHeadcount}` : '--'}
                    </TableCell>
                    {/* 人力成本 */}
                    <TableCell className="text-right border-l">{safeNum(totalLaborCost).toFixed(1)}</TableCell>
                    <TableCell className={`text-right ${overallMomLaborCost !== null && overallMomLaborCost < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallMomLaborCost !== null ? `${overallMomLaborCost > 0 ? '+' : ''}${safeNum(overallMomLaborCost).toFixed(1)}` : '--'}
                    </TableCell>
                    <TableCell className={`text-right ${overallYoyLaborCost !== null && overallYoyLaborCost < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallYoyLaborCost !== null ? `${overallYoyLaborCost > 0 ? '+' : ''}${safeNum(overallYoyLaborCost).toFixed(1)}` : '--'}
                    </TableCell>
                    {/* 人均成本 */}
                    <TableCell className="text-right border-l">{overallPerCapitaCost > 0 ? safeNum(overallPerCapitaCost).toFixed(2) : '--'}</TableCell>
                    <TableCell className={`text-right ${overallMomPerCapita !== null && overallMomPerCapita < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallMomPerCapita !== null ? `${overallMomPerCapita > 0 ? '+' : ''}${safeNum(overallMomPerCapita).toFixed(2)}` : '--'}
                    </TableCell>
                    <TableCell className={`text-right ${overallYoyPerCapita !== null && overallYoyPerCapita < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallYoyPerCapita !== null ? `${overallYoyPerCapita > 0 ? '+' : ''}${safeNum(overallYoyPerCapita).toFixed(2)}` : '--'}
                    </TableCell>
                    {/* 人力成本率 */}
                    <TableCell className="text-right border-l">{overallLaborCostRatio > 0 ? safeNum(overallLaborCostRatio).toFixed(1) : '--'}</TableCell>
                    <TableCell className={`text-right ${overallMomRatio !== null && overallMomRatio < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallMomRatio !== null ? `${overallMomRatio > 0 ? '+' : ''}${safeNum(overallMomRatio).toFixed(1)}pp` : '--'}
                    </TableCell>
                    <TableCell className={`text-right ${overallYoyRatio !== null && overallYoyRatio < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overallYoyRatio !== null ? `${overallYoyRatio > 0 ? '+' : ''}${safeNum(overallYoyRatio).toFixed(1)}pp` : '--'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Data source note */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>* 数据来源：部门数据（人数、人力成本、人均成本、人力成本率）+ 月度总览（全公司合计行）</p>
          <p>* 人数环比/同比为绝对增减人数；人力成本、人均成本环比/同比为绝对增减（万元）；人力成本率环比/同比为百分点变化(pp)</p>
        </div>
      </ReportLayout>
    );
  }

  return (
    <div className="p-8 text-center text-muted-foreground">
      未知报表类型
    </div>
  );
}

function ReportLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function KpiBox({ title, value, ratio, color }: { title: string; value: string; ratio?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tracking-tight ${color ?? ''}`}>{value}</div>
        {ratio && <div className="mt-1 text-sm text-muted-foreground">{ratio}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      暂无数据
    </div>
  );
}
