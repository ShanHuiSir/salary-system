import { useState, useCallback, useMemo } from 'react';
import {
  Settings2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  FunctionSquare,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFieldConfig } from '@/contexts/FieldConfigContext';
import { useToast } from '@/hooks/use-toast';
import type { DataType } from '@/types';
import type { FieldDef, FieldType } from '@/types/fieldConfig';
import { getUserFields, formulaTemplates } from '@/types/fieldConfig';
import { validateFormulaExpression } from '@/utils/formulaEngine';

const dataTypeLabels: Record<DataType, string> = {
  overview: '月度总览',
  department: '部门数据',
  composition: '成本构成',
  position: '职级数据',
  store: '门店/区域数据',
  budget: '预算人力成本',
  costStructure: '人力成本组成',
};

const fieldTypeLabels: Record<FieldType, string> = {
  string: '文本',
  number: '数字',
  enum: '枚举选择',
  text: '长文本',
  formula: '公式计算',
};

const dataTypeOrder: DataType[] = ['overview', 'department', 'composition', 'position', 'store', 'budget', 'costStructure'];

interface FieldConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FieldConfigDialog({ open, onOpenChange }: FieldConfigDialogProps) {
  const { getFields, addField, updateField, removeField, reorderFields, resetFieldConfigs } = useFieldConfig();
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<DataType>('overview');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  // 新增字段表单
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('number');
  const [newRequired, setNewRequired] = useState(false);
  const [newEnumValues, setNewEnumValues] = useState('');
  const [newSuffix, setNewSuffix] = useState('');
  const [newVisibleInList, setNewVisibleInList] = useState(true);
  // 公式字段相关
  const [newFormulaExpression, setNewFormulaExpression] = useState('');
  const [newFormulaDescription, setNewFormulaDescription] = useState('');
  const [newFormulaPrecision, setNewFormulaPrecision] = useState(2);

  // 编辑公式字段
  const [editFormulaKey, setEditFormulaKey] = useState<string | null>(null);
  const [editFormulaExpression, setEditFormulaExpression] = useState('');
  const [editFormulaDescription, setEditFormulaDescription] = useState('');
  const [editFormulaPrecision, setEditFormulaPrecision] = useState(2);

