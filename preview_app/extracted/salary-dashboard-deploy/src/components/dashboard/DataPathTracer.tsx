import { useMemo } from 'react';
import { Database, Route as RouteIcon, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useDataBinding } from '@/contexts/DataBindingContext';
import { useData } from '@/contexts/DataContext';
import { resolveDataPath, type PathVariables, type DataSourceMap } from '@/utils/dataPathEngine';
import {
  dataTypeChineseLabels,
  aggregationLabels,
  filterOperatorLabels,
} from '@/types/dataBinding';
import type { DataType } from '@/types';
import type { DataPath } from '@/types/dataBinding';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

interface DataPathTracerProps {
  /** 指标键名，如 'totalLaborCost', 'headcount' */
  metricKey: string;
  /** 看板维度，如 '总览', '总部', '自营' */
  dimension: string;
  /** 当前选中月份（用于解析 ${selectedMonth}） */
  selectedMonth?: string;
  /** 查看模式 */
  viewMode?: 'current' | 'cumulative';
  /** 当前看板显示的实际值（用于一致性对比） */
  dashboardValue?: number | null;
  /** 是否显示为紧凑模式（仅图标） */
  compact?: boolean;
  /** 自定义数据源（传入派生后的数据，与看板展示一致） */
  customDataSources?: DataSourceMap;
}

/**
 * 数据取值路径追踪组件
 * 在 KPI / 图表旁显示数据来源标识，hover 可查看完整取值路径
 */
