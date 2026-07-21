import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, FunctionSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useFieldConfig } from '@/contexts/FieldConfigContext';
import { useToast } from '@/hooks/use-toast';
import { getAllFormFields } from '@/types/fieldConfig';
import { computeFormulaFields } from '@/utils/formulaEngine';
import { isSystemCalculatedField, prepareSalaryFormValues } from '@/utils/salaryCalculations';
import type { DataType } from '@/types';
import type { FieldDef } from '@/types/fieldConfig';
import type { AuthUser } from '@/lib/api';
import { canWriteDataType } from '@/lib/permissions';

const dataTypeLabels: Record<DataType, string> = {
  overview: '月度总览',
  department: '部门数据',
  composition: '成本构成',
  position: '职级数据',
  store: '门店/区域数据',
  budget: '预算人力成本',
  costStructure: '人力成本组成',
};

function generateId(type: DataType, values: Record<string, unknown>) {
  const month = String(values.month ?? '2026-05');
  const rand = Math.random().toString(36).slice(2, 7);
  switch (type) {
    case 'overview':
      return `ov-${month}-${rand}`;
    case 'department':
      return `dept-${month}-${rand}`;
    case 'composition':
      return `cost-${month}-${rand}`;
    case 'position':
      return `pos-${month}-${rand}`;
    case 'store':
      return `store-${month}-${rand}`;
    case 'budget':
      return `bud-${month}-${rand}`;
    case 'costStructure':
      return `cs-${month}-${rand}`;
  }
}

function validateField(field: FieldDef, value: unknown): string | undefined {
  const strVal = value === undefined || value === null ? '' : String(value).trim();

  if (field.type === 'formula') return undefined; // 公式字段不需要校验

  if (field.required && strVal === '') {
    return `${field.label} 不能为空`;
  }

  if (!field.required && strVal === '') return undefined;

  if (field.type === 'number') {
    const num = parseFloat(strVal);
    if (Number.isNaN(num)) return `${field.label} 不是有效数字`;
  }

  if (field.type === 'enum' && field.enumValues) {
    if (!field.enumValues.includes(strVal)) {
      return `${field.label} 值不在可选范围: ${field.enumValues.join('/')}`;
    }
  }

  if (field.key === 'month' && !/^\d{4}-\d{2}$/.test(strVal)) {
    return '月份格式应为 YYYY-MM';
  }

  return undefined;
}

