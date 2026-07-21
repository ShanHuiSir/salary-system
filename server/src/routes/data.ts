import { Router, type Request, type Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, fail, serverError } from '../utils/response.js';
import {
  authenticate,
  DATA_READ_ROLES,
  canDeleteDataType,
  canWriteDataType,
  requireRole,
} from '../middleware/auth.js';
import { auditLog } from '../middleware/auditLog.js';
import { normalizeSalaryData } from '../services/salaryCalculator.js';
import { formatZodError, validateDataRecord, type ServerDataType } from '../schemas/data.js';

export const dataRouter = Router();

dataRouter.use(authenticate);

type PrismaDelegateName =
  | 'monthlyOverview'
  | 'department'
  | 'costComposition'
  | 'positionLevel'
  | 'storeRegion'
  | 'budgetLaborCost'
  | 'costStructure'
  | 'hqBusinessLine'
  | 'hqDept'
  | 'platform';

type ModelConfig = {
  model: PrismaDelegateName;
  tableName: string;
  searchFields: string[];
};

const MODEL_MAP: Record<ServerDataType, ModelConfig> = {
  overview:       { model: 'monthlyOverview', tableName: 'monthly_overviews', searchFields: ['month'] },
  department:     { model: 'department',      tableName: 'departments', searchFields: ['month', 'department'] },
  composition:    { model: 'costComposition', tableName: 'cost_compositions', searchFields: ['month', 'department'] },
  position:       { model: 'positionLevel',   tableName: 'position_levels', searchFields: ['month', 'department', 'level'] },
  store:          { model: 'storeRegion',     tableName: 'store_regions', searchFields: ['month', 'region'] },
  budget:         { model: 'budgetLaborCost', tableName: 'budget_labor_costs', searchFields: ['month', 'segment', 'center', 'department', 'businessLine'] },
  costStructure:  { model: 'costStructure',   tableName: 'cost_structures', searchFields: ['month', 'segment'] },
  hqBusinessLine: { model: 'hqBusinessLine',  tableName: 'hq_business_lines', searchFields: ['month', 'businessLine'] },
  hqDept:         { model: 'hqDept',          tableName: 'hq_depts', searchFields: ['month', 'department'] },
  platform:       { model: 'platform',        tableName: 'platforms', searchFields: ['month', 'platform'] },
};

function getModel(dataType: string): ModelConfig {
  if (!(dataType in MODEL_MAP)) throw new Error(`未知数据类型: ${dataType}`);
  return MODEL_MAP[dataType as ServerDataType];
}

function isServerDataType(dataType: string): dataType is ServerDataType {
  return dataType in MODEL_MAP;
}

function getDelegate(model: PrismaDelegateName) {
  return prisma[model] as unknown as {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    count: (args?: unknown) => Promise<number>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
    createMany: (args: unknown) => Promise<{ count: number }>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany: (args?: unknown) => Promise<{ count: number }>;
  };
}

function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') throw new Error(`无效路由参数: ${name}`);
  return value;
}

function getDataType(req: Request, res: Response): ServerDataType | null {
  const dataType = getRouteParam(req, 'dataType');
  if (!isServerDataType(dataType)) {
    fail(res, 1001, '未知数据类型');
    return null;
  }
  return dataType;
}

function getDataTableName(req: Request): string | null {
  const dataType = req.params.dataType;
  return typeof dataType === 'string' && isServerDataType(dataType) ? MODEL_MAP[dataType].tableName : null;
}

function requireDataWriteAccess(req: Request, res: Response, next: () => void) {
  const dataType = getRouteParam(req, 'dataType');
  if (!isServerDataType(dataType) || !req.user || !canWriteDataType(req.user, dataType)) {
    return fail(res, 1003, '当前角色无权写入此数据类型', 403);
  }
  next();
}

function requireDataDeleteAccess(req: Request, res: Response, next: () => void) {
  const dataType = getRouteParam(req, 'dataType');
  if (!isServerDataType(dataType) || !req.user || !canDeleteDataType(req.user, dataType)) {
    return fail(res, 1003, '当前角色无权删除此数据类型', 403);
  }
  next();
}

function parseRecord(dataType: ServerDataType, input: unknown): { data?: Record<string, unknown>; message?: string } {
  const parsed = validateDataRecord(dataType, input);
  if (!parsed.success) return { message: formatZodError(parsed.error) };
  return { data: parsed.data as Record<string, unknown> };
}

async function normalizeAfterWrite(dataType: ServerDataType, months: Iterable<string>) {
  if (!['overview', 'department', 'position', 'store'].includes(dataType)) return;
  for (const month of new Set(months)) await normalizeSalaryData(dataType, month);
}

function parsePagination(value: unknown, defaultValue: number, max: number) {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, parsed)) : defaultValue;
}

