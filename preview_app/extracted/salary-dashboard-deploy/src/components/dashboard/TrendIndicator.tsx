import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

interface TrendIndicatorProps {
  value: number;
  suffix?: string;
  reverse?: boolean;
  prefixValue?: number;
  valueUnit?: string;
  decimals?: number;
}

export function TrendIndicator({ value, suffix = '%', reverse = false, prefixValue, valueUnit, decimals = 2 }: TrendIndicatorProps) {
  const positive = value >= 0;
  const isGood = reverse ? !positive : positive;

  if (value === 0 && (prefixValue === undefined || prefixValue === 0)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        0{suffix}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-sm font-medium',
        isGood ? 'text-emerald-600' : 'text-red-600'
      )}
    >
      {positive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {prefixValue !== undefined && (
        <>
          {prefixValue > 0 && '+'}
          {safeNum(prefixValue).toFixed(1)}
          {valueUnit ? `${valueUnit} / ` : ' / '}
        </>
      )}
      {value > 0 && '+'}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
