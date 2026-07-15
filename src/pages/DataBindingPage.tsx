import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database, Route, ShieldCheck, Plus, Pencil, Trash2, Play,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDataBinding, generateBindingId, getAllDataTypeLabels } from '@/contexts/DataBindingContext';
import { useData } from '@/contexts/DataContext';
import { getFilterOperatorOptions, type DataSourceMap } from '@/utils/dataPathEngine';
import { applyAllRules, getMatchSummary, type MatchResult } from '@/utils/matchingEngine';
import { checkConsistency, getConsistencySummary } from '@/utils/consistencyChecker';
import {
  dataTypeChineseLabels, aggregationLabels, filterOperatorLabels, matchTypeLabels,
} from '@/types/dataBinding';
import type { DataType } from '@/types';
import type {
  DataPath, MatchingRule, PathFilter, AggregationType, FilterOperator, MatchType,
  DashboardDimension,
} from '@/types/dataBinding';
import { useToast } from '@/hooks/use-toast';

// Auto-injected: safe number conversion to prevent toFixed errors
function safeNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

const DIMENSIONS: DashboardDimension[] = ['总览', '总部', '自营', '线上', '犀利工厂', '全公司'];
const dataTypeOptions = getAllDataTypeLabels();
const aggregationOptions = (Object.keys(aggregationLabels) as AggregationType[]).map((a) => ({
  value: a,
  label: aggregationLabels[a],
}));
const operatorOptions = getFilterOperatorOptions();
const matchTypeOptions = (Object.keys(matchTypeLabels) as MatchType[]).map((m) => ({
  value: m,
  label: matchTypeLabels[m],
}));

// ============ Tab 1: 数据取值路径配置 ============

