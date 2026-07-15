import { TrendIndicator } from './TrendIndicator';
import { Users, AlertTriangle, TrendingUp, TrendingDown, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

export interface SegmentAnalysisHint {
  /** 分析标题 */
  title: string;
  /** 分析内容 */
  content: string;
  /** 类型: positive(利好) / warning(警示) / negative(不利) / info(中性) */
  type: 'positive' | 'warning' | 'negative' | 'info' | 'neutral';
}

interface SegmentOverviewCardProps {
  title: string;
  headcount: number;
  laborCost: number;
  totalCost: number;
  revenue?: number;
  momValue: number;
  momPct: number;
  yoyValue: number;
  yoyPct: number;
  comment: string;
  variant?: 'default' | 'warning';
  cumulativeMode?: boolean;
  /** 数据来源标识（hover 显示完整路径） */
  dataSource?: string;
  /** 动态分析项（来自 analysisEngine） */
  analysisItems?: SegmentAnalysisHint[];
}

export function SegmentOverviewCard({
  title,
  headcount,
  laborCost,
  totalCost,
  revenue,
  momValue,
  momPct,
  yoyValue,
  yoyPct,
  comment,
  variant = 'default',
  cumulativeMode = false,
  dataSource,
  analysisItems = [],
}: SegmentOverviewCardProps) {
  const share = totalCost > 0 ? (laborCost / totalCost) * 100 : 0;
  const costToRevenueRatio = revenue && revenue > 0 ? (laborCost / revenue) * 100 : undefined;

  // 分析项类型样式
  const typeStyles: Record<SegmentAnalysisHint['type'], string> = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    negative: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  const typeBadge: Record<SegmentAnalysisHint['type'], string> = {
    positive: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    negative: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    neutral: 'bg-slate-100 text-slate-700',
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all',
        'hover:shadow-md',
        variant === 'warning' && 'border-l-4 border-l-red-500'
      )}
    >
      {/* 标题区：板块名 + 异常标签 + 数据源标识 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
          {variant === 'warning' && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3 w-3" />
              异常
            </span>
          )}
          {dataSource && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Database className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-semibold">数据来源</p>
                  <p className="mt-1 text-muted-foreground">{dataSource}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {headcount}人
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        占总成本 {safeNum(share).toFixed(1)}%
        {costToRevenueRatio !== undefined && (
          <span className="ml-2">
            · 人均人力成本{' '}
            <span className="font-semibold text-foreground">
              {headcount > 0 ? (laborCost / headcount).toFixed(2) : '--'}万
            </span>
          </span>
        )}
      </p>

      <div>
        <p className="text-xs text-muted-foreground">人力成本 · 万元</p>
        <p className="text-4xl font-bold tracking-tight text-card-foreground">{safeNum(laborCost).toFixed(1)}</p>
      </div>

      {costToRevenueRatio !== undefined && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium',
              costToRevenueRatio > 80 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            )}
          >
            占产值比{safeNum(costToRevenueRatio).toFixed(2)}%
          </span>
          {costToRevenueRatio > 80 && (
            <span className="text-xs text-red-600">⚠ 异常</span>
          )}
        </div>
      )}

      {/* 环比 / 同比 */}
      <div className="space-y-2 pt-2">
        {!cumulativeMode && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">环比</span>
            <TrendIndicator value={momPct} prefixValue={momValue} valueUnit="万" />
            {momValue !== 0 && (
              <span className="ml-auto text-xs">
                {momValue > 0 ? (
                  <TrendingUp className={cn('h-3.5 w-3.5', momPct < 0 ? 'text-emerald-600' : 'text-red-600')} />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">同比</span>
          <TrendIndicator value={yoyPct} prefixValue={yoyValue} valueUnit="万" />
          {yoyValue !== 0 && (
            <span className="ml-auto text-xs">
              {yoyValue > 0 ? (
                <TrendingUp className={cn('h-3.5 w-3.5', yoyPct < 0 ? 'text-emerald-600' : 'text-red-600')} />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* 动态分析项：来自 analysisEngine */}
      {analysisItems.length > 0 && (
        <div className="space-y-2">
          {analysisItems.slice(0, 3).map((item, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-md border px-3 py-2 text-xs leading-relaxed',
                typeStyles[item.type]
              )}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <Badge variant="secondary" className={cn('h-4 px-1.5 text-[10px] font-medium', typeBadge[item.type])}>
                  {item.type === 'positive' && '利好'}
                  {item.type === 'warning' && '关注'}
                  {item.type === 'negative' && '风险'}
                  {item.type === 'info' && '提示'}
                  {item.type === 'neutral' && '中性'}
                </Badge>
                <span className="font-semibold">{item.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      <p className={cn('mt-auto text-xs leading-relaxed', variant === 'warning' ? 'text-red-600' : 'text-muted-foreground')}>
        {comment}
      </p>

      {variant === 'warning' && (
        <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          需要优先纳入经营会追问。
        </div>
      )}
    </div>
  );
}
