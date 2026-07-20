import { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, FileDown, Eye, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, Loader2, FunctionSquare, Info, Lightbulb, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { DataType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useFieldConfig } from '@/contexts/FieldConfigContext';
import { getFormFields } from '@/types/fieldConfig';
import { computeFormulaFields } from '@/utils/formulaEngine';
import type { FieldDef } from '@/types/fieldConfig';
import { parseCsvText, generateImportId, type ParsedRow } from '@/utils/csvParser';
import { getCsvHeaderAliases } from '@/utils/fieldStandards';

const dataTypeLabels: Record<DataType, string> = {
  overview: '月度总览',
  department: '部门数据',
  composition: '成本构成',
  position: '职级数据',
  store: '门店/区域数据',
  budget: '预算人力成本',
  costStructure: '人力成本组成',
};

/** 从字段配置生成 CSV 列名映射 */
function fieldToCsvColumn(f: FieldDef): { csvHeader: string; fieldKey: string; required: boolean; type: string; enumValues?: string[]; label: string } {
  return {
    csvHeader: f.label,
    fieldKey: f.key,
    required: f.required,
    type: f.type === 'text' ? 'string' : f.type === 'formula' ? 'formula' : f.type,
    enumValues: f.enumValues,
    label: f.label,
  };
}

/** 列匹配结果 */
interface ColumnMatchResult {
  matched: { csvHeader: string; fieldKey: string; label: string; required: boolean }[];
  missing: { csvHeader: string; fieldKey: string; label: string }[];     // 必填但未匹配
  unknown: string[]; // CSV 中存在但系统不认识的列
}

/** 解析结果（含结构性错误和行级错误） */
interface ParseResult {
  rows: ParsedRow[];
  columnMatch: ColumnMatchResult;
  structuralErrors: string[];
  warnings: string[];
  totalRows: number;
  emptyRows: number;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataType: DataType;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';

export function ImportDialog({ open, onOpenChange, dataType }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skipped: number; errorMsg?: string }>({ success: 0, failed: 0, skipped: 0 });
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { batchAddItems } = useData();
  const { getFields } = useFieldConfig();

  const formFields = useMemo(() => getFormFields(getFields(dataType)), [dataType, getFields]);
  const allFields = useMemo(() => getFields(dataType), [dataType, getFields]);
  const formulaFields = useMemo(() => allFields.filter((f) => f.type === 'formula'), [allFields]);
  const csvColumns = useMemo(() => formFields.map(fieldToCsvColumn), [formFields]);

  const resetState = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    setSkipInvalid(true);
    setImportResult({ success: 0, failed: 0, skipped: 0 });
    setFileName('');
    setFileError(null);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  const handleDownloadTemplate = useCallback(() => {
    // 生成含 BOM 的 UTF-8 CSV（Excel 兼容）
    const headers = csvColumns.map((c) => c.csvHeader);
    const exampleRow = csvColumns.map((c) => {
      if (c.type === 'enum' && c.enumValues) return c.enumValues[0];
      if (c.type === 'number') return '0';
      if (c.fieldKey === 'month') return '2026-05';
      if (c.fieldKey === 'segment') return '总部';
      if (c.fieldKey === 'department') return '总部';
      if (c.fieldKey === 'center') return '品牌中心';
      if (c.fieldKey === 'businessLine') return '品牌管理';
      return '示例';
    });
    const content = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataTypeLabels[dataType]}_导入模板.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [dataType, csvColumns]);

  /** 读取文件，自动检测编码（UTF-8 → GBK 回退） */
  const readFileWithEncoding = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error('文件内容为空'));
          return;
        }

        // 先尝试 UTF-8
        const utf8Text = new TextDecoder('utf-8').decode(arrayBuffer);

        // 检查是否有 BOM
        const hasBOM = utf8Text.charCodeAt(0) === 0xFEFF;

        // 简单检测是否有乱码：UTF-8 解码后如果出现大量替换字符(�)，可能是 GBK
        const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;

        if (replacementCount > 3) {
          // 可能是 GBK 编码，尝试用 GBK 解码
          try {
            const gbkText = new TextDecoder('gbk').decode(arrayBuffer);
            resolve(gbkText);
          } catch {
            // GBK 解码失败，回退到 UTF-8
            resolve(hasBOM ? utf8Text.slice(1) : utf8Text);
          }
        } else {
          resolve(hasBOM ? utf8Text.slice(1) : utf8Text);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败，请检查文件是否被其他程序占用'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置状态
    setFileError(null);
    setParseResult(null);

    // 文件验证
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setFileError(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 10MB`);
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      setFileError(`不支持的文件格式 ".${ext}"，请上传 .csv 格式文件`);
      e.target.value = '';
      return;
    }

    if (file.size === 0) {
      setFileError('文件内容为空，请检查文件');
      e.target.value = '';
      return;
    }

    setFileName(file.name);

    try {
      const text = await readFileWithEncoding(file);

      if (!text || text.trim().length === 0) {
        setFileError('文件内容为空，请检查文件内容');
        e.target.value = '';
        return;
      }

      const { headers, rows } = parseCsvText(text);

      if (headers.length === 0) {
        setFileError('CSV 文件没有表头行（第一行），请确保第一行是列名');
        e.target.value = '';
        return;
      }

      if (rows.length === 0) {
        setFileError('CSV 文件只有表头行，没有数据行，请添加至少一行数据');
        e.target.value = '';
        return;
      }

      // 分析列匹配
      const result = parseWithConfig(csvColumns, headers, rows);
      setParseResult(result);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setFileError(`文件解析失败：${msg}`);
    }

    e.target.value = '';
  }, [csvColumns, readFileWithEncoding]);

  const handleImport = useCallback(async () => {
    setStep('importing');

    const validRows = parseResult?.rows.filter((r) => r.errors.length === 0) ?? [];
    const invalidRows = parseResult?.rows.filter((r) => r.errors.length > 0) ?? [];
    const rowsToImport = skipInvalid ? validRows : (parseResult?.rows ?? []);

    const items = rowsToImport.map((r) => {
      const formulaValues = computeFormulaFields(r.data, allFields);
      return {
        ...r.data,
        ...formulaValues,
        id: generateImportId(dataType, r.data),
      };
    });

    let successCount = 0;
    let failedCount = 0;
    let errorMsg: string | undefined;

    try {
      await batchAddItems(dataType, items);
      successCount = items.length;
      if (!skipInvalid) {
        successCount = validRows.length;
        failedCount = invalidRows.length;
      }
    } catch (err) {
      failedCount = items.length;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    setImportResult({
      success: successCount,
      failed: failedCount,
      skipped: skipInvalid ? invalidRows.length : 0,
      errorMsg,
    });
    setStep('result');
  }, [parseResult, skipInvalid, dataType, batchAddItems, allFields]);

  const validCount = parseResult?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = parseResult?.rows.filter((r) => r.errors.length > 0).length ?? 0;
  const emptyRowCount = parseResult?.emptyRows ?? 0;

  // 错误分类统计
  const errorCategories = useMemo(() => {
    if (!parseResult) return [];
    const cats = new Map<string, { type: string; count: number; samples: string[] }>();
    for (const row of parseResult.rows) {
      for (const err of row.errors) {
        let category = '其他';
        if (err.includes('不能为空')) category = '必填字段为空';
        else if (err.includes('不是有效数字')) category = '数字格式错误';
        else if (err.includes('不在可选范围')) category = '枚举值不匹配';
        const existing = cats.get(category);
        if (existing) {
          existing.count++;
          if (existing.samples.length < 3) existing.samples.push(err);
        } else {
          cats.set(category, { type: category, count: 1, samples: [err] });
        }
      }
    }
    return Array.from(cats.values()).sort((a, b) => b.count - a.count);
  }, [parseResult]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            批量导入 - {dataTypeLabels[dataType]}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && '上传 CSV 文件批量导入数据，支持按模板格式导入'}
            {step === 'preview' && '预览解析结果，确认无误后执行导入'}
            {step === 'importing' && '正在导入数据...'}
            {step === 'result' && '导入完成'}
          </DialogDescription>
        </DialogHeader>

        {/* ==================== 上传步骤 ==================== */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* 文件错误提示 */}
            {fileError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">文件无法导入</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fileError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 下载模板 */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <FileDown className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium">第一步：下载导入模板</p>
                  <p className="text-xs text-muted-foreground">
                    下载模板文件，按模板格式填写数据后再上传。模板已含列头和示例行。
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <FileDown className="mr-1.5 h-4 w-4" />
                  下载模板
                </Button>
              </div>
            </div>

            {/* CSV 列说明 */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">CSV 列说明（共 {csvColumns.length} 列）</p>
              </div>
              <div className="grid gap-1.5 text-xs">
                {csvColumns.map((c) => (
                  <div key={c.fieldKey} className="flex items-center gap-2 flex-wrap">
                    <Badge variant={c.required ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                      {c.required ? '必填' : '可选'}
                    </Badge>
                    <span className="font-medium">{c.csvHeader}</span>
                    <span className="text-muted-foreground">
                      类型: {c.type === 'number' ? '数字' : c.type === 'enum' ? '枚举' : '文本'}
                      {c.enumValues && ` — 可选值: ${c.enumValues.join('/')}`}
                    </span>
                  </div>
                ))}
              </div>
              {/* 公式字段提示 */}
              {formulaFields.length > 0 && (
                <div className="mt-3 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FunctionSquare className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600">公式字段（导入后自动计算，无需填写）</span>
                  </div>
                  {formulaFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-1.5 text-xs text-blue-600 ml-2">
                      <span className="font-medium">{f.label}</span>
                      {f.formula && <span className="text-muted-foreground">= {f.formula.expression}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 上传区域 */}
            <div
              className="rounded-lg border-2 border-dashed hover:border-primary/50 transition-colors p-8 flex flex-col items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">点击上传 CSV 文件</p>
              <p className="text-xs text-muted-foreground mt-1">支持 .csv 格式，UTF-8 或 GBK 编码，最大 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* 使用提示 */}
            <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-950/10 p-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-medium">常见问题</p>
                  <ul className="space-y-1 ml-3">
                    <li>• Excel 另存为 CSV 时，请选择「CSV UTF-8 (逗号分隔)」格式</li>
                    <li>• CSV 第一行必须是列名，需与上方「CSV 列说明」中的列名一致</li>
                    <li>• 数字字段不要包含逗号或单位（如不要写 "1,200万"，直接写 "1200"）</li>
                    <li>• 枚举字段的值必须完全匹配可选值（如"总部"而非"总部中心"）</li>
                    <li>• 公式字段无需填写，系统会根据其他字段自动计算</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 预览步骤 ==================== */}
        {step === 'preview' && parseResult && (
          <div className="space-y-4">
            {/* 文件信息 */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="outline">{parseResult.totalRows} 行</Badge>
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                {validCount} 行有效
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
                  {invalidCount} 行有误
                </Badge>
              )}
              {emptyRowCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {emptyRowCount} 行空行已跳过
                </Badge>
              )}
            </div>

            {/* 结构性错误提示（全局问题） */}
            {parseResult.structuralErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">文件结构问题</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-2">
                      以下问题影响所有数据行，请修正 CSV 文件后重新上传：
                    </p>
                    <ul className="space-y-1.5">
                      {parseResult.structuralErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                          <span className="text-red-400">•</span>
                          <span>{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 列匹配诊断 */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">列匹配结果</p>
              </div>
              <div className="space-y-2">
                {/* 已匹配的列 */}
                {parseResult.columnMatch.matched.length > 0 && (
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已识别 {parseResult.columnMatch.matched.length} 列
                    </p>
                    <div className="flex flex-wrap gap-1.5 ml-5">
                      {parseResult.columnMatch.matched.map((c) => (
                        <Badge key={c.fieldKey} variant="outline" className="text-xs bg-green-500/5 border-green-500/20">
                          {c.csvHeader}
                          {c.required && <span className="text-red-500 ml-1">*</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* 缺失的必填列 */}
                {parseResult.columnMatch.missing.length > 0 && (
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      缺少 {parseResult.columnMatch.missing.length} 个必填列
                    </p>
                    <div className="flex flex-wrap gap-1.5 ml-5">
                      {parseResult.columnMatch.missing.map((c) => (
                        <Badge key={c.fieldKey} variant="outline" className="text-xs bg-red-500/5 border-red-500/20 text-red-600">
                          {c.csvHeader}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground ml-5 mt-1">
                      请在 CSV 中添加以上列（列名需与上方显示一致）
                    </p>
                  </div>
                )}
                {/* 未识别的多余列 */}
                {parseResult.columnMatch.unknown.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {parseResult.columnMatch.unknown.length} 个未识别的列（将忽略）
                    </p>
                    <div className="flex flex-wrap gap-1.5 ml-5">
                      {parseResult.columnMatch.unknown.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-amber-500/5 border-amber-500/20 text-amber-600">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 警告提示 */}
            {parseResult.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-950/10 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {parseResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 错误分类统计 */}
            {errorCategories.length > 0 && (
              <Accordion type="single" collapsible className="rounded-lg border">
                <AccordionItem value="errors" className="border-0">
                  <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span>错误分类汇总（共 {invalidCount} 行有误）</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-3">
                      {errorCategories.map((cat) => (
                        <div key={cat.type} className="rounded-md border p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium">{cat.type}</span>
                            <Badge variant="destructive" className="text-xs">{cat.count} 处</Badge>
                          </div>
                          <div className="space-y-0.5">
                            {cat.samples.map((s, i) => (
                              <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                            ))}
                            {cat.count > cat.samples.length && (
                              <p className="text-xs text-muted-foreground italic">... 还有 {cat.count - cat.samples.length} 处类似错误</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* 跳过错误行选项 */}
            {invalidCount > 0 && (
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                <Checkbox
                  id="skip-invalid"
                  checked={skipInvalid}
                  onCheckedChange={(v) => setSkipInvalid(v === true)}
                />
                <label htmlFor="skip-invalid" className="text-sm cursor-pointer">
                  跳过有错误的行，只导入有效数据（{validCount} 行）
                </label>
              </div>
            )}

            {/* 数据预览表格 */}
            <ScrollArea className="h-[280px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-10">状态</TableHead>
                    {csvColumns.map((c) => (
                      <TableHead key={c.fieldKey} className="whitespace-nowrap">
                        {c.csvHeader}
                        {c.required && <span className="text-red-500 ml-0.5">*</span>}
                      </TableHead>
                    ))}
                    <TableHead className="whitespace-nowrap min-w-[200px]">错误详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.rows.map((row) => {
                    const isValid = row.errors.length === 0;
                    return (
                      <TableRow key={row.rowIndex} className={!isValid ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                        <TableCell>
                          {isValid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        </TableCell>
                        {csvColumns.map((c) => (
                          <TableCell key={c.fieldKey} className="whitespace-nowrap text-xs">
                            {row.data[c.fieldKey] !== undefined ? String(row.data[c.fieldKey]) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs">
                          {row.errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.errors.map((err, i) => (
                                <p key={i} className="text-red-500">{err}</p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-500">✓</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* ==================== 导入中 ==================== */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">正在导入数据...</p>
            <Progress value={50} className="max-w-xs mt-4" />
          </div>
        )}

        {/* ==================== 导入结果 ==================== */}
        {step === 'result' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              {importResult.failed === 0 && importResult.errorMsg === undefined ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">导入成功</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-3" />
                  <p className="text-lg font-medium">导入完成（部分失败）</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                <p className="text-xs text-muted-foreground">成功导入</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                <p className="text-xs text-muted-foreground">导入失败</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-muted-foreground">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">已跳过</p>
              </div>
            </div>

            {/* 导入失败详细原因 */}
            {importResult.errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">导入失败原因</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono bg-red-100/50 dark:bg-red-950/50 rounded p-2">
                      {importResult.errorMsg}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 导入成功提示 */}
            {importResult.failed === 0 && importResult.errorMsg === undefined && importResult.success > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">导入成功</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      成功导入 {importResult.success} 条数据，可在数据管理列表中查看。
                      {importResult.skipped > 0 && ` 已跳过 ${importResult.skipped} 条有误数据。`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>取消</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <Upload className="mr-1.5 h-4 w-4" />
                重新上传
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  (parseResult?.structuralErrors?.length ?? 0) > 0 ||
                  (skipInvalid && validCount === 0) ||
                  (!skipInvalid && (parseResult?.rows.length ?? 0) === 0)
                }
              >
                <Eye className="mr-1.5 h-4 w-4" />
                确认导入 ({skipInvalid ? validCount : parseResult?.rows.length ?? 0} 行)
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 使用动态字段配置解析 CSV 行，分离结构性错误和行级错误 */
function parseWithConfig(
  csvColumns: { csvHeader: string; fieldKey: string; required: boolean; type: string; enumValues?: string[]; label: string }[],
  csvHeaders: string[],
  csvRows: string[][]
): ParseResult {
  const structuralErrors: string[] = [];
  const warnings: string[] = [];
  const matched: ColumnMatchResult['matched'] = [];
  const missing: ColumnMatchResult['missing'] = [];
  const unknown: string[] = [];

  // 建立 header → column 映射：规范标签为唯一导出来源，同时兼容旧模板标签。
  const headerMap = new Map<string, typeof csvColumns[0]>();
  for (const c of csvColumns) {
    for (const header of getCsvHeaderAliases(c.fieldKey, c.csvHeader)) {
      headerMap.set(header, c);
    }
  }

  // 建立 csvHeaders 的索引映射
  const colIndexMap = new Map<number, typeof csvColumns[0]>();
  const matchedFieldKeys = new Set<string>();

  for (let i = 0; i < csvHeaders.length; i++) {
    const h = csvHeaders[i].trim();
    if (!h) continue;
    const col = headerMap.get(h);
    if (col) {
      colIndexMap.set(i, col);
      if (!matchedFieldKeys.has(col.fieldKey)) {
        matched.push({ csvHeader: col.csvHeader, fieldKey: col.fieldKey, label: col.label, required: col.required });
        matchedFieldKeys.add(col.fieldKey);
      }
    } else {
      unknown.push(h);
    }
  }

  // 检查缺失的必填列
  for (const c of csvColumns) {
    if (c.required && !matchedFieldKeys.has(c.fieldKey)) {
      missing.push({ csvHeader: c.csvHeader, fieldKey: c.fieldKey, label: c.label });
    }
  }

  // 生成结构性错误
  if (missing.length > 0) {
    const missingNames = missing.map((m) => `"${m.csvHeader}"`).join('、');
    structuralErrors.push(
      `CSV 文件中缺少 ${missing.length} 个必填列：${missingNames}。请确保第一行包含这些列名；系统同时兼容历史模板中的旧列名。`
    );
  }

  if (matched.length === 0) {
    structuralErrors.push(
      'CSV 文件中的列名与系统模板不匹配。请下载模板文件，使用模板中的列名。'
    );
  }

  // 检查未知列
  if (unknown.length > 0) {
    warnings.push(
      `CSV 中有 ${unknown.length} 个未识别的列（${unknown.map((u) => `"${u}"`).join('、')}），这些列的数据将被忽略。`
    );
  }

  // 解析数据行
  const rows: ParsedRow[] = [];
  let emptyRows = 0;

  for (let rowIdx = 0; rowIdx < csvRows.length; rowIdx++) {
    const row = csvRows[rowIdx];
    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    // 检查是否为空行
    const isEmpty = row.every((cell) => !cell || cell.trim() === '');
    if (isEmpty) {
      emptyRows++;
      continue;
    }

    for (let i = 0; i < row.length; i++) {
      const col = colIndexMap.get(i);
      if (!col) continue;

      const rawValue = row[i]?.trim() ?? '';

      // 空值处理
      if (rawValue === '' && !col.required) {
        data[col.fieldKey] = col.type === 'number' ? 0 : '';
        continue;
      }

      if (rawValue === '' && col.required) {
        errors.push(`${col.csvHeader}不能为空`);
        continue;
      }

      // 数字类型验证
      if (col.type === 'number') {
        // 去除可能的全角字符
        const cleaned = rawValue.replace(/，/g, ',').replace(/¥/g, '').replace(/万/g, '').replace(/%/g, '').trim();
        const num = parseFloat(cleaned);
        if (Number.isNaN(num)) {
          errors.push(`${col.csvHeader}的值 "${rawValue}" 不是有效数字（请去掉逗号、单位等符号）`);
        } else {
          data[col.fieldKey] = num;
        }
      } else if (col.type === 'enum' && col.enumValues) {
        if (!col.enumValues.includes(rawValue)) {
          // 模糊匹配建议
          const closest = col.enumValues.find((v) =>
            v.includes(rawValue) || rawValue.includes(v)
          );
          if (closest) {
            errors.push(`${col.csvHeader}的值 "${rawValue}" 不正确，是否想填 "${closest}"？（可选值: ${col.enumValues.join('/')}）`);
          } else {
            errors.push(`${col.csvHeader}的值 "${rawValue}" 不在可选范围内（可选值: ${col.enumValues.join('/')}）`);
          }
        } else {
          data[col.fieldKey] = rawValue;
        }
      } else {
        data[col.fieldKey] = rawValue;
      }
    }

    // 如果有结构性错误（缺少必填列），不为每行重复添加该错误
    rows.push({ data, errors, rowIndex: rowIdx + 1 });
  }

  return {
    rows,
    columnMatch: { matched, missing, unknown },
    structuralErrors,
    warnings,
    totalRows: csvRows.length,
    emptyRows,
  };
}
