import { Router, type Request, type Response } from 'express';
import { authenticate, DATA_READ_ROLES, requireRole } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { fail, serverError, success } from '../utils/response.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/**
 * 一次返回看板及报表初始化所需的十类数据，替代前端 10 类数据 × 多分页的并发请求。
 * 可选 month 参数仅返回指定月份，供后续按月看板/缓存策略使用。
 */
dashboardRouter.get('/summary', requireRole(...DATA_READ_ROLES), async (req: Request, res: Response) => {
  try {
    const month = req.query.month;
    if (month !== undefined && (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
      return fail(res, 1001, 'month 必须为 YYYY-MM 格式');
    }
    const where = typeof month === 'string' ? { month } : undefined;
    const [
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
    ] = await Promise.all([
      prisma.monthlyOverview.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.department.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.costComposition.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.positionLevel.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.storeRegion.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.hqBusinessLine.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.hqDept.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.platform.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.budgetLaborCost.findMany({ where, orderBy: { month: 'desc' } }),
      prisma.costStructure.findMany({ where, orderBy: { month: 'desc' } }),
    ]);

    return success(res, { overviews, departments, compositions, positions, stores, hqBusinessLines, hqDepts, platforms, budgets, costStructures });
  } catch (error) {
    return serverError(res, error);
  }
});
