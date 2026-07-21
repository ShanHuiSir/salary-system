/**
 * 薪资数据自动计算服务。
 *
 * 只读取并重算受本次写入影响的月份（当前月、下月、下一年同月），
 * 避免旧实现对整张表全表扫描并逐行更新。
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

type DbClient = Prisma.TransactionClient | PrismaClient;

function safeNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTo(value: number, precision = 2): number {
  return Number.isFinite(value) ? Number(value.toFixed(precision)) : 0;
}

function addMonths(month: string, delta: number): string {
  const [year, currentMonth] = month.split('-').map(Number);
  const date = new Date(year, currentMonth - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function affectedMonths(month: string): string[] {
  return [...new Set([month, addMonths(month, 1), addMonths(month, 12)])];
}

function queryMonths(months: string[]): string[] {
  return [...new Set(months.flatMap((month) => [month, addMonths(month, -1), addMonths(month, -12)]))];
}

/**
 * 在同一个事务中更新所有派生字段。dataType 保留在签名中便于调用方说明触发源；
 * 不同基础表之间存在交叉依赖，因此统一更新四类派生数据可以避免顺序不一致。
 */
export async function normalizeSalaryData(dataType: string, month: string) {
  const targets = affectedMonths(month);
  await prisma.$transaction(async (tx) => {
    await recalculateOverviews(tx, targets);
    await recalculateDepartments(tx, targets);
    await recalculatePositions(tx, targets);
    await recalculateStores(tx, targets);
  });
  console.log(`[SalaryCalculator] 已完成 ${dataType} 写入后的定向重算：${targets.join(', ')}`);
}

async function recalculateOverviews(db: DbClient, targets: string[]) {
  const [overviews, departments] = await Promise.all([
    db.monthlyOverview.findMany({ where: { month: { in: queryMonths(targets) } } }),
    db.department.findMany({ where: { month: { in: targets } } }),
  ]);
  const overviewByMonth = new Map(overviews.map((row) => [row.month, row]));
  const departmentsByMonth = new Map<string, typeof departments>();
  for (const department of departments) {
    const group = departmentsByMonth.get(department.month) ?? [];
    group.push(department);
    departmentsByMonth.set(department.month, group);
  }

  const updates = targets
    .map((target) => overviewByMonth.get(target))
    .filter((overview): overview is NonNullable<typeof overview> => Boolean(overview))
    .map((overview) => {
      const monthDepartments = departmentsByMonth.get(overview.month) ?? [];
      const companyDepartment = monthDepartments.find((department) => department.department === '全公司');
      const headcount = companyDepartment
        ? companyDepartment.headcount
        : monthDepartments.reduce((sum, department) => sum + department.headcount, 0);
      const previous = overviewByMonth.get(addMonths(overview.month, -1));
      const lastYear = overviewByMonth.get(addMonths(overview.month, -12));
      const totalRevenue = safeNum(overview.totalRevenue);
      const totalLaborCost = safeNum(overview.totalLaborCost);

      return db.monthlyOverview.update({
        where: { id: overview.id },
        data: {
          avgSalary: headcount > 0 ? roundTo(totalLaborCost / headcount) : 0,
          laborCostRatio: totalRevenue > 0 ? roundTo((totalLaborCost / totalRevenue) * 100) : 0,
          perCapitaRevenue: headcount > 0 ? roundTo(totalRevenue / headcount) : 0,
          momRevenue: roundTo(totalRevenue - safeNum(previous?.totalRevenue)),
          yoyRevenue: roundTo(totalRevenue - safeNum(lastYear?.totalRevenue)),
          momLaborCost: roundTo(totalLaborCost - safeNum(previous?.totalLaborCost)),
          yoyLaborCost: roundTo(totalLaborCost - safeNum(lastYear?.totalLaborCost)),
        },
      });
    });

  await Promise.all(updates);
}

function departmentRevenue(department: string, overview: { totalRevenue: number; selfOperatedRevenue: number; franchiseRevenue: number; platformRevenue: number; factoryRevenue: number | null } | undefined) {
  if (!overview) return 0;
  switch (department) {
    case '全公司': return safeNum(overview.totalRevenue);
    case '自营': return safeNum(overview.selfOperatedRevenue);
    case '加盟': return safeNum(overview.franchiseRevenue);
    case '线上': return safeNum(overview.platformRevenue);
    case '犀利工厂': return safeNum(overview.factoryRevenue);
    default: return 0;
  }
}