export function DataPathTracer({
  metricKey,
  dimension,
  selectedMonth,
  viewMode = 'current',
  dashboardValue,
  compact = false,
  customDataSources,
}: DataPathTracerProps) {
  const { paths, consistencyResults } = useDataBinding();
  const data = useData();

  // 查找匹配的数据路径
  const path = useMemo<DataPath | undefined>(() => {
    return paths.find(
      (p) => p.metricKey === metricKey && p.dimension === dimension && p.enabled
    );
  }, [paths, metricKey, dimension]);

  // 构建变量上下文
  const vars: PathVariables = useMemo(() => ({
    selectedMonth: selectedMonth || '',
    viewMode,
  }), [selectedMonth, viewMode]);

  // 构建数据源集合：优先使用外部传入的派生数据，否则使用原始数据
  const dataSources: DataSourceMap = useMemo<DataSourceMap>(() => {
    if (customDataSources) return customDataSources;
    return {
      overview: data.overviews as unknown as Record<string, unknown>[],
      department: data.departments as unknown as Record<string, unknown>[],
      composition: data.compositions as unknown as Record<string, unknown>[],
      position: data.positions as unknown as Record<string, unknown>[],
      store: data.stores as unknown as Record<string, unknown>[],
      budget: data.budgets as unknown as Record<string, unknown>[],
      costStructure: data.costStructures as unknown as Record<string, unknown>[],
    };
  }, [data, customDataSources]);

  // 解析路径
  const resolution = useMemo(() => {
    if (!path) return null;
    return resolveDataPath(path, dataSources, vars);
  }, [path, dataSources, vars]);

  // 查找一致性校验结果
  const consistency = useMemo(() => {
    if (!path) return null;
    return consistencyResults.find((r) => r.pathId === path.id);
  }, [consistencyResults, path]);

  if (!path) {
    // 无匹配路径时不显示
    return null;
  }

  const sourceLabel = dataTypeChineseLabels[path.sourceType as DataType] ?? path.sourceType;
  const aggLabel = aggregationLabels[path.aggregation];
  const isConsistent = consistency?.status === 'consistent';
  const isInconsistent = consistency?.status === 'inconsistent';

  // 状态图标组件
  const StatusIcon = consistency
    ? isConsistent
      ? CheckCircle2
      : isInconsistent
      ? AlertTriangle
      : XCircle
    : undefined;

  const statusColor = consistency
    ? isConsistent
      ? 'text-green-500'
      : isInconsistent
      ? 'text-orange-500'
      : 'text-muted-foreground'
    : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-blue-500 hover:bg-blue-500/10 transition-colors cursor-help"
          aria-label="查看数据取值路径"
        >
          {compact ? (
            <Database className="h-3 w-3" />
          ) : (
            <>
              <RouteIcon className="h-3 w-3" />
              <span className="text-[10px]">{sourceLabel}</span>
            </>
          )}
          {StatusIcon && <StatusIcon className={`h-3 w-3 ${statusColor}`} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-md">
        <div className="space-y-2 p-1">
          {/* 标题 */}
          <div className="flex items-center gap-1.5 border-b border-background/20 pb-1.5">
            <Database className="h-3.5 w-3.5" />
            <span className="font-semibold">数据取值路径</span>
            <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
              {path.metricLabel}
            </Badge>
          </div>

          {/* 路径详情 */}
          <div className="space-y-1 text-[11px]">
            <div className="flex gap-2">
              <span className="text-background/60 min-w-[60px]">数据源</span>
              <span className="font-medium">{sourceLabel}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-background/60 min-w-[60px]">字段</span>
              <span className="font-mono">{path.sourceField}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-background/60 min-w-[60px]">聚合</span>
              <span>{aggLabel}</span>
            </div>
            {path.derivedFormula && (
              <div className="flex gap-2">
                <span className="text-background/60 min-w-[60px]">公式</span>
                <span className="font-mono text-green-300">{path.derivedFormula}</span>
              </div>
            )}
          </div>

          {/* 过滤条件 */}
          {path.filters.length > 0 && (
            <div className="space-y-1 border-t border-background/20 pt-1.5">
              <div className="text-[11px] text-background/60">过滤条件</div>
              {path.filters.map((f) => (
                <div key={f.id} className="flex items-center gap-1 text-[11px]">
                  <span className="font-mono">{f.field}</span>
                  <span className="text-background/60">{filterOperatorLabels[f.operator]}</span>
                  <span className="font-mono text-yellow-200">
                    {f.value.includes('${')
                      ? f.value.replace('${selectedMonth}', selectedMonth || '?')
                      : f.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 解析结果 */}
          {resolution && (
            <div className="border-t border-background/20 pt-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-background/60">匹配记录</span>
                <span className="font-mono">{resolution.matchedRecords} 条</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-background/60">路径解析值</span>
                <span className="font-mono">
                  {resolution.resolvedValue !== null
                    ? safeNum(resolution.resolvedValue).toFixed(2)
                    : '— 无数据'}
                </span>
              </div>
              {dashboardValue !== undefined && dashboardValue !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-background/60">看板显示值</span>
                  <span className="font-mono">{safeNum(dashboardValue).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* 一致性状态 */}
          {consistency && (
            <div className={`border-t border-background/20 pt-1.5 text-[11px] ${statusColor}`}>
              <div className="flex items-center gap-1 font-semibold">
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                {consistency.status === 'consistent' && '数据一致'}
                {consistency.status === 'inconsistent' && '数据不一致'}
                {consistency.status === 'no_data' && '无数据'}
                {consistency.status === 'error' && '校验错误'}
              </div>
              {consistency.difference !== null && (
                <div className="mt-0.5">
                  差值: {safeNum(consistency.difference).toFixed(2)}
                  {consistency.differencePercent !== null && ` (${safeNum(consistency.differencePercent).toFixed(2)}%)`}
                </div>
              )}
            </div>
          )}

          {/* 描述 */}
          {path.description && (
            <div className="border-t border-background/20 pt-1.5 text-[10px] text-background/50">
              {path.description}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 紧凑版数据路径标识，用于在空间受限的场景
 */
export function DataPathBadge({ metricKey, dimension }: { metricKey: string; dimension: string }) {
  return (
    <DataPathTracer
      metricKey={metricKey}
      dimension={dimension}
      compact
    />
  );
}
