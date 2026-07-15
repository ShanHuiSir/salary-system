import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendIndicator } from './TrendIndicator';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendSuffix?: string;
  trendDecimals?: number;
  reverseTrend?: boolean;
  yoyTrend?: number;
  yoySubtitle?: string;
  yoyTrendSuffix?: string;
  yoyTrendDecimals?: number;
  icon?: React.ReactNode;
  /** 数据取值路径追踪组件 */
  tracer?: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendSuffix = '%',
  trendDecimals = 2,
  reverseTrend = false,
  yoyTrend,
  yoySubtitle = '同比',
  yoyTrendSuffix = '%',
  yoyTrendDecimals = 2,
  icon,
  tracer,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {tracer}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {trend !== undefined && (
            <span className="inline-flex items-center gap-1">
              <TrendIndicator value={trend} suffix={trendSuffix} reverse={reverseTrend} decimals={trendDecimals} />
              {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
            </span>
          )}
          {yoyTrend !== undefined && (
            <span className="inline-flex items-center gap-1">
              <TrendIndicator value={yoyTrend} suffix={yoyTrendSuffix} reverse={reverseTrend} decimals={yoyTrendDecimals} />
              <span className="text-muted-foreground">{yoySubtitle}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