export function DataFormPage({ user }: { user: AuthUser }) {
  const { type, id } = useParams<{ type: DataType; id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getItem, addItem, updateItem } = useData();
  const { getFields } = useFieldConfig();

  if (!type || !(type in dataTypeLabels)) {
    return <div className="p-8 text-center">无效的数据类型</div>;
  }

  if (!canWriteDataType(user, type)) {
    return <Navigate to="/data" replace />;
  }

  const isNew = id === 'new';
  const existing = !isNew ? getItem(type, id!) : undefined;
  const title = `${isNew ? '新增' : '编辑'}${dataTypeLabels[type]}`;

  const allFields = useMemo(() => getAllFormFields(getFields(type)), [type, getFields]);
  const editableFields = useMemo(() => allFields.filter((f) => f.type !== 'formula'), [allFields]);
  const formulaFields = useMemo(() => allFields.filter((f) => f.type === 'formula'), [allFields]);

  // 构建 defaultValues
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (existing && (existing as Record<string, unknown>)[field.key] !== undefined) {
        values[field.key] = (existing as Record<string, unknown>)[field.key];
      } else {
        switch (field.type) {
          case 'number':
            values[field.key] = 0;
            break;
          case 'enum':
            values[field.key] = field.enumValues?.[0] ?? '';
            break;
          case 'string':
            values[field.key] = field.key === 'month' ? '2026-05' : '';
            break;
          case 'text':
            values[field.key] = '';
            break;
        }
      }
    }
    return values;
  }, [editableFields, existing]);

  const form = useForm<Record<string, unknown>>({
    defaultValues,
    mode: 'onBlur',
  });

  // 计算公式字段的值（实时）- 使用 liveFormulaResults 替代

  // 重新计算公式当表单值变化时
  useEffect(() => {
    if (existing) {
      form.reset(existing as Record<string, unknown>);
    }
  }, [existing, form]);

  const onSubmit = async (values: Record<string, unknown>) => {
    const preparedValues = prepareSalaryFormValues(type, values);

    // 校验所有可编辑字段；系统固定公式字段保存时统一重算，不允许手工值影响结果
    const errors: string[] = [];
    for (const field of editableFields) {
      if (isSystemCalculatedField(type, field.key)) continue;
      const err = validateField(field, preparedValues[field.key]);
      if (err) errors.push(err);
    }
    if (errors.length > 0) {
      toast({ title: '数据校验失败', description: errors.join('; '), variant: 'destructive' });
      return;
    }

    // 将 number 类型字段从字符串转为数字，避免保存后总览页面出现 toFixed 错误
    const convertedValues: Record<string, unknown> = { ...preparedValues };
    for (const field of editableFields) {
      if (field.type === 'number') {
        const raw = convertedValues[field.key];
        if (raw === '' || raw === null || raw === undefined) {
          convertedValues[field.key] = 0;
        } else {
          const num = parseFloat(String(raw).replace(/,/g, ''));
          convertedValues[field.key] = Number.isNaN(num) ? 0 : num;
        }
      }
    }

    // 计算公式字段值并合并
    const computedFormulaValues = computeFormulaFields(convertedValues, allFields);
    const finalValues = { ...convertedValues, ...computedFormulaValues };

    try {
      if (isNew) {
        const newId = generateId(type, finalValues);
        await addItem(type, { ...finalValues, id: newId });
        toast({ title: '新增成功' });
      } else {
        await updateItem(type, id!, { ...finalValues, id });
        toast({ title: '更新成功' });
      }
      navigate('/data');
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '服务器数据写入失败',
        variant: 'destructive',
      });
    }
  };

  const { register, formState } = form;
  const getError = (key: string) => formState.errors[key]?.message as string | undefined;

  // 实时刷新公式值
  const watchedValues = form.watch();
  const liveFormulaResults = useMemo(() => {
    const combinedData = { ...existing as Record<string, unknown> | undefined, ...watchedValues };
    return computeFormulaFields(combinedData as Record<string, unknown>, allFields);
  }, [watchedValues, allFields, existing]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate('/data')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dataTypeLabels[type]}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 可编辑字段 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {editableFields.map((field) => {
                const isCalculated = isSystemCalculatedField(type, field.key);
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                      {isCalculated && <Badge variant="outline" className="ml-2 text-xs">固定公式</Badge>}
                    </Label>
                    {field.type === 'enum' && field.enumValues ? (
                      <select
                        id={field.key}
                        {...register(field.key)}
                        disabled={isCalculated}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {field.enumValues.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'text' ? (
                      <textarea
                        id={field.key}
                        {...register(field.key)}
                        rows={3}
                        disabled={isCalculated}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type === 'number' ? 'number' : 'text'}
                        step={field.type === 'number' ? '0.01' : undefined}
                        {...register(field.key)}
                        disabled={isCalculated}
                      />
                    )}
                    {isCalculated && <p className="text-xs text-muted-foreground">保存后按系统固定公式自动计算。</p>}
                    {getError(field.key) && <p className="text-xs text-destructive">{getError(field.key)}</p>}
                  </div>
                );
              })}
            </div>

            {/* 公式字段（只读，自动计算） */}
            {formulaFields.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pt-4 border-t">
                  <FunctionSquare className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium text-blue-600">公式计算结果（自动生成，不可手动编辑）</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {formulaFields.map((field) => {
                    const result = liveFormulaResults[field.key];
                    const displayValue = result !== null ? `${result}${field.suffix ? ` ${field.suffix}` : ''}` : '--';
                    return (
                      <div key={field.key} className="space-y-2 rounded-md border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/20 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <FunctionSquare className="h-3.5 w-3.5 text-blue-500" />
                          <Label className="text-sm text-blue-700 dark:text-blue-300 cursor-default">
                            {field.label}
                          </Label>
                          {field.formula && (
                            <Badge variant="outline" className="text-xs border-blue-300/50 text-blue-600">
                              = {field.formula.expression}
                            </Badge>
                          )}
                        </div>
                        <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                          {displayValue}
                        </div>
                        {field.formula?.description && (
                          <p className="text-xs text-muted-foreground">{field.formula.description}</p>
                        )}
                        {result === null && (
                          <p className="text-xs text-red-500">计算失败（依赖字段值为空或无效）</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                保存
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/data')}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
