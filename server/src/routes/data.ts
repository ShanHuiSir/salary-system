import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, fail, serverError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { auditLog } from '../middleware/auditLog.js';
import { normalizeSalaryData } from '../services/salaryCalculator.js';
import type { Prisma } from '@prisma/client';

export const dataRouter = Router();

// 所有数据路由需要认证
dataRouter.use(authenticate);

// =====================================================
// 数据类型 → Prisma Model 映射表
// =====================================================

const MODEL_MAP: Record<string, { model: Prisma.ModelName; searchFields: string[] }> = {
  overview:       { model: 'MonthlyOverview', searchFields: ['month'] },
  department:     { model: 'Department',      searchFields: ['month', 'department'] },
  composition:    { model: 'CostComposition',  searchFields: ['month', 'department'] },
  position:       { model: 'PositionLevel',    searchFields: ['month', 'department', 'level'] },
  store:          { model: 'StoreRegion',      searchFields: ['month', 'region'] },
  budget:         { model: 'BudgetLaborCost',  searchFields: ['month', 'segment', 'center', 'department', 'businessLine'] },
  costStructure:  { model: 'CostStructure',    searchFields: ['month', 'segment'] },
  hqBusinessLine: { model: 'HqBusinessLine',   searchFields: ['month', 'businessLine'] },
  hqDept:         { model: 'HqDept',           searchFields: ['month', 'department'] },
  platform:       { model: 'Platform',         searchFields: ['month', 'platform'] },
};

function getModel(dataType: string) {
  const m = MODEL_MAP[dataType];
  if (!m) throw new Error(`未知数据类型: ${dataType}`);
  return m;
}

/**
 * GET /api/v1/data/:dataType — 列表查询
 */
dataRouter.get('/:dataType', async (req: Request, res: Response) => {
  try {
    const { model, searchFields } = getModel(req.params.dataType);
    const { month, search, page = '1', pageSize = '50', sortBy = 'month', sortOrder = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const size = Math.min(200, Math.max(1, parseInt(pageSize as string)));

    const where: Record<string, unknown> = {};
    if (month) where.month = month;
    // 其他过滤条件通过 query 传入
    for (const field of searchFields) {
      if (req.query[field]) where[field] = req.query[field] as string;
    }

    // 模糊搜索
    if (search && typeof search === 'string') {
      const ors = searchFields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
      where.OR = ors;
    }

    const [list, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any)[model].findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder },
        skip: (pageNum - 1) * size,
        take: size,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any)[model].count({ where }),
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

/**
 * GET /api/v1/data/:dataType/:id — 单条查询
 */
dataRouter.get('/:dataType/:id', async (req: Request, res: Response) => {
  try {
    const { model } = getModel(req.params.dataType);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (prisma as any)[model].findUnique({
      where: { id: req.params.id },
    });
    if (!record) return fail(res, 1004, '记录不存在', 404);
    return success(res, record);
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * POST /api/v1/data/:dataType — 新增
 */
dataRouter.post('/:dataType', auditLog('create', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(req.params.dataType);
    const data = { ...req.body };
    // 去掉客户端可能传入的 id，让数据库自动生成
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (prisma as any)[model].create({ data });

    // 如果涉及 overview/department/position/store，触发重算
    if (['overview', 'department', 'position', 'store'].includes(req.params.dataType)) {
      await normalizeSalaryData(req.params.dataType as string, data.month);
    }

    return success(res, record, '创建成功');
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * POST /api/v1/data/:dataType/batch — 批量新增
 */
dataRouter.post('/:dataType/batch', auditLog('import', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(req.params.dataType);
    const { items, skipInvalid = true } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, 1001, 'items 必须是非空数组');
    }

    const results = { total: items.length, success: 0, skipped: 0, errors: [] as { index: number; message: string }[] };

    for (let i = 0; i < items.length; i++) {
      try {
        const item = { ...items[i] };
        delete item.id;
        delete item.createdAt;
        delete item.updatedAt;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any)[model].create({ data: item });
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

/**
 * PUT /api/v1/data/:dataType/:id — 更新
 */
dataRouter.put('/:dataType/:id', auditLog('update', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(req.params.dataType);
    const data = { ...req.body };
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (prisma as any)[model].update({
      where: { id: req.params.id },
      data,
    });

    if (['overview', 'department', 'position', 'store'].includes(req.params.dataType)) {
      await normalizeSalaryData(req.params.dataType as string, record.month);
    }

    return success(res, record, '更新成功');
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * DELETE /api/v1/data/:dataType/:id — 删除
 */
dataRouter.delete('/:dataType/:id', auditLog('delete', ''), async (req: Request, res: Response) => {
  try {
    const { model } = getModel(req.params.dataType);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[model].delete({ where: { id: req.params.id } });
    return success(res, null, '删除成功');
  } catch (error) {
    return serverError(res, error);
  }
});
