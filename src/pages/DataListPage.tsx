import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, RotateCcw, Upload, Settings2, Trash, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useFieldConfig } from '@/contexts/FieldConfigContext';
import { useToast } from '@/hooks/use-toast';
import { ImportDialog } from '@/components/data/ImportDialog';
import { FieldConfigDialog } from '@/components/data/FieldConfigDialog';
import { getListVisibleFields } from '@/types/fieldConfig';
import { computeFormulaFields } from '@/utils/formulaEngine';
import type { DataType } from '@/types';
import type { FieldDef } from '@/types/fieldConfig';
import { getDeptSortIndex } from '@/types';
import type { AuthUser } from '@/lib/api';
import {
  canClearAllData,
  canDeleteDataType,
  canManageFieldConfig,
  canResetData,
  canWriteDataType,
  getReadableDataTypes,
} from '@/lib/permissions';

const dataTypeLabels: Record<DataType, string> = {
  overview: '月度总览',
  department: '部门数据',
  composition: '成本构成',
  position: '职级数据',
  store: '门店/区域数据',
  budget: '预算人力成本',
  costStructure: '人力成本组成',
};

function formatFieldValue(value: unknown, field: FieldDef): string {
  if (value === undefined || value === null) return '--';
  if (field.type === 'number' || field.type === 'formula') {
    const n = typeof value === 'string' ? parseFloat(value) : value as number;
    if (Number.isNaN(n)) return String(value);
    const suffix = field.suffix ? ` ${field.suffix}` : '';
    const precision = field.type === 'formula' && field.formula?.precision ? field.formula.precision : 2;
    return `${n.toFixed(precision)}${suffix}`;
  }
  if (field.type === 'enum') {
    return String(value);
  }
  return String(value);
}

