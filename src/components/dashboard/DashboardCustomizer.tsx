import { useState } from 'react';
import type { DragEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  PanelRightClose,
  RotateCcw,
  Settings2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BlockConfig, BlockWidth } from './useDashboardLayout';

const WIDTH_OPTIONS: { label: string; value: BlockWidth }[] = [
  { label: '整行', value: 12 },
  { label: '2/3', value: 8 },
  { label: '1/2', value: 6 },
  { label: '1/3', value: 4 },
];

export function DashboardCustomizer({
  open,
  onOpenChange,
  blocks,
  onMoveUp,
  onMoveDown,
  onMoveTo,
  onToggleVisible,
  onWidthChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: BlockConfig[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveTo: (draggedId: string, targetId: string) => void;
  onToggleVisible: (id: string) => void;
  onWidthChange: (id: string, width: BlockWidth) => void;
  onReset: () => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || draggingId;
    if (draggedId) onMoveTo(draggedId, targetId);
    setDraggingId(null);
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="关闭页面优化侧栏遮罩"
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
        onClick={() => onOpenChange(false)}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,380px)] flex-col border-l bg-background shadow-2xl lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:h-[calc(100vh-9rem)] lg:w-80 lg:shrink-0 lg:rounded-xl lg:border lg:shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Settings2 className="h-5 w-5" />
                页面优化侧栏
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                拖动模块调顺序，切换显示状态，并设置每个模块宽度。
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 lg:hidden" />
              <PanelRightClose className="hidden h-4 w-4 lg:block" />
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-4">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={(event) => handleDragStart(event, block.id)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, block.id)}
                onDragEnd={() => setDraggingId(null)}
                aria-grabbed={draggingId === block.id}
                className={cn(
                  'cursor-grab rounded-lg border p-3 transition-colors active:cursor-grabbing',
                  block.visible ? 'bg-card' : 'bg-muted/30 opacity-60',
                  draggingId === block.id && 'border-primary bg-primary/5 opacity-80'
                )}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">{block.title}</div>
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

                <div className="mt-3 grid grid-cols-4 gap-1">
                  {WIDTH_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={block.width === option.value ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-1 text-xs"
                      onClick={() => onWidthChange(block.id, option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>排序：{index + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onMoveUp(block.id)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onMoveDown(block.id)}
                      disabled={index === blocks.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t p-4">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            恢复默认
          </Button>
          <Badge variant="secondary" className="text-xs">
            {blocks.filter((block) => block.visible).length} / {blocks.length} 显示中
          </Badge>
        </div>
      </aside>
    </>
  );
}