async function recalculateDepartments(db: DbClient, targets: string[]) {
  const [departments, overviews] = await Promise.all([
    db.department.findMany({ where: { month: { in: queryMonths(targets) } } }),
    db.monthlyOverview.findMany({ where: { month: { in: targets } } }),
  ]);
  const overviewByMonth = new Map(overviews.map((row) => [row.month, row]));
  const departmentByKey = new Map(departments.map((row) => [`${row.month}\u0000${row.department}`, row]));

  const updates = departments
    .filter((department) => targets.includes(department.month))
    .map((department) => {
      const previous = departmentByKey.get(`${addMonths(department.month, -1)}\u0000${department.department}`);
      const lastYear = departmentByKey.get(`${addMonths(department.month, -12)}\u0000${department.department}`);
      const revenue = departmentRevenue(department.department, overviewByMonth.get(department.month));
      const laborCost = safeNum(department.laborCost);
      const headcount = department.headcount;

      return db.department.update({
        where: { id: department.id },
        data: {
          avgSalary: headcount > 0 ? roundTo(laborCost / headcount) : 0,
          perCapitaRevenue: headcount > 0 ? roundTo(revenue / headcount) : 0,
          laborCostRatio: revenue > 0 ? roundTo((laborCost / revenue) * 100) : 0,
          momLaborCost: roundTo(laborCost - safeNum(previous?.laborCost)),
          yoyLaborCost: roundTo(laborCost - safeNum(lastYear?.laborCost)),
          momHeadcount: headcount - safeNum(previous?.headcount),
          yoyHeadcount: headcount - safeNum(lastYear?.headcount),
        },
      });
    });

  await Promise.all(updates);
}

async function recalculatePositions(db: DbClient, targets: string[]) {
  const positions = await db.positionLevel.findMany({ where: { month: { in: queryMonths(targets) } } });
  const positionByKey = new Map(positions.map((row) => [`${row.month}\u0000${row.department}\u0000${row.level}`, row]));
  const peersByKey = new Map<string, typeof positions>();
  for (const position of positions.filter((row) => targets.includes(row.month))) {
    const key = `${position.month}\u0000${position.department}`;
    const group = peersByKey.get(key) ?? [];
    group.push(position);
    peersByKey.set(key, group);
  }

  const updates = positions
    .filter((position) => targets.includes(position.month))
    .map((position) => {
      const peers = peersByKey.get(`${position.month}\u0000${position.department}`) ?? [];
      const totalHeadcount = peers.reduce((sum, peer) => sum + peer.headcount, 0);
      const previous = positionByKey.get(`${addMonths(position.month, -1)}\u0000${position.department}\u0000${position.level}`);
      const lastYear = positionByKey.get(`${addMonths(position.month, -12)}\u0000${position.department}\u0000${position.level}`);
      return db.positionLevel.update({
        where: { id: position.id },
        data: {
          ratio: totalHeadcount > 0 ? roundTo((position.headcount / totalHeadcount) * 100) : 0,
          momHeadcount: position.headcount - safeNum(previous?.headcount),
          yoyHeadcount: position.headcount - safeNum(lastYear?.headcount),
        },
      });
    });

  await Promise.all(updates);
}

async function recalculateStores(db: DbClient, targets: string[]) {
  const stores = await db.storeRegion.findMany({ where: { month: { in: queryMonths(targets) } } });
  const storeByKey = new Map(stores.map((row) => [`${row.month}\u0000${row.region}`, row]));

  const updates = stores
    .filter((store) => targets.includes(store.month))
    .map((store) => {
      const previous = storeByKey.get(`${addMonths(store.month, -1)}\u0000${store.region}`);
      const lastYear = storeByKey.get(`${addMonths(store.month, -12)}\u0000${store.region}`);
      const revenue = safeNum(store.revenue);
      return db.storeRegion.update({
        where: { id: store.id },
        data: {
          storeEfficiency: store.storeCount > 0 ? roundTo(revenue / store.storeCount) : 0,
          personEfficiency: safeNum(store.laborCost) > 0 ? roundTo(revenue / safeNum(store.laborCost)) : 0,
          momRevenue: roundTo(revenue - safeNum(previous?.revenue)),
          yoyRevenue: roundTo(revenue - safeNum(lastYear?.revenue)),
        },
      });
    });

  await Promise.all(updates);
}
