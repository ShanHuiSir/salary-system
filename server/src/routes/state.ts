import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, DATA_ADMIN_ROLES, USER_ADMIN_ROLES, requireRole } from '../middleware/auth.js';
import { success, fail, serverError } from '../utils/response.js';
import { auditLog } from '../middleware/auditLog.js';

export const stateRouter = Router();

stateRouter.use(authenticate);

function getStateKey(req: Request): string {
  const key = req.params.key;
  if (typeof key !== 'string' || !/^[a-zA-Z0-9:_-]{1,80}$/.test(key)) {
    throw new Error('无效状态键名');
  }
  return key;
}

stateRouter.get('/:key', async (req: Request, res: Response) => {
  try {
    const state = await prisma.clientState.findUnique({ where: { key: getStateKey(req) } });
    if (!state) return fail(res, 1004, '状态不存在', 404);
    return success(res, state.value);
  } catch (error) {
    return serverError(res, error);
  }
});

stateRouter.put('/:key', requireRole(...USER_ADMIN_ROLES), auditLog('update_state', 'client_states'), async (req: Request, res: Response) => {
  try {
    const key = getStateKey(req);
    const value = req.body?.value;
    if (value === undefined) return fail(res, 1001, 'value 不能为空');

    const state = await prisma.clientState.upsert({
      where: { key },
      update: { value, updatedBy: req.user?.username ?? null },
      create: { key, value, updatedBy: req.user?.username ?? null },
    });

    return success(res, state.value, '保存成功');
  } catch (error) {
    return serverError(res, error);
  }
});

stateRouter.delete('/:key', requireRole(...DATA_ADMIN_ROLES), auditLog('delete_state', 'client_states'), async (req: Request, res: Response) => {
  try {
    await prisma.clientState.delete({ where: { key: getStateKey(req) } }).catch(() => null);
    return success(res, null, '删除成功');
  } catch (error) {
    return serverError(res, error);
  }
});
