import { useState, useEffect, useCallback, useRef } from 'react';
import { loadClientState, saveClientState } from '@/lib/api';

const LAYOUT_KEY = 'salary-dashboard-layout';

export type BlockWidth = 4 | 6 | 8 | 12;

export interface BlockConfig {
  id: string;
  title: string;
  visible: boolean;
  width: BlockWidth;
}

const DEFAULT_BLOCKS: BlockConfig[] = [
  { id: 'kpi-cards', title: 'KPI 指标卡', visible: true, width: 12 },
  { id: 'revenue-channels', title: '渠道业绩明细', visible: true, width: 12 },
  { id: 'segment-overview', title: '四大板块概况', visible: true, width: 12 },
  { id: 'budget-usage', title: '人力成本预算使用率', visible: true, width: 12 },
  { id: 'cost-structure', title: '人力成本组成结构', visible: true, width: 12 },
  { id: 'chart-trend', title: '业绩与人力成本趋势', visible: true, width: 12 },
  { id: 'chart-composition', title: '成本构成与部门对比', visible: true, width: 12 },
  { id: 'analysis-panel', title: '数据分析面板', visible: true, width: 12 },
];

type LayoutUpdate = (blocks: BlockConfig[]) => BlockConfig[];

function normalizeWidth(width?: number): BlockWidth {
  if (width === 4 || width === 6 || width === 8 || width === 12) return width;
  return 12;
}

function mergeLayout(stored?: BlockConfig[] | null): BlockConfig[] {
  if (!stored) return DEFAULT_BLOCKS;
  const result = [...DEFAULT_BLOCKS];
  stored.forEach((item) => {
    const index = result.findIndex((defaultItem) => defaultItem.id === item.id);
    if (index !== -1) result[index] = { ...result[index], ...item, width: normalizeWidth(item.width) };
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
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const queuedUpdatesRef = useRef<LayoutUpdate[]>([]);

  const updateBlocks = useCallback((update: LayoutUpdate) => {
    // 服务器布局尚未返回时，先即时响应用户操作，并记录操作以便随后重放。
    if (!hydratedRef.current) queuedUpdatesRef.current.push(update);
    setBlocks(update);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadClientState<BlockConfig[]>(LAYOUT_KEY)
      .then((serverLayout) => {
        if (cancelled) return;
        const queuedUpdates = queuedUpdatesRef.current;
        queuedUpdatesRef.current = [];
        setBlocks(() => queuedUpdates.reduce((layout, update) => update(layout), mergeLayout(serverLayout)));
      })
      .catch((error) => console.error('[DashboardLayout] 加载服务器配置失败:', error))
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveClientState(LAYOUT_KEY, blocks).catch((error) => console.error('[DashboardLayout] 保存服务器配置失败:', error));
  }, [blocks, hydrated]);

  const moveUp = useCallback((id: string) => {
    updateBlocks((prev) => {
      const idx = prev.findIndex((block) => block.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, [updateBlocks]);

  const moveDown = useCallback((id: string) => {
    updateBlocks((prev) => {
      const idx = prev.findIndex((block) => block.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, [updateBlocks]);

  const moveTo = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    updateBlocks((prev) => {
      const fromIndex = prev.findIndex((block) => block.id === draggedId);
      const toIndex = prev.findIndex((block) => block.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [draggedBlock] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedBlock);
      return next;
    });
  }, [updateBlocks]);

  const toggleVisible = useCallback((id: string) => {
    updateBlocks((prev) => prev.map((block) => block.id === id ? { ...block, visible: !block.visible } : block));
  }, [updateBlocks]);

  const setWidth = useCallback((id: string, width: BlockWidth) => {
    updateBlocks((prev) => prev.map((block) => block.id === id ? { ...block, width } : block));
  }, [updateBlocks]);

  const reset = useCallback(() => updateBlocks(() => DEFAULT_BLOCKS), [updateBlocks]);
  const getOrder = useCallback(() => blocks.filter((block) => block.visible).map((block) => block.id), [blocks]);
  const isVisible = useCallback((id: string) => blocks.find((block) => block.id === id)?.visible ?? true, [blocks]);
  const getOrderIndex = useCallback((id: string) => {
    const index = blocks.findIndex((block) => block.id === id);
    return index === -1 ? blocks.length : index;
  }, [blocks]);
  const getWidth = useCallback((id: string) => blocks.find((block) => block.id === id)?.width ?? 12, [blocks]);

  return { blocks, moveUp, moveDown, moveTo, toggleVisible, setWidth, reset, getOrder, getOrderIndex, getWidth, isVisible };
}
