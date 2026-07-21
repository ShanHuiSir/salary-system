import { TrendingUp, TrendingDown, AlertTriangle, Info, Minus, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SegmentAnalysis, AnalysisType } from '@/utils/analysisEngine';

const ANALYSIS_CONFIG: Record<
  AnalysisType,
  { icon: typeof TrendingUp; color: string; bgColor: string; borderColor: string; label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  positive: {
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: '利好',
    badgeVariant: 'secondary',
  },
  negative: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: '不利',
    badgeVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: '预警',
    badgeVariant: 'destructive',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: '提示',
    badgeVariant: 'secondary',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
    label: '持平',
    badgeVariant: 'outline',
  },
};

interface AnalysisPanelProps {
  analysis: SegmentAnalysis;
  title?: string;
}

export function AnalysisPanel({ analysis, title }: AnalysisPanelProps) {
  const positiveCount = analysis.items.filter((i) => i.type === 'positive').length;
  const warningCount = analysis.items.filter((i) => i.type === 'warning').length;
  const negativeCount = analysis.items.filter((i) => i.type === 'negative').length;
  const infoCount = analysis.items.filter((i) => i.type === 'info').length;

  const headerTitle = title ?? `${analysis.dimension}数据分析`;

  return (
    <Card className="min-w-0 overflow-hidden border-l-4 border-l-primary/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="break-words text-base">{headerTitle}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {positiveCount > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                利好 {positiveCount}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="destructive" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                预警 {warningCount}
              </Badge>
            )}
            {negativeCount > 0 && (
              <Badge variant="destructive">
                不利 {negativeCount}
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="outline">
                提示 {infoCount}
              </Badge>
            )}
          </div>
        </div>
        <p className="mt-1 break-words text-sm text-muted-foreground">{analysis.summary}</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[min(60vh,420px)] overflow-y-auto pr-1">
          <div className="space-y-3 pr-3">
            {analysis.items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                暂无分析数据
              </div>
            ) : (
              analysis.items.map((item, index) => {
                const config = ANALYSIS_CONFIG[item.type];
                const Icon = config.icon;
                return (
                  <div
                    key={index}
                    className={`flex min-w-0 gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}
                  >
                    <div className={`mt-0.5 shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-medium">{item.title}</span>
                        <Badge variant={config.badgeVariant} className="text-[10px] px-1 py-0 h-4">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="break-words text-sm leading-relaxed text-muted-foreground">
                        {item.content}
                      </p>
                      {item.detail && (
                        <p className="break-words text-xs italic text-muted-foreground/80">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
