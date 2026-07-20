import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { loadClientState, saveClientState } from '@/lib/api';

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

function mergeLayout(stored?: BlockConfig[] | null): BlockConfig[] {
  if (!stored) return DEFAULT_BLOCKS;
  const result = [...DEFAULT_BLOCKS];
  stored.forEach((item) => {
    const index = result.findIndex((defaultItem) => defaultItem.id === item.id);
    if (index !== -1) result[index] = { ...result[index], ...item };
  });

  const order = stored.map((item) => item.id);
  result.sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  return result;
}

export function useDashboardLayout() {
  const [blocks, setBlocks] = useState<BlockConfig[]>(DEFAULT_BLOCKS);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadClientState<BlockConfig[]>(LAYOUT_KEY)
      .then((serverLayout) => {
        if (!cancelled) setBlocks(mergeLayout(serverLayout));
      })
      .catch((error) => console.error('[DashboardLayout] 加载服务器配置失败:', error))
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveClientState(LAYOUT_KEY, blocks).catch((error) => console.error('[DashboardLayout] 保存服务器配置失败:', error));
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