function PathEditDialog({
  open, onOpenChange, path, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: DataPath | null;
  onSave: (path: DataPath) => void;
}) {
  const [form, setForm] = useState<DataPath>(
    path ?? {
      id: generateBindingId('path'),
      metricKey: '',
      metricLabel: '',
      dimension: '总览',
      sourceType: 'department',
      sourceField: '',
      filters: [],
      aggregation: 'snapshot',
      description: '',
      enabled: true,
    }
  );

  // 当 path 变化时重置表单
  useEffect(() => {
    if (path) {
      setForm(path);
    } else {
      setForm({
        id: generateBindingId('path'),
        metricKey: '',
        metricLabel: '',
        dimension: '总览',
        sourceType: 'department',
        sourceField: '',
        filters: [],
        aggregation: 'snapshot',
        description: '',
        enabled: true,
      });
    }
  }, [path]);

  const handleAddFilter = () => {
    setForm((prev) => ({
      ...prev,
      filters: [...prev.filters, {
        id: generateBindingId('filter'),
        field: 'month',
        operator: 'equals',
        value: '${selectedMonth}',
      }],
    }));
  };

  const handleUpdateFilter = (filterId: string, updates: Partial<PathFilter>) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
    }));
  };

  const handleRemoveFilter = (filterId: string) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== filterId),
    }));
  };

  const handleSave = () => {
    if (!form.metricKey.trim() || !form.metricLabel.trim() || !form.sourceField.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{path ? '编辑数据取值路径' : '新增数据取值路径'}</DialogTitle>
          <DialogDescription>
            配置看板指标的数据来源、字段映射和过滤条件，支持 ${'{selectedMonth}'} 占位符
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">指标键名 *</Label>
              <Input
                value={form.metricKey}
                onChange={(e) => setForm({ ...form, metricKey: e.target.value })}
                placeholder="如 totalLaborCost"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">指标显示名 *</Label>
              <Input
                value={form.metricLabel}
                onChange={(e) => setForm({ ...form, metricLabel: e.target.value })}
                placeholder="如 总人力成本"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">看板维度</Label>
              <Select value={form.dimension} onValueChange={(v) => setForm({ ...form, dimension: v as DashboardDimension })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">数据源类型</Label>
              <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v as DataType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dataTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">数据源字段 *</Label>
              <Input
                value={form.sourceField}
                onChange={(e) => setForm({ ...form, sourceField: e.target.value })}
                placeholder="如 laborCost"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">聚合方式</Label>
              <Select value={form.aggregation} onValueChange={(v) => setForm({ ...form, aggregation: v as AggregationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {aggregationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.aggregation === 'derived' || form.aggregation === 'cumulative') && (
            <div className="space-y-1">
              <Label className="text-xs">派生公式描述</Label>
              <Input
                value={form.derivedFormula ?? ''}
                onChange={(e) => setForm({ ...form, derivedFormula: e.target.value })}
                placeholder="如 sum(laborCost) / sum(budgetLaborCost) * 100"
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* 过滤条件 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">过滤条件</Label>
              <Button variant="outline" size="sm" onClick={handleAddFilter}>
                <Plus className="mr-1 h-3 w-3" />
                添加条件
              </Button>
            </div>
            {form.filters.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">暂无过滤条件，将匹配全部记录</p>
            ) : (
              <div className="space-y-2">
                {form.filters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 rounded-md border p-2">
                    <Input
                      value={filter.field}
                      onChange={(e) => handleUpdateFilter(filter.id, { field: e.target.value })}
                      placeholder="字段名"
                      className="flex-1 font-mono text-xs h-8"
                    />
                    <Select
                      value={filter.operator}
                      onValueChange={(v) => handleUpdateFilter(filter.id, { operator: v as FilterOperator })}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {operatorOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      value={filter.value}
                      onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                      placeholder="值（支持 ${selectedMonth}）"
                      className="flex-1 font-mono text-xs h-8"
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => handleRemoveFilter(filter.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">路径描述</Label>
            <Input
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="描述该取值路径的作用..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={!form.metricKey.trim() || !form.sourceField.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataPathSection() {
  const { paths, addPath, updatePath, removePath, updatePath: update } = useDataBinding();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<DataPath | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterDimension, setFilterDimension] = useState<string>('all');

  const filteredPaths = useMemo(() => {
    if (filterDimension === 'all') return paths;
    return paths.filter((p) => p.dimension === filterDimension);
  }, [paths, filterDimension]);

  const handleEdit = (path: DataPath) => {
    setEditingPath(path);
    setEditOpen(true);
  };

  const handleAdd = () => {
    setEditingPath(null);
    setEditOpen(true);
  };

  const handleSave = (path: DataPath) => {
    if (editingPath) {
      updatePath(path.id, path);
      toast({ title: '取值路径已更新' });
    } else {
      addPath(path);
      toast({ title: '取值路径已新增' });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      removePath(deleteId);
      toast({ title: '取值路径已删除' });
      setDeleteId(null);
    }
  };

  const handleToggleEnabled = (path: DataPath) => {
    update(path.id, { enabled: !path.enabled });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterDimension} onValueChange={setFilterDimension}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="按维度筛选" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部维度</SelectItem>
              {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filteredPaths.length} 条路径</Badge>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增路径
        </Button>
      </div>

      <div className="space-y-2">
        {filteredPaths.map((path) => (
          <Card key={path.id} className={!path.enabled ? 'opacity-60' : ''}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{path.dimension}</Badge>
                    <span className="font-medium text-sm">{path.metricLabel}</span>
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{path.metricKey}</code>
                    {!path.enabled && <Badge variant="secondary" className="text-xs">已禁用</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>数据源: <strong>{dataTypeChineseLabels[path.sourceType]}</strong></span>
                    <span>字段: <code className="bg-muted px-1 rounded">{path.sourceField}</code></span>
                    <span>聚合: {aggregationLabels[path.aggregation]}</span>
                    {path.derivedFormula && <span>公式: <code className="bg-muted px-1 rounded text-green-600">{path.derivedFormula}</code></span>}
                  </div>
                  {path.filters.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      <span className="text-muted-foreground">过滤:</span>
                      {path.filters.map((f) => (
                        <code key={f.id} className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                          {f.field} {filterOperatorLabels[f.operator]} {f.value}
                        </code>
                      ))}
                    </div>
                  )}
                  {path.description && (
                    <p className="text-xs text-muted-foreground italic">{path.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleEnabled(path)} aria-label={path.enabled ? '禁用' : '启用'}>
                    {path.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(path)} aria-label="编辑">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(path.id)} aria-label="删除">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredPaths.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无数据取值路径配置
          </div>
        )}
      </div>

      <PathEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        path={editingPath}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该取值路径？</AlertDialogTitle>
            <AlertDialogDescription>删除后看板对应指标将不再显示数据来源追踪。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Tab 2: 数值匹配规则设定 ============

function RuleEditDialog({
  open, onOpenChange, rule, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: MatchingRule | null;
  onSave: (rule: MatchingRule) => void;
}) {
  const [form, setForm] = useState<MatchingRule>(
    rule ?? {
      id: generateBindingId('rule'),
      name: '',
      sourceType: 'department',
      sourceField: '',
      targetType: 'overview',
      targetField: '',
      matchType: 'exact',
      matchField: 'month',
      tolerance: 5,
      description: '',
      enabled: true,
    }
  );

  useEffect(() => {
    if (rule) {
      setForm(rule);
    } else {
      setForm({
        id: generateBindingId('rule'),
        name: '',
        sourceType: 'department',
        sourceField: '',
        targetType: 'overview',
        targetField: '',
        matchType: 'exact',
        matchField: 'month',
        tolerance: 5,
        description: '',
        enabled: true,
      });
    }
  }, [rule]);

  const handleSave = () => {
    if (!form.name.trim() || !form.sourceField.trim() || !form.targetField.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? '编辑匹配规则' : '新增匹配规则'}</DialogTitle>
          <DialogDescription>
            定义数据源字段间的匹配条件，当数据管理中的数据更新时，看板根据匹配规则自动获取对应数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">规则名称 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 月份精确匹配" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">源数据类型</Label>
              <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v as DataType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dataTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">源字段 *</Label>
              <Input value={form.sourceField} onChange={(e) => setForm({ ...form, sourceField: e.target.value })} placeholder="如 month, laborCost" className="font-mono text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">目标数据类型</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as DataType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dataTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">目标字段 *</Label>
              <Input value={form.targetField} onChange={(e) => setForm({ ...form, targetField: e.target.value })} placeholder="如 month, budgetLaborCost" className="font-mono text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">匹配类型</Label>
              <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v as MatchType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matchTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">关联字段 *</Label>
              <Input value={form.matchField} onChange={(e) => setForm({ ...form, matchField: e.target.value })} placeholder="如 month, department" className="font-mono text-sm" />
            </div>
          </div>

          {form.matchType === 'range' && (
            <div className="space-y-1">
              <Label className="text-xs">容差百分比 (%)</Label>
              <Input
                type="number"
                value={form.tolerance ?? 5}
                onChange={(e) => setForm({ ...form, tolerance: parseFloat(e.target.value) || 0 })}
                placeholder="5"
              />
              <p className="text-[10px] text-muted-foreground">源值与目标值差值的允许百分比范围</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">规则描述</Label>
            <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述该匹配规则的作用..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || !form.sourceField.trim() || !form.targetField.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchingRuleSection() {
  const { rules, addRule, updateRule, removeRule } = useDataBinding();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MatchingRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<MatchResult[] | null>(null);

  const data = useData();
  const dataSources: DataSourceMap = useMemo(() => ({
    overview: data.overviews as unknown as Record<string, unknown>[],
    department: data.departments as unknown as Record<string, unknown>[],
    composition: data.compositions as unknown as Record<string, unknown>[],
    position: data.positions as unknown as Record<string, unknown>[],
    store: data.stores as unknown as Record<string, unknown>[],
    budget: data.budgets as unknown as Record<string, unknown>[],
    costStructure: data.costStructures as unknown as Record<string, unknown>[],
  }), [data]);

  const handleEdit = (rule: MatchingRule) => {
    setEditingRule(rule);
    setEditOpen(true);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setEditOpen(true);
  };

  const handleSave = (rule: MatchingRule) => {
    if (editingRule) {
      updateRule(rule.id, rule);
      toast({ title: '匹配规则已更新' });
    } else {
      addRule(rule);
      toast({ title: '匹配规则已新增' });
    }
    setTestResults(null); // 规则变更后清除旧测试结果
  };

  const handleDelete = () => {
    if (deleteId) {
      removeRule(deleteId);
      toast({ title: '匹配规则已删除' });
      setDeleteId(null);
      setTestResults(null);
    }
  };

  const handleToggleEnabled = (rule: MatchingRule) => {
    updateRule(rule.id, { enabled: !rule.enabled });
    setTestResults(null);
  };

  const handleTest = () => {
    const results = applyAllRules(rules, dataSources);
    setTestResults(results);
    const summary = getMatchSummary(results);
    toast({
      title: '匹配测试完成',
      description: `全部匹配 ${summary.allMatched}，部分匹配 ${summary.partialMatched}，未匹配 ${summary.noneMatched}`,
    });
  };

  const summary = testResults ? getMatchSummary(testResults) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rules.length} 条规则</Badge>
          {summary && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-green-600 border-green-500/30">全部匹配 {summary.allMatched}</Badge>
              <Badge variant="outline" className="text-orange-600 border-orange-500/30">部分匹配 {summary.partialMatched}</Badge>
              <Badge variant="outline" className="text-red-600 border-red-500/30">未匹配 {summary.noneMatched}</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTest}>
            <Play className="mr-2 h-4 w-4" />
            测试匹配
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增规则
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const testResult = testResults?.find((r) => r.ruleId === rule.id);
          return (
            <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rule.name}</span>
                      <Badge variant="outline" className="text-xs">{matchTypeLabels[rule.matchType]}</Badge>
                      {!rule.enabled && <Badge variant="secondary" className="text-xs">已禁用</Badge>}
                      {testResult && (
                        <Badge
                          variant="outline"
                          className={
                            testResult.status === 'all_matched'
                              ? 'text-green-600 border-green-500/30 bg-green-500/5'
                              : testResult.status === 'partial_matched'
                              ? 'text-orange-600 border-orange-500/30 bg-orange-500/5'
                              : 'text-red-600 border-red-500/30 bg-red-500/5'
                          }
                        >
                          {testResult.status === 'all_matched' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {testResult.status === 'partial_matched' && <AlertTriangle className="mr-1 h-3 w-3" />}
                          {testResult.status === 'none_matched' && <XCircle className="mr-1 h-3 w-3" />}
                          {testResult.matchedPairs}/{testResult.totalSourceRecords} 匹配
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>
                        <strong>{dataTypeChineseLabels[rule.sourceType]}</strong>.<code className="bg-muted px-1 rounded">{rule.sourceField}</code>
                      </span>
                      <span className="text-blue-500">↔</span>
                      <span>
                        <strong>{dataTypeChineseLabels[rule.targetType]}</strong>.<code className="bg-muted px-1 rounded">{rule.targetField}</code>
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      按 <code className="bg-muted px-1 rounded">{rule.matchField}</code> 关联
                      {rule.matchType === 'range' && `，容差 ${rule.tolerance ?? 5}%`}
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground italic">{rule.description}</p>
                    )}
                    {/* 匹配详情 */}
                    {testResult && testResult.details.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-xs text-blue-500 cursor-pointer hover:underline">
                          查看匹配详情 ({testResult.details.length} 条)
                        </summary>
                        <ScrollArea className="mt-1 max-h-40 rounded-md border p-2">
                          <div className="space-y-1">
                            {testResult.details.map((d, i) => (
                              <div key={i} className={`text-[10px] flex items-start gap-1.5 ${d.matched ? 'text-green-600' : 'text-red-500'}`}>
                                {d.matched ? <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" /> : <XCircle className="h-3 w-3 shrink-0 mt-0.5" />}
                                <span className="font-mono">
                                  {String(d.sourceRecord[rule.matchField] ?? '?')}:
                                  源={String(d.sourceValue ?? '-')}
                                  {d.matched ? ` → 目标=${String(d.targetValue ?? '-')}` : ''}
                                </span>
                                <span className="text-muted-foreground">({d.reason})</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleEnabled(rule)} aria-label={rule.enabled ? '禁用' : '启用'}>
                      {rule.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rule)} aria-label="编辑">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(rule.id)} aria-label="删除">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rules.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无数值匹配规则配置
          </div>
        )}
      </div>

      <RuleEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        rule={editingRule}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该匹配规则？</AlertDialogTitle>
            <AlertDialogDescription>删除后将不再按该规则进行数据匹配。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Tab 3: 数据一致性校验 ============

function ConsistencySection() {
  const { paths, consistencyResults, setConsistencyResults } = useDataBinding();
  const { toast } = useToast();
  const data = useData();
  const [searchParams] = useSearchParams();

  const selectedMonth = searchParams.get('month') || '2026-05';

  // 构建派生 overviews（与看板一致：从部门数据派生总人力成本、总人数等）
  const derivedOverviews = useMemo(() => {
    const allMonths = new Set<string>([
      ...data.overviews.map((o) => o.month),
      ...data.departments.map((d) => d.month),
    ]);
    return Array.from(allMonths).map((month) => {
      const original = data.overviews.find((o) => o.month === month);
      const monthDepts = data.departments.filter((d) => d.month === month);
      const companyDept = monthDepts.find((d) => d.department === '全公司');
      const segmentDepts = monthDepts.filter((d) => d.department !== '全公司');
      const derivedLaborCost = companyDept
        ? companyDept.laborCost
        : segmentDepts.reduce((s, d) => s + d.laborCost, 0);
      const derivedHeadcount = companyDept
        ? companyDept.headcount
        : segmentDepts.reduce((s, d) => s + d.headcount, 0);
      const totalRevenue = original?.totalRevenue ?? 0;
      return {
        ...original,
        id: original?.id ?? `derived-${month}`,
        month,
        totalRevenue,
        totalLaborCost: derivedLaborCost,
        headcount: derivedHeadcount,
        laborCostRatio: totalRevenue > 0 ? (derivedLaborCost / totalRevenue) * 100 : 0,
      } as Record<string, unknown>;
    });
  }, [data.overviews, data.departments]);

  // 使用派生数据构建数据源（与看板展示一致）
  const dataSources: DataSourceMap = useMemo(() => ({
    overview: derivedOverviews as unknown as Record<string, unknown>[],
    department: data.departments as unknown as Record<string, unknown>[],
    composition: data.compositions as unknown as Record<string, unknown>[],
    position: data.positions as unknown as Record<string, unknown>[],
    store: data.stores as unknown as Record<string, unknown>[],
    budget: data.budgets as unknown as Record<string, unknown>[],
    costStructure: data.costStructures as unknown as Record<string, unknown>[],
  }), [derivedOverviews, data]);

  const enabledPaths = useMemo(() => paths.filter((p) => p.enabled), [paths]);

  // 看板值映射：从派生数据中提取当前月份的看板值（与看板展示一致）
  const dashboardValues = useMemo(() => {
    const values: Record<string, number | null> = {};

    // 总览维度：使用派生 overviews
    const overview = derivedOverviews.find((o) => o.month === selectedMonth);
    if (overview) {
      values['path-overview-revenue'] = overview.totalRevenue as number;
      values['path-overview-ratio'] = overview.laborCostRatio as number;
    }

    // 从部门数据派生
    const allDepts = data.departments.filter((d) => d.month === selectedMonth);
    const companyDept = allDepts.find((d) => d.department === '全公司');
    const segmentDepts = allDepts.filter((d) => d.department !== '全公司');
    const derivedLaborCost = companyDept ? companyDept.laborCost : segmentDepts.reduce((s, d) => s + d.laborCost, 0);
    const derivedHeadcount = companyDept ? companyDept.headcount : segmentDepts.reduce((s, d) => s + d.headcount, 0);
    values['path-overview-labor-cost'] = derivedLaborCost;
    values['path-overview-headcount'] = derivedHeadcount;

    // 各板块
    const dimMap: Record<string, string> = { '总部': '总部', '自营': '自营', '线上': '线上', '犀利工厂': '犀利工厂' };
    for (const [dim, deptKey] of Object.entries(dimMap)) {
      const dept = allDepts.find((d) => d.department === deptKey);
      if (dept) {
        values[`path-${dim === '总部' ? 'hq' : dim === '自营' ? 'self' : dim === '线上' ? 'online' : 'factory'}-headcount`] = dept.headcount;
        values[`path-${dim === '总部' ? 'hq' : dim === '自营' ? 'self' : dim === '线上' ? 'online' : 'factory'}-labor-cost`] = dept.laborCost;
        if (dim === '总部') {
          values['path-hq-ratio'] = dept.laborCostRatio;
        }
      }
    }

    // 预算使用率
    const allBudgets = data.budgets.filter((b) => b.month === selectedMonth);
    const totalLabor = allBudgets.reduce((s, b) => s + b.laborCost, 0);
    const totalBudget = allBudgets.reduce((s, b) => s + b.budgetLaborCost, 0);
    values['path-overview-budget-usage'] = totalBudget > 0 ? (totalLabor / totalBudget) * 100 : 0;

    return values;
  }, [derivedOverviews, data.departments, data.budgets, selectedMonth]);

  const handleCheck = useCallback(() => {
    const results = checkConsistency(
      enabledPaths,
      dataSources,
      { selectedMonth },
      dashboardValues
    );
    setConsistencyResults(results);
    const summary = getConsistencySummary(results);
    toast({
      title: '一致性校验完成',
      description: `共 ${summary.total} 项，一致 ${summary.consistent}，不一致 ${summary.inconsistent}，无数据 ${summary.noData}`,
    });
  }, [enabledPaths, dataSources, dashboardValues, selectedMonth, setConsistencyResults, toast]);

  const summary = consistencyResults.length > 0 ? getConsistencySummary(consistencyResults) : null;

  return (
    <div className="space-y-4">
      {/* 校验控制栏 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-500" />
                <span className="font-medium">数据一致性校验</span>
              </div>
              <p className="text-xs text-muted-foreground">
                对比看板显示值与数据管理中的源数据计算值，校验数据取值路径的准确性
              </p>
            </div>
            <div className="flex items-center gap-3">
              {summary && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="mr-1 h-3 w-3" />一致 {summary.consistent}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/5">
                    <AlertTriangle className="mr-1 h-3 w-3" />不一致 {summary.inconsistent}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    无数据 {summary.noData}
                  </Badge>
                </div>
              )}
              <Button onClick={handleCheck} disabled={enabledPaths.length === 0}>
                <Play className="mr-2 h-4 w-4" />
                执行校验
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 校验结果 */}
      {consistencyResults.length > 0 ? (
        <div className="space-y-2">
          {consistencyResults.map((result) => {
            const StatusIcon = result.status === 'consistent'
              ? CheckCircle2
              : result.status === 'inconsistent'
              ? AlertTriangle
              : result.status === 'no_data'
              ? XCircle
              : AlertTriangle;
            const statusColor = result.status === 'consistent'
              ? 'text-green-500'
              : result.status === 'inconsistent'
              ? 'text-orange-500'
              : 'text-muted-foreground';
            const borderColor = result.status === 'consistent'
              ? 'border-green-500/20 bg-green-500/5'
              : result.status === 'inconsistent'
              ? 'border-orange-500/20 bg-orange-500/5'
              : 'border-muted';
            return (
              <Card key={result.pathId} className={borderColor}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                        <Badge variant="outline" className="text-xs">{result.dimension}</Badge>
                        <span className="font-medium text-sm">{result.metricLabel}</span>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{result.metricKey}</code>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">看板显示值: </span>
                          <span className="font-mono font-medium">
                            {result.dashboardValue !== null ? safeNum(result.dashboardValue).toFixed(2) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">路径解析值: </span>
                          <span className="font-mono font-medium">
                            {result.sourceValue !== null ? safeNum(result.sourceValue).toFixed(2) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">差值: </span>
                          <span className={`font-mono font-medium ${result.difference !== null && Math.abs(result.difference) > 0.01 ? 'text-orange-600' : ''}`}>
                            {result.difference !== null ? `${safeNum(result.difference).toFixed(2)}` : '—'}
                            {result.differencePercent !== null && ` (${safeNum(result.differencePercent).toFixed(2)}%)`}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                      <p className="text-[10px] text-muted-foreground">
                        校验时间: {new Date(result.lastChecked).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            点击「执行校验」开始数据一致性检查
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            将对比 {enabledPaths.length} 条数据取值路径的解析值与看板实际显示值
          </p>
        </div>
      )}
    </div>
  );
}

// ============ 主页面 ============

export function DataBindingPage() {
  const { resetBinding } = useDataBinding();
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('paths');

  const handleReset = () => {
    resetBinding();
    toast({ title: '数据绑定配置已恢复默认' });
    setResetOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">数据绑定配置</h2>
          <p className="text-sm text-muted-foreground">
            配置看板数据的取值路径、数值匹配规则和一致性校验
          </p>
        </div>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              恢复默认配置
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认恢复默认配置？</AlertDialogTitle>
              <AlertDialogDescription>
                将清除所有自定义的数据取值路径和匹配规则，恢复为系统默认配置，无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>确认恢复</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="paths">
            <Database className="mr-2 h-4 w-4" />
            取值路径配置
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Route className="mr-2 h-4 w-4" />
            匹配规则设定
          </TabsTrigger>
          <TabsTrigger value="consistency">
            <ShieldCheck className="mr-2 h-4 w-4" />
            一致性校验
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paths" className="mt-4">
          <DataPathSection />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <MatchingRuleSection />
        </TabsContent>
        <TabsContent value="consistency" className="mt-4">
          <ConsistencySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