  // 编辑字段（全属性）
  const [editFieldKey, setEditFieldKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<FieldType>('number');
  const [editRequired, setEditRequired] = useState(false);
  const [editEnumValues, setEditEnumValues] = useState('');
  const [editSuffix, setEditSuffix] = useState('');
  const [editVisibleInList, setEditVisibleInList] = useState(true);
  const [editFormulaExpr, setEditFormulaExpr] = useState('');
  const [editFormulaDesc, setEditFormulaDesc] = useState('');
  const [editFormulaPrec, setEditFormulaPrec] = useState(2);

  const currentFields = useMemo(() => getFields(activeType), [activeType, getFields]);

  const resetAddForm = useCallback(() => {
    setNewKey('');
    setNewLabel('');
    setNewType('number');
    setNewRequired(false);
    setNewEnumValues('');
    setNewSuffix('');
    setNewVisibleInList(true);
    setNewFormulaExpression('');
    setNewFormulaDescription('');
    setNewFormulaPrecision(2);
  }, []);

  const handleAddField = useCallback(() => {
    if (!newKey.trim()) {
      toast({ title: '请输入字段键名', variant: 'destructive' });
      return;
    }
    if (!newLabel.trim()) {
      toast({ title: '请输入字段标签', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newKey)) {
      toast({ title: '字段键名只能使用英文字母、数字和下划线', variant: 'destructive' });
      return;
    }

    // 公式类型特殊验证
    if (newType === 'formula') {
      const validation = validateFormulaExpression(newFormulaExpression, currentFields);
      if (!validation.valid) {
        toast({ title: '公式验证失败', description: validation.errors.join('; '), variant: 'destructive' });
        return;
      }
    }

    const maxOrder = currentFields.reduce((max, field) => Math.max(max, field.order), 0);
    const field: FieldDef = {
      key: newKey.trim(),
      label: newLabel.trim(),
      type: newType,
      required: newType === 'formula' ? false : newRequired, // 公式字段不需要必填标记
      suffix: newSuffix.trim() || undefined,
      visibleInList: newVisibleInList,
      system: false,
      order: maxOrder + 1,
    };

    if (newType === 'enum' && newEnumValues.trim()) {
      field.enumValues = newEnumValues.split(',').map((v) => v.trim()).filter(Boolean);
    }

    if (newType === 'formula') {
      const validation = validateFormulaExpression(newFormulaExpression, currentFields);
      field.formula = {
        expression: newFormulaExpression.trim(),
        dependsOn: validation.dependsOn,
        precision: newFormulaPrecision,
        description: newFormulaDescription.trim() || undefined,
      };
    }

    addField(activeType, field);
    toast({ title: `字段 "${newLabel}" 已添加` });
    resetAddForm();
    setAddFormOpen(false);
  }, [activeType, newKey, newLabel, newType, newRequired, newEnumValues, newSuffix, newVisibleInList, newFormulaExpression, newFormulaDescription, newFormulaPrecision, currentFields, addField, toast, resetAddForm]);

  const handleDelete = useCallback(() => {
    if (!deleteKey) return;
    removeField(activeType, deleteKey);
    toast({ title: '字段已删除' });
    setDeleteKey(null);
  }, [activeType, deleteKey, removeField, toast]);

  const handleReset = useCallback(() => {
    resetFieldConfigs();
    toast({ title: '字段配置已恢复默认' });
    setResetOpen(false);
  }, [resetFieldConfigs, toast]);

  const handleToggleVisible = useCallback((key: string, visible: boolean) => {
    updateField(activeType, key, { visibleInList: visible });
  }, [activeType, updateField]);

  const handleMoveField = useCallback((key: string, direction: 'up' | 'down') => {
    const allFields = [...getFields(activeType)].sort((a, b) => a.order - b.order);
    const userFields = getUserFields(allFields);
    const currentUserIndex = userFields.findIndex((field) => field.key === key);
    const targetUserIndex = direction === 'up' ? currentUserIndex - 1 : currentUserIndex + 1;
    const targetField = userFields[targetUserIndex];
    if (currentUserIndex < 0 || !targetField) return;

    const fromIndex = allFields.findIndex((field) => field.key === key);
    const toIndex = allFields.findIndex((field) => field.key === targetField.key);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderFields(activeType, fromIndex, toIndex);
  }, [activeType, getFields, reorderFields]);

  const handleToggleRequired = useCallback((key: string, required: boolean) => {
    updateField(activeType, key, { required });
  }, [activeType, updateField]);

  const handleEditFormula = useCallback((field: FieldDef) => {
    setEditFormulaKey(field.key);
    setEditFormulaExpression(field.formula?.expression ?? '');
    setEditFormulaDescription(field.formula?.description ?? '');
    setEditFormulaPrecision(field.formula?.precision ?? 2);
  }, []);

  const handleSaveFormula = useCallback(() => {
    if (!editFormulaKey) return;
    const validation = validateFormulaExpression(editFormulaExpression, currentFields);
    if (!validation.valid) {
      toast({ title: '公式验证失败', description: validation.errors.join('; '), variant: 'destructive' });
      return;
    }
    updateField(activeType, editFormulaKey, {
      formula: {
        expression: editFormulaExpression.trim(),
        dependsOn: validation.dependsOn,
        precision: editFormulaPrecision,
        description: editFormulaDescription.trim() || undefined,
      },
    });
    toast({ title: '公式已更新' });
    setEditFormulaKey(null);
  }, [activeType, editFormulaKey, editFormulaExpression, editFormulaDescription, editFormulaPrecision, currentFields, updateField, toast]);

  // 打开全属性编辑对话框
  const handleEditField = useCallback((field: FieldDef) => {
    setEditFieldKey(field.key);
    setEditLabel(field.label);
    setEditType(field.type);
    setEditRequired(field.required);
    setEditEnumValues(field.enumValues?.join(', ') ?? '');
    setEditSuffix(field.suffix ?? '');
    setEditVisibleInList(field.visibleInList);
    setEditFormulaExpr(field.formula?.expression ?? '');
    setEditFormulaDesc(field.formula?.description ?? '');
    setEditFormulaPrec(field.formula?.precision ?? 2);
  }, []);

  // 保存字段编辑
  const handleSaveField = useCallback(() => {
    if (!editFieldKey) return;
    if (!editLabel.trim()) {
      toast({ title: '请输入字段标签', variant: 'destructive' });
      return;
    }

    const updates: Partial<FieldDef> = {
      label: editLabel.trim(),
      type: editType,
      required: editType === 'formula' ? false : editRequired,
      visibleInList: editVisibleInList,
      suffix: editSuffix.trim() || undefined,
    };

    // 枚举类型
    if (editType === 'enum' && editEnumValues.trim()) {
      updates.enumValues = editEnumValues.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (editType !== 'enum') {
      updates.enumValues = undefined;
    }

    // 公式类型
    if (editType === 'formula') {
      if (!editFormulaExpr.trim()) {
        toast({ title: '请输入公式表达式', variant: 'destructive' });
        return;
      }
      const validation = validateFormulaExpression(editFormulaExpr, currentFields);
      if (!validation.valid) {
        toast({ title: '公式验证失败', description: validation.errors.join('; '), variant: 'destructive' });
        return;
      }
      updates.formula = {
        expression: editFormulaExpr.trim(),
        dependsOn: validation.dependsOn,
        precision: editFormulaPrec,
        description: editFormulaDesc.trim() || undefined,
      };
    } else {
      updates.formula = undefined;
    }

    updateField(activeType, editFieldKey, updates);
    toast({ title: `字段 "${editLabel}" 已更新` });
    setEditFieldKey(null);
  }, [editFieldKey, editLabel, editType, editRequired, editEnumValues, editSuffix, editVisibleInList, editFormulaExpr, editFormulaDesc, editFormulaPrec, currentFields, updateField, activeType, toast]);

  // 编辑模式下的公式验证
  const editFormulaValidation = useMemo(() => {
    if (editType !== 'formula' || !editFormulaExpr.trim()) return null;
    return validateFormulaExpression(editFormulaExpr, currentFields);
  }, [editType, editFormulaExpr, currentFields]);

  const renderFieldList = (dataType: DataType) => {
    const allFields = [...getFields(dataType)].sort((a, b) => a.order - b.order);
    const systemFields = allFields.filter((f) => f.system);
    const userFields = getUserFields(allFields);

    return (
      <div className="min-w-0 space-y-4 pr-3">
        {/* 系统字段（不可删除） */}
        {systemFields.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">系统字段（不可删除）</p>
            {systemFields.map((f) => (
              <div key={f.key} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                <Badge variant="secondary" className="shrink-0 text-xs px-1.5">系统</Badge>
                <span className="min-w-0 break-words text-sm font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">({f.key})</span>
                <Badge variant="outline" className="shrink-0 text-xs">{fieldTypeLabels[f.type]}</Badge>
                {f.required && <Badge variant="default" className="shrink-0 text-xs">必填</Badge>}
                {f.visibleInList && <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                {!f.visibleInList && <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
              </div>
            ))}
          </div>
        )}

        {/* 用户字段（可增删改） */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">自定义字段（可增删改排序）</p>
            <Button variant="outline" size="sm" onClick={() => { resetAddForm(); setAddFormOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              添加字段
            </Button>
          </div>

          {userFields.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground border rounded-md">
              暂无自定义字段，点击"添加字段"新增
            </div>
          ) : (
            userFields.map((f, idx) => (
              <div key={f.key} className={`flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2 transition-colors sm:flex-row sm:items-center ${f.type === 'formula' ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50' : 'hover:bg-muted/30'}`}>
                {/* 排序按钮 */}
                <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:gap-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-4 sm:w-4" onClick={() => handleMoveField(f.key, 'up')} disabled={idx === 0} title="上移">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-4 sm:w-4" onClick={() => handleMoveField(f.key, 'down')} disabled={idx === userFields.length - 1} title="下移">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {/* 必填切换（公式字段不需要） */}
                {f.type !== 'formula' && (
                  <Checkbox
                    checked={f.required}
                    onCheckedChange={(v) => handleToggleRequired(f.key, v === true)}
                    title="必填"
                  />
                )}
                {f.type === 'formula' && (
                  <FunctionSquare className="h-4 w-4 text-blue-500" />
                )}

                {/* 字段信息 */}
                <span className="min-w-0 break-words text-sm font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">({f.key})</span>
                <Badge variant={f.type === 'formula' ? 'default' : 'outline'} className={`text-xs ${f.type === 'formula' ? 'bg-blue-500 text-white' : ''}`}>
                  {fieldTypeLabels[f.type]}
                </Badge>
                {f.suffix && <Badge variant="outline" className="text-xs">{f.suffix}</Badge>}
                {f.type === 'enum' && f.enumValues && (
                  <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                    [{f.enumValues.join('/')}]
                  </span>
                )}

                {/* 公式字段显示表达式摘要 */}
                {f.type === 'formula' && f.formula && (
                  <span className="max-w-[220px] truncate text-xs text-blue-600 dark:text-blue-400" title={f.formula.expression}>
                    = {f.formula.expression}
                  </span>
                )}
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1">

                {/* 列表可见切换 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleToggleVisible(f.key, !f.visibleInList)}
                  title={f.visibleInList ? '在列表中显示' : '在列表中隐藏'}
                >
                  {f.visibleInList ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />}
                </Button>

                {/* 公式编辑按钮 */}
                {f.type === 'formula' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-blue-500"
                    onClick={() => handleEditFormula(f)}
                    title="编辑公式"
                  >
                    <FunctionSquare className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* 编辑字段属性 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleEditField(f)}
                  title="编辑字段"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                {/* 删除 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => setDeleteKey(f.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // 公式字段验证结果
  const formulaValidation = useMemo(() => {
    if (newType !== 'formula' || !newFormulaExpression.trim()) return null;
    return validateFormulaExpression(newFormulaExpression, currentFields);
  }, [newType, newFormulaExpression, currentFields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-5xl min-w-0 flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            字段配置管理
          </DialogTitle>
          <DialogDescription>
            自定义每种数据类型的字段，可添加、删除、排序和调整属性。系统字段（id、month）不可删除。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as DataType)} className="min-h-0 min-w-0 flex-1">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="grid h-auto min-w-[840px] w-full grid-cols-7">
            {dataTypeOrder.map((key) => (
              <TabsTrigger key={key} value={key} className="px-2 text-xs lg:text-sm">
                {dataTypeLabels[key]}
              </TabsTrigger>
            ))}
            </TabsList>
          </div>

          {dataTypeOrder.map((key) => (
            <TabsContent key={key} value={key} className="mt-3 min-h-0 flex-1">
              <ScrollArea className="h-[min(52vh,440px)] pr-1">
                {renderFieldList(key)}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="shrink-0 border-t pt-4 sm:justify-between">
          <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                恢复默认配置
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>恢复默认字段配置？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将清除所有自定义字段和调整，恢复为系统默认配置，无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>确认恢复</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>

      {/* 新增字段对话框 */}
      <Dialog open={addFormOpen} onOpenChange={setAddFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>添加新字段</DialogTitle>
            <DialogDescription>
              为 {dataTypeLabels[activeType]} 添加一个新的自定义字段
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-4 pr-3">
              <div className="grid gap-2">
                <Label htmlFor="new-key">字段键名（英文）</Label>
                <Input id="new-key" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="如 customField1" />
                <p className="text-xs text-muted-foreground">仅支持英文字母、数字和下划线，首字符须为字母或下划线</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-label">显示标签</Label>
                <Input id="new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="如 自定义指标(万)" />
              </div>

              <div className="grid gap-2">
                <Label>字段类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['number', 'string', 'enum', 'text', 'formula'] as FieldType[]).map((t) => (
                    <Button
                      key={t}
                      variant={newType === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewType(t)}
                      className={`justify-start ${newType === 'formula' && t === 'formula' ? 'bg-blue-500 text-white' : ''}`}
                    >
                      {t === 'formula' && <FunctionSquare className="mr-1.5 h-3.5 w-3.5" />}
                      {fieldTypeLabels[t]}
                    </Button>
                  ))}
                </div>
              </div>

              {newType === 'enum' && (
                <div className="grid gap-2">
                  <Label htmlFor="new-enum">枚举选项（逗号分隔）</Label>
                  <Input id="new-enum" value={newEnumValues} onChange={(e) => setNewEnumValues(e.target.value)} placeholder="如 选项A,选项B,选项C" />
                </div>
              )}

              {newType === 'number' && (
                <div className="grid gap-2">
                  <Label htmlFor="new-suffix">数值后缀</Label>
                  <Input id="new-suffix" value={newSuffix} onChange={(e) => setNewSuffix(e.target.value)} placeholder="如 万、%" />
                </div>
              )}

              {/* 公式字段配置 */}
              {newType === 'formula' && (
                <div className="space-y-4 rounded-md border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/20 p-4">
                  <div className="flex items-center gap-2">
                    <FunctionSquare className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">公式配置</p>
                  </div>

                  {/* 常用公式模板 */}
                  <div className="grid gap-2">
                    <Label>常用公式模板</Label>
                    <div className="grid gap-1.5">
                      {formulaTemplates.map((tpl, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="justify-start text-xs h-auto py-1.5"
                          onClick={() => {
                            setNewFormulaExpression(tpl.expression);
                            setNewFormulaDescription(tpl.description);
                          }}
                        >
                          <span className="font-medium">{tpl.label}</span>
                          <span className="text-muted-foreground ml-2">— {tpl.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-formula-expression">公式表达式</Label>
                    <Input
                      id="new-formula-expression"
                      value={newFormulaExpression}
                      onChange={(e) => setNewFormulaExpression(e.target.value)}
                      placeholder="如 totalLaborCost / headcount 或 laborCost / totalRevenue * 100"
                    />
                    <p className="text-xs text-muted-foreground">
                      使用字段键名引用其他字段，支持 +、-、*、/ 和括号运算。点击上方模板快速填入。
                    </p>
                    {/* 显示可用字段列表 */}
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">可用字段：</p>
                      <div className="flex flex-wrap gap-1">
                        {currentFields.filter((f) => f.type !== 'formula' && f.key !== 'id').map((f) => (
                          <Badge
                            key={f.key}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/10"
                            onClick={() => setNewFormulaExpression(newFormulaExpression + (newFormulaExpression ? ' ' : '') + f.key)}
                          >
                            {f.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 公式验证结果 */}
                  {formulaValidation && (
                    <div className={`rounded-md p-2 ${formulaValidation.valid ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <div className="flex items-center gap-1.5">
                        {formulaValidation.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-xs font-medium ${formulaValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                          {formulaValidation.valid ? '公式验证通过' : '公式验证失败'}
                        </span>
                      </div>
                      {formulaValidation.errors.length > 0 && (
                        <ul className="text-xs text-red-500 mt-1 list-disc ml-4">
                          {formulaValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                      {formulaValidation.valid && formulaValidation.dependsOn.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          依赖字段: {formulaValidation.dependsOn.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="new-formula-precision">结果精度（小数位数）</Label>
                    <Input
                      id="new-formula-precision"
                      type="number"
                      min={0}
                      max={6}
                      value={newFormulaPrecision}
                      onChange={(e) => setNewFormulaPrecision(parseInt(e.target.value) || 2)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-formula-desc">公式描述/备注</Label>
                    <Input
                      id="new-formula-desc"
                      value={newFormulaDescription}
                      onChange={(e) => setNewFormulaDescription(e.target.value)}
                      placeholder="如 人力成本占总业绩的百分比"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-formula-suffix">数值后缀</Label>
                    <Input
                      id="new-formula-suffix"
                      value={newSuffix}
                      onChange={(e) => setNewSuffix(e.target.value)}
                      placeholder="如 万、%"
                    />
                  </div>
                </div>
              )}

              {newType !== 'formula' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="new-required" checked={newRequired} onCheckedChange={(v) => setNewRequired(v === true)} />
                    <Label htmlFor="new-required" className="cursor-pointer">必填</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="new-visible" checked={newVisibleInList} onCheckedChange={(v) => setNewVisibleInList(v === true)} />
                    <Label htmlFor="new-visible" className="cursor-pointer">列表中显示</Label>
                  </div>
                </div>
              )}

              {/* 公式字段默认列表可见 */}
              {newType === 'formula' && (
                <div className="flex items-center gap-2">
                  <Checkbox id="new-visible-f" checked={newVisibleInList} onCheckedChange={(v) => setNewVisibleInList(v === true)} />
                  <Label htmlFor="new-visible-f" className="cursor-pointer">列表中显示公式结果</Label>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFormOpen(false)}>取消</Button>
            <Button onClick={handleAddField} disabled={newType === 'formula' && formulaValidation !== null && !formulaValidation.valid}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑公式对话框 */}
      <Dialog open={editFormulaKey !== null} onOpenChange={(open) => !open && setEditFormulaKey(null)}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FunctionSquare className="h-5 w-5 text-blue-500" />
              编辑公式
            </DialogTitle>
            <DialogDescription>
              修改公式表达式和属性。公式字段值将根据其他字段自动计算。
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh]">
            <div className="grid gap-4 py-4 pr-3">
              {/* 常用公式模板 */}
              <div className="grid gap-2">
                <Label>常用公式模板</Label>
                <div className="grid gap-1.5">
                  {formulaTemplates.map((tpl, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="justify-start text-xs h-auto py-1.5"
                      onClick={() => {
                        setEditFormulaExpression(tpl.expression);
                        setEditFormulaDescription(tpl.description);
                      }}
                    >
                      <span className="font-medium">{tpl.label}</span>
                      <span className="text-muted-foreground ml-2">— {tpl.description}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-formula-expression">公式表达式</Label>
                <Input
                  id="edit-formula-expression"
                  value={editFormulaExpression}
                  onChange={(e) => setEditFormulaExpression(e.target.value)}
                  placeholder="如 totalLaborCost / headcount"
                />
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">可用字段：</p>
                  <div className="flex flex-wrap gap-1">
                    {currentFields.filter((f) => f.type !== 'formula' && f.key !== 'id').map((f) => (
                      <Badge
                        key={f.key}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-primary/10"
                        onClick={() => setEditFormulaExpression(editFormulaExpression + (editFormulaExpression ? ' ' : '') + f.key)}
                      >
                        {f.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* 公式验证 */}
              {editFormulaExpression.trim() && (() => {
                const v = validateFormulaExpression(editFormulaExpression, currentFields);
                return (
                  <div className={`rounded-md p-2 ${v.valid ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                    <div className="flex items-center gap-1.5">
                      {v.valid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                      <span className={`text-xs font-medium ${v.valid ? 'text-green-600' : 'text-red-600'}`}>
                        {v.valid ? '公式验证通过' : '公式验证失败'}
                      </span>
                    </div>
                    {v.errors.length > 0 && (
                      <ul className="text-xs text-red-500 mt-1 list-disc ml-4">
                        {v.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                    {v.valid && v.dependsOn.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        依赖字段: {v.dependsOn.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="grid gap-2">
                <Label htmlFor="edit-formula-precision">结果精度</Label>
                <Input
                  id="edit-formula-precision"
                  type="number"
                  min={0}
                  max={6}
                  value={editFormulaPrecision}
                  onChange={(e) => setEditFormulaPrecision(parseInt(e.target.value) || 2)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-formula-desc">公式描述/备注</Label>
                <Input
                  id="edit-formula-desc"
                  value={editFormulaDescription}
                  onChange={(e) => setEditFormulaDescription(e.target.value)}
                  placeholder="如 人力成本占总业绩的百分比"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFormulaKey(null)}>取消</Button>
            <Button
              onClick={handleSaveFormula}
              disabled={!editFormulaExpression.trim() || (() => {
                const v = validateFormulaExpression(editFormulaExpression, currentFields);
                return !v.valid;
              })()}
            >
              保存公式
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑字段对话框（全属性编辑） */}
      <Dialog open={editFieldKey !== null} onOpenChange={(open) => !open && setEditFieldKey(null)}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              编辑字段
            </DialogTitle>
            <DialogDescription>
              修改字段属性。字段键名不可更改，其他属性均可编辑。已有数据不会丢失。
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-4 pr-3">
              {/* 字段键名（只读） */}
              <div className="grid gap-2">
                <Label>字段键名（不可修改）</Label>
                <Input value={editFieldKey ?? ''} disabled className="bg-muted/50 font-mono text-sm" />
              </div>

              {/* 显示标签 */}
              <div className="grid gap-2">
                <Label htmlFor="edit-label">显示标签</Label>
                <Input id="edit-label" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="如 自定义指标(万)" />
              </div>

              {/* 字段类型 */}
              <div className="grid gap-2">
                <Label>字段类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['number', 'string', 'enum', 'text', 'formula'] as FieldType[]).map((t) => (
                    <Button
                      key={t}
                      variant={editType === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditType(t)}
                      className={`justify-start ${editType === 'formula' && t === 'formula' ? 'bg-blue-500 text-white' : ''}`}
                    >
                      {t === 'formula' && <FunctionSquare className="mr-1.5 h-3.5 w-3.5" />}
                      {fieldTypeLabels[t]}
                    </Button>
                  ))}
                </div>
                {(editType !== editType) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    修改字段类型可能影响已有数据的显示
                  </p>
                )}
              </div>

              {/* 枚举选项 */}
              {editType === 'enum' && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-enum">枚举选项（逗号分隔）</Label>
                  <Input id="edit-enum" value={editEnumValues} onChange={(e) => setEditEnumValues(e.target.value)} placeholder="如 选项A,选项B,选项C" />
                </div>
              )}

              {/* 数值后缀 */}
              {(editType === 'number' || editType === 'formula') && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-suffix">数值后缀</Label>
                  <Input id="edit-suffix" value={editSuffix} onChange={(e) => setEditSuffix(e.target.value)} placeholder="如 万、%" />
                </div>
              )}

              {/* 公式字段配置 */}
              {editType === 'formula' && (
                <div className="space-y-4 rounded-md border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/20 p-4">
                  <div className="flex items-center gap-2">
                    <FunctionSquare className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">公式配置</p>
                  </div>

                  {/* 常用公式模板 */}
                  <div className="grid gap-2">
                    <Label>常用公式模板</Label>
                    <div className="grid gap-1.5">
                      {formulaTemplates.map((tpl, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="justify-start text-xs h-auto py-1.5"
                          onClick={() => {
                            setEditFormulaExpr(tpl.expression);
                            setEditFormulaDesc(tpl.description);
                          }}
                        >
                          <span className="font-medium">{tpl.label}</span>
                          <span className="text-muted-foreground ml-2">— {tpl.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-formula-expr">公式表达式</Label>
                    <Input
                      id="edit-formula-expr"
                      value={editFormulaExpr}
                      onChange={(e) => setEditFormulaExpr(e.target.value)}
                      placeholder="如 totalLaborCost / headcount"
                    />
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">可用字段：</p>
                      <div className="flex flex-wrap gap-1">
                        {currentFields.filter((f) => f.type !== 'formula' && f.key !== 'id' && f.key !== editFieldKey).map((f) => (
                          <Badge
                            key={f.key}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/10"
                            onClick={() => setEditFormulaExpr(editFormulaExpr + (editFormulaExpr ? ' ' : '') + f.key)}
                          >
                            {f.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 公式验证 */}
                  {editFormulaValidation && (
                    <div className={`rounded-md p-2 ${editFormulaValidation.valid ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <div className="flex items-center gap-1.5">
                        {editFormulaValidation.valid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                        <span className={`text-xs font-medium ${editFormulaValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                          {editFormulaValidation.valid ? '公式验证通过' : '公式验证失败'}
                        </span>
                      </div>
                      {editFormulaValidation.errors.length > 0 && (
                        <ul className="text-xs text-red-500 mt-1 list-disc ml-4">
                          {editFormulaValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                      {editFormulaValidation.valid && editFormulaValidation.dependsOn.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">依赖字段: {editFormulaValidation.dependsOn.join(', ')}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="edit-formula-prec2">结果精度（小数位数）</Label>
                    <Input
                      id="edit-formula-prec2"
                      type="number"
                      min={0}
                      max={6}
                      value={editFormulaPrec}
                      onChange={(e) => setEditFormulaPrec(parseInt(e.target.value) || 2)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-formula-desc2">公式描述/备注</Label>
                    <Input
                      id="edit-formula-desc2"
                      value={editFormulaDesc}
                      onChange={(e) => setEditFormulaDesc(e.target.value)}
                      placeholder="如 人力成本占总业绩的百分比"
                    />
                  </div>
                </div>
              )}

              {/* 必填 + 列表可见 */}
              {editType !== 'formula' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-required" checked={editRequired} onCheckedChange={(v) => setEditRequired(v === true)} />
                    <Label htmlFor="edit-required" className="cursor-pointer">必填</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-visible-list" checked={editVisibleInList} onCheckedChange={(v) => setEditVisibleInList(v === true)} />
                    <Label htmlFor="edit-visible-list" className="cursor-pointer">列表中显示</Label>
                  </div>
                </div>
              )}

              {editType === 'formula' && (
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-visible-f" checked={editVisibleInList} onCheckedChange={(v) => setEditVisibleInList(v === true)} />
                  <Label htmlFor="edit-visible-f" className="cursor-pointer">列表中显示公式结果</Label>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFieldKey(null)}>取消</Button>
            <Button
              onClick={handleSaveField}
              disabled={editType === 'formula' && editFormulaValidation !== null && !editFormulaValidation.valid}
            >
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteKey !== null} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除此字段？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，已有数据中对应字段的值将不再在表单和列表中显示，但数据本身不会丢失。此操作可通过"恢复默认配置"撤回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteKey(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