dataRouter.get('/:dataType', requireRole(...DATA_READ_ROLES), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const { model, searchFields } = getModel(dataType);
    const { month, search, page = '1', pageSize = '50', sortBy = 'month', sortOrder = 'desc' } = req.query;
    const pageNum = parsePagination(page, 1, Number.MAX_SAFE_INTEGER);
    const size = parsePagination(pageSize, 50, 200);
    const where: Record<string, unknown> = {};

    if (typeof month === 'string') where.month = month;
    for (const field of searchFields) {
      if (typeof req.query[field] === 'string') where[field] = req.query[field];
    }
    if (typeof search === 'string' && search.trim()) {
      where.OR = searchFields.map((field) => ({ [field]: { contains: search.trim(), mode: 'insensitive' } }));
    }

    const allowedSortFields = new Set(['id', 'createdAt', 'updatedAt', ...searchFields]);
    const safeSortBy = typeof sortBy === 'string' && allowedSortFields.has(sortBy) ? sortBy : 'month';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const delegate = getDelegate(model);
    const [list, total] = await Promise.all([
      delegate.findMany({ where, orderBy: { [safeSortBy]: safeSortOrder }, skip: (pageNum - 1) * size, take: size }),
      delegate.count({ where }),
    ]);

    return success(res, { list, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.get('/:dataType/:id', requireRole(...DATA_READ_ROLES), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const { model } = getModel(dataType);
    const record = await getDelegate(model).findUnique({ where: { id: getRouteParam(req, 'id') } });
    if (!record) return fail(res, 1004, '记录不存在', 404);
    return success(res, record);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.post('/:dataType', requireDataWriteAccess, auditLog('create', getDataTableName), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const parsed = parseRecord(dataType, req.body);
    if (!parsed.data) return fail(res, 1001, parsed.message ?? '数据格式无效');

    const { model } = getModel(dataType);
    const data: Record<string, unknown> = { ...parsed.data, createdBy: req.user!.username };
    const record = await getDelegate(model).create({ data });
    const recordMonth = data['month'];
    await normalizeAfterWrite(dataType, typeof recordMonth === 'string' ? [recordMonth] : []);
    return success(res, record, '创建成功');
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.post('/:dataType/batch', requireDataWriteAccess, auditLog('import', getDataTableName), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const { items, skipInvalid = true } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) return fail(res, 1001, 'items 必须是非空数组');
    if (items.length > 5_000) return fail(res, 1001, '单次最多导入 5000 条记录');

    const validItems: Record<string, unknown>[] = [];
    const errors: { index: number; message: string }[] = [];
    for (let index = 0; index < items.length; index++) {
      const parsed = parseRecord(dataType, items[index]);
      if (!parsed.data) {
        errors.push({ index, message: parsed.message ?? '数据格式无效' });
        if (!skipInvalid) return fail(res, 1001, `第 ${index + 1} 行导入失败: ${parsed.message}`);
        continue;
      }
      validItems.push({ ...parsed.data, createdBy: req.user!.username });
    }

    if (validItems.length === 0) {
      return success(res, { total: items.length, success: 0, skipped: errors.length, errors }, '没有可导入的有效数据');
    }

    // createMany 将导入从逐条 SQL 降为单次批量插入；skipInvalid=false 时由数据库事务确保全有或全无。
    const { model } = getModel(dataType);
    const result = await getDelegate(model).createMany({ data: validItems });
    const months = validItems.map((item) => item.month).filter((value): value is string => typeof value === 'string');
    await normalizeAfterWrite(dataType, months);
    return success(res, {
      total: items.length,
      success: result.count,
      skipped: errors.length,
      errors,
    }, `成功 ${result.count} 条，跳过 ${errors.length} 条`);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.put('/:dataType/:id', requireDataWriteAccess, auditLog('update', getDataTableName), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const parsed = parseRecord(dataType, req.body);
    if (!parsed.data) return fail(res, 1001, parsed.message ?? '数据格式无效');

    const { model } = getModel(dataType);
    const delegate = getDelegate(model);
    const id = getRouteParam(req, 'id');
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return fail(res, 1004, '记录不存在', 404);
    const record = await delegate.update({ where: { id }, data: parsed.data });
    const impactedMonths = [existing.month, record.month].filter((value): value is string => typeof value === 'string');
    await normalizeAfterWrite(dataType, impactedMonths);
    return success(res, record, '更新成功');
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.delete('/:dataType', requireRole('super_admin'), auditLog('clear', getDataTableName), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const { model } = getModel(dataType);
    const result = await getDelegate(model).deleteMany();
    return success(res, result, `已清空 ${result.count} 条记录`);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.delete('/:dataType/:id', requireDataDeleteAccess, auditLog('delete', getDataTableName), async (req: Request, res: Response) => {
  try {
    const dataType = getDataType(req, res);
    if (!dataType) return;
    const { model } = getModel(dataType);
    const delegate = getDelegate(model);
    const id = getRouteParam(req, 'id');
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return fail(res, 1004, '记录不存在', 404);
    await delegate.delete({ where: { id } });
    await normalizeAfterWrite(dataType, typeof existing.month === 'string' ? [existing.month] : []);
    return success(res, null, '删除成功');
  } catch (error) {
    return serverError(res, error);
  }
});
