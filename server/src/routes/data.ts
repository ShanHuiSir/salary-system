import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, fail, serverError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { auditLog } from '../middleware/auditLog.js';
import { normalizeSalaryData } from '../services/salaryCalculator.js';

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

const MODEL_MAP: Record<string, { model: PrismaDelegateName; searchFields: string[] }> = {
  overview:       { model: 'monthlyOverview', searchFields: ['month'] },
  department:     { model: 'department',      searchFields: ['month', 'department'] },
  composition:    { model: 'costComposition',  searchFields: ['month', 'department'] },
  position:       { model: 'positionLevel',    searchFields: ['month', 'department', 'level'] },
  store:          { model: 'storeRegion',      searchFields: ['month', 'region'] },
  budget:         { model: 'budgetLaborCost',  searchFields: ['month', 'segment', 'center', 'department', 'businessLine'] },
  costStructure:  { model: 'costStructure',    searchFields: ['month', 'segment'] },
  hqBusinessLine: { model: 'hqBusinessLine',   searchFields: ['month', 'businessLine'] },
  hqDept:         { model: 'hqDept',           searchFields: ['month', 'department'] },
  platform:       { model: 'platform',         searchFields: ['month', 'platform'] },
};

function getModel(dataType: string) {
  const modelConfig = MODEL_MAP[dataType];
  if (!modelConfig) throw new Error(`未知数据类型: ${dataType}`);
  return modelConfig;
}

function getDelegate(model: PrismaDelegateName) {
  return prisma[model] as unknown as {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown | null>;
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

function sanitizeRecord(input: unknown): Record<string, unknown> {
  const data = { ...(input as Record<string, unknown>) };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
}

async function normalizeAfterWrite(dataType: string, month?: unknown) {
  if (typeof month === 'string' && ['overview', 'department', 'position', 'store'].includes(dataType)) {
    await normalizeSalaryData(dataType, month);
  }
}

dataRouter.get('/:dataType', async (req: Request, res: Response) => {
  try {
    const { model, searchFields } = getModel(getRouteParam(req, 'dataType'));
    const { month, search, page = '1', pageSize = '50', sortBy = 'month', sortOrder = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const size = Math.min(200, Math.max(1, parseInt(pageSize as string)));
    const where: Record<string, unknown> = {};

    if (month) where.month = month;
    for (const field of searchFields) {
      if (req.query[field]) where[field] = req.query[field] as string;
    }

    if (search && typeof search === 'string') {
      where.OR = searchFields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
    }

    const delegate = getDelegate(model);
    const [list, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder },
        skip: (pageNum - 1) * size,
        take: size,
      }),
      delegate.count({ where }),
    ]);

    return success(res, {
      list,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.get('/:dataType/:id', async (req: Request, res: Response) => {
  try {
    const { model } = getModel(getRouteParam(req, 'dataType'));
    const record = await getDelegate(model).findUnique({ where: { id: getRouteParam(req, 'id') } });
    if (!record) return fail(res, 1004, '记录不存在', 404);
    return success(res, record);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.post('/:dataType', auditLog('create', ''), async (req: Request, res: Response) => {
  try {
    const dataType = getRouteParam(req, 'dataType');
    const { model } = getModel(dataType);
    const data = sanitizeRecord(req.body);
    const record = await getDelegate(model).create({ data });
    await normalizeAfterWrite(dataType, data.month);
    return success(res, record, '创建成功');
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.post('/:dataType/batch', auditLog('import', ''), async (req: Request, res: Response) => {
  try {
    const dataType = getRouteParam(req, 'dataType');
    const { model } = getModel(dataType);
    const { items, skipInvalid = true } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, 1001, 'items 必须是非空数组');
    }

    const delegate = getDelegate(model);
    const results = { total: items.length, success: 0, skipped: 0, errors: [] as { index: number; message: string }[] };

    for (let i = 0; i < items.length; i++) {
      try {
        const data = sanitizeRecord(items[i]);
        await delegate.create({ data });
        results.success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误';
        if (skipInvalid) {
          results.skipped++;
          results.errors.push({ index: i, message: msg });
        } else {
          return fail(res, 1001, `第 ${i + 1} 行导入失败: ${msg}`);
        }
      }
    }

    return success(res, results, `成功 ${results.success} 条，跳过 ${results.skipped} 条`);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.put('/:dataType/:id', auditLog('update', ''), async (req: Request, res: Response) => {
  try {
    const dataType = getRouteParam(req, 'dataType');
    const { model } = getModel(dataType);
    const data = sanitizeRecord(req.body);
    const record = await getDelegate(model).update({
      where: { id: getRouteParam(req, 'id') },
      data,
    });
    await normalizeAfterWrite(dataType, record.month);
    return success(res, record, '更新成功');
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.delete('/:dataType', auditLog('clear', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(getRouteParam(req, 'dataType'));
    const result = await getDelegate(model).deleteMany();
    return success(res, result, `已清空 ${result.count} 条记录`);
  } catch (error) {
    return serverError(res, error);
  }
});

dataRouter.delete('/:dataType/:id', auditLog('delete', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(getRouteParam(req, 'dataType'));
    await getDelegate(model).delete({ where: { id: getRouteParam(req, 'id') } });
    return success(res, null, '删除成功');
  } catch (error) {
    return serverError(res, error);
  }
});
