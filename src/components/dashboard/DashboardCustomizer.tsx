import { useState, useEffect, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const LAYOUT_KEY = 'salary-dashboard-layout';

export interface BlockConfig {
  id: string;
  title: string;
  visible: boolean;
}

const DEFAULT_BLOCKS: BlockConfig[] = [
  { id: 'kpi-cards', title: 'KPI 指标卡', visible: true },
  { id: 'revenue-channels', title: '渠道业绩明细', visible: true },
  { id: 'segment-overview', title: '四大板块概况', visible: true },
  { id: 'budget-usage', title: '人力成本预算使用率', visible: true },
  { id: 'cost-structure', title: '人力成本组成结构', visible: true },
  { id: 'chart-trend', title: '业绩与人力成本趋势', visible: true },
  { id: 'chart-composition', title: '成本构成与部门对比', visible: true },
  { id: 'analysis-panel', title: '数据分析面板', visible: true },
];

function loadLayout(): BlockConfig[] {
  if (typeof window === 'undefined') return DEFAULT_BLOCKS;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_BLOCKS;
    const stored = JSON.parse(raw) as BlockConfig[];
    // Merge with defaults to handle new blocks
    const result = [...DEFAULT_BLOCKS];
    stored.forEach((s) => {
      const idx = result.findIndex((d) => d.id === s.id);
      if (idx !== -1) {
        result[idx] = { ...result[idx], ...s };
      }
    });
    // Sort by stored order
    const order = stored.map((s) => s.id);
    result.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return result;
  } catch {
    return DEFAULT_BLOCKS;
  }
}

function saveLayout(blocks: BlockConfig[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(blocks));
  } catch {
    // ignore
  }
}

export function useDashboardLayout() {
  const [blocks, setBlocks] = useState<BlockConfig[]>(() => loadLayout());

  useEffect(() => {
    saveLayout(blocks);
  }, [blocks]);

  const moveUp = useCallback((id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b))
    );
  }, []);

  const reset = useCallback(() => {
    setBlocks(DEFAULT_BLOCKS);
  }, []);

  const getOrder = useCallback(() => {
    return blocks.filter((b) => b.visible).map((b) => b.id);
  }, [blocks]);

  const isVisible = useCallback((id: string) => {
    return blocks.find((b) => b.id === id)?.visible ?? true;
  }, [blocks]);

  return { blocks, moveUp, moveDown, toggleVisible, reset, getOrder, isVisible };
}

export function DashboardCustomizer({
  open,
  onOpenChange,
  blocks,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: BlockConfig[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            自定义看板排版
          </DialogTitle>
          <DialogDescription>
            拖动或点击箭头调整内容区块的显示顺序，点击眼睛图标控制显示/隐藏。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                block.visible ? 'bg-card' : 'bg-muted/30 opacity-60'
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-sm font-medium">{block.title}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMoveUp(block.id)}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMoveDown(block.id)}
                  disabled={index === blocks.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggleVisible(block.id)}
                >
                  {block.visible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            恢复默认
          </Button>
          <Badge variant="secondary" className="text-xs">
            {blocks.filter((b) => b.visible).length} / {blocks.length} 显示中
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