export function DataListPage({ user }: { user: AuthUser }) {
  const [activeType, setActiveType] = useState<DataType>('overview');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [fieldConfigOpen, setFieldConfigOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    overviews,
    departments,
    compositions,
    positions,
    stores,
    hqBusinessLines,
    hqDepts,
    platforms,
    budgets,
    costStructures,
    deleteItem,
    resetData,
    clearSourceData,
    operationLogs,
  } = useData();
  const { getFields } = useFieldConfig();

  const readableDataTypes = useMemo(() => getReadableDataTypes(user), [user]);
  const canEditActiveType = canWriteDataType(user, activeType);
  const canDeleteActiveType = canDeleteDataType(user, activeType);
  const canManageFields = canManageFieldConfig(user);
  const canResetAll = canResetData(user);
  const canClearAll = canClearAllData(user);

  useEffect(() => {
    if (readableDataTypes.length > 0 && !readableDataTypes.includes(activeType)) {
      setActiveType(readableDataTypes[0]);
    }
  }, [activeType, readableDataTypes]);

  const listFields = useMemo(() => getListVisibleFields(getFields(activeType)), [activeType, getFields]);
  const allFieldsForDataType = useMemo(() => getFields(activeType), [activeType, getFields]);

  const data = useMemo(() => {
    switch (activeType) {
      case 'overview':
        return overviews;
      case 'department':
        return [...departments].sort(
          (a, b) => b.month.localeCompare(a.month) || getDeptSortIndex(a.department) - getDeptSortIndex(b.department)
        );
      case 'composition':
        return [...compositions].sort(
          (a, b) => b.month.localeCompare(a.month) || getDeptSortIndex(a.department) - getDeptSortIndex(b.department)
        );
      case 'position':
        return [...positions].sort(
          (a, b) => b.month.localeCompare(a.month) || getDeptSortIndex(a.department) - getDeptSortIndex(b.department)
        );
      case 'store':
        return stores;
      case 'budget':
        return [...budgets].sort(
          (a, b) => b.month.localeCompare(a.month) || getDeptSortIndex(a.segment) - getDeptSortIndex(b.segment)
        );
      case 'costStructure':
        return [...costStructures].sort(
          (a, b) => b.month.localeCompare(a.month) || getDeptSortIndex(a.segment) - getDeptSortIndex(b.segment)
        );
    }
  }, [activeType, overviews, departments, compositions, positions, stores, budgets, costStructures]);

  // 为每一行数据计算公式字段值
  const dataWithFormulas = useMemo(() => {
    return data.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const formulaResults = computeFormulaFields(r, allFieldsForDataType);
      return { ...r, ...formulaResults } as Record<string, unknown>;
    });
  }, [data, allFieldsForDataType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dataWithFormulas;
    return dataWithFormulas.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [dataWithFormulas, search]);

  const handleDelete = async () => {
    if (deleteId) {
      try {
        await deleteItem(activeType, deleteId);
        toast({ title: '删除成功' });
        setDeleteId(null);
      } catch (error) {
        toast({
          title: '删除失败',
          description: error instanceof Error ? error.message : '服务器数据删除失败',
          variant: 'destructive',
        });
      }
    }
  };

  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  // 计算当前所有源数据总条数
  const totalSourceRecords = useMemo(() => {
    return overviews.length + departments.length + compositions.length +
      positions.length + stores.length + budgets.length + costStructures.length +
      hqBusinessLines.length + hqDepts.length + platforms.length;
  }, [overviews, departments, compositions, positions, stores, budgets, costStructures, hqBusinessLines, hqDepts, platforms]);

  const handleReset = async () => {
    try {
      await resetData();
      toast({ title: '数据已恢复初始状态' });
      setResetOpen(false);
    } catch (error) {
      toast({
        title: '恢复失败',
        description: error instanceof Error ? error.message : '服务器数据重置失败',
        variant: 'destructive',
      });
    }
  };

  const handleClearSourceData = async () => {
    try {
      const result = await clearSourceData();
      toast({
        title: '源数据已清空',
        description: `共清空 ${result.clearedCount} 条记录，涉及 ${result.clearedTypes.length} 类数据。字段配置和系统设置不受影响。`,
      });
      setClearOpen(false);
      setClearConfirmText('');
    } catch (error) {
      toast({
        title: '清空失败',
        description: error instanceof Error ? error.message : '服务器数据清空失败',
        variant: 'destructive',
      });
    }
  };

  const actions = (id: string) => (
    <div className="flex items-center justify-end gap-2">
      {canEditActiveType && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/data/${activeType}/${id}`)}
          aria-label="编辑"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {canDeleteActiveType && (
        <AlertDialog open={deleteId === id} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(id)}
              aria-label="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除？</AlertDialogTitle>
              <AlertDialogDescription>删除后无法恢复，请确认是否继续。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {!canEditActiveType && !canDeleteActiveType && <span className="text-xs text-muted-foreground">只读</span>}
    </div>
  );
  const renderCell = (row: Record<string, unknown>, field: FieldDef) => {
    const value = row[field.key];
    if (field.type === 'formula') {
      // 公式字段特殊显示
      if (value === null || value === undefined) {
        return <span className="text-red-500 text-xs">计算失败</span>;
      }
      const displayValue = formatFieldValue(value, field);
      // 预算使用率：超100%红色预警，80-100%橙色提示，80%以下绿色正常
      if (field.key === 'usageRate') {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        const isOverBudget = numValue > 100;
        const isNearBudget = numValue > 80 && numValue <= 100;
        const colorClass = isOverBudget
          ? 'text-red-600 dark:text-red-400 font-semibold'
          : isNearBudget
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-green-600 dark:text-green-400';
        return (
          <div className="flex items-center gap-1">
            <Badge variant="default" className={`text-xs px-1 py-0 ${isOverBudget ? 'bg-red-500/10 text-red-600 border-red-500/20' : isNearBudget ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}>
              =ƒ
            </Badge>
            <span className={colorClass}>{displayValue}</span>
            {isOverBudget && <span className="text-red-500 text-xs">⚠</span>}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1">
          <Badge variant="default" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 px-1 py-0">
            =ƒ
          </Badge>
          <span className="text-blue-700 dark:text-blue-300">{displayValue}</span>
        </div>
      );
    }
    if (field.type === 'enum' && value) {
      return <Badge variant="outline">{String(value)}</Badge>;
    }
    return formatFieldValue(value, field);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">数据管理</h2>
          <p className="text-sm text-muted-foreground">管理薪酬分析相关的月度、部门、职级、门店数据</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            操作日志
            {operationLogs.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {operationLogs.length}
              </Badge>
            )}
          </Button>
          {canResetAll && <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                恢复初始数据
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认恢复初始数据？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将清除所有已编辑的数据，恢复为系统初始的模拟数据，无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  确认恢复
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}

          {/* 一键清空源数据 */}
          {canClearAll && <AlertDialog open={clearOpen} onOpenChange={(open) => { setClearOpen(open); if (!open) setClearConfirmText(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30">
                <Trash className="mr-2 h-4 w-4" />
                清空源数据
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash className="h-5 w-5 text-destructive" />
                  确认清空全部源数据？
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-left pt-2">
                  <span className="block">此操作将永久删除以下业务数据，<strong className="text-destructive">不可撤销</strong>：</span>
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Trash className="h-3.5 w-3.5 text-destructive" />
                      <span>当前源数据共 <strong>{totalSourceRecords}</strong> 条记录</span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-5">
                      月度总览、部门数据、成本构成、职级数据、门店/区域数据、预算人力成本、人力成本组成、总部业务线、总部部门、平台数据
                    </div>
                  </div>
                  <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600">以下内容不受影响：</span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-5">
                      字段配置（自定义字段、公式定义）、登录状态、系统设置
                    </div>
                  </div>
                  <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="text-xs text-muted-foreground">
                      清空后可通过「恢复初始数据」重新加载模拟数据，或通过「批量导入」导入新数据。
                    </div>
                  </div>
                  <span className="block text-sm pt-1">请输入 <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">确认清空</code> 以继续：</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="请输入「确认清空」"
                className="font-mono"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearSourceData}
                  disabled={clearConfirmText !== '确认清空'}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}

          {(canManageFields || canEditActiveType) && <div className="w-px h-6 bg-border mx-1 hidden sm:block" />}
          {canManageFields && (
            <Button variant="outline" size="sm" onClick={() => setFieldConfigOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              字段配置
            </Button>
          )}
          {canEditActiveType && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                批量导入
              </Button>
              <Button onClick={() => navigate(`/data/${activeType}/new`)}>
                <Plus className="mr-2 h-4 w-4" />
                新增
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as DataType)} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          {readableDataTypes.map((key) => (
            <TabsTrigger key={key} value={key}>
              {dataTypeLabels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="min-w-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{dataTypeLabels[activeType]}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索任意字段..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[calc(100vh-300px)] w-full max-w-full overflow-auto rounded-md border">
            {filtered.length > 0 ? (
              <Table className="min-w-[960px]">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {listFields.map((field) => (
                      <TableHead key={field.key} className="whitespace-nowrap">
                        {field.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const id = String(row.id ?? '');
                    return (
                      <TableRow key={id}>
                        {listFields.map((field) => (
                          <TableCell key={field.key} className={field.key === 'month' ? 'font-medium' : ''}>
                            {renderCell(row, field)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">{actions(id)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">暂无数据</div>
            )}
          </div>
        </CardContent>
      </Card>

      {canEditActiveType && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          dataType={activeType}
        />
      )}

      {canManageFields && (
        <FieldConfigDialog
          open={fieldConfigOpen}
          onOpenChange={setFieldConfigOpen}
        />
      )}

      {/* 操作日志查看器 */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              操作日志
            </DialogTitle>
            <DialogDescription>
              查看数据操作记录，包括清空和恢复操作。最多保留 200 条记录。
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {operationLogs.length > 0 ? (
              <div className="space-y-3 pr-2">
                {operationLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 ${
                      log.action === 'clear_source_data'
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-blue-500/20 bg-blue-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            log.action === 'clear_source_data'
                              ? 'border-red-500/30 text-red-600 bg-red-500/5'
                              : 'border-blue-500/30 text-blue-600 bg-blue-500/5'
                          }
                        >
                          {log.action === 'clear_source_data' ? '清空源数据' : '恢复初始数据'}
                        </Badge>
                        <span className="text-sm font-medium">{log.description}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {log.details.clearedTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {log.details.clearedTypes.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无操作日志记录
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
