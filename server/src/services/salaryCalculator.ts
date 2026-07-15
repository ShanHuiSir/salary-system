/**
 * 薪资数据自动计算服务
 *
 * 将前端 salaryCalculations.ts 的逻辑迁移到后端，
 * 数据新增/修改后自动重算环比、同比、人效等派生字段。
 */
import { prisma } from '../utils/prisma.js';

function safeNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number') return Number.isNaN(v) ? fallback : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? fallback : n;
}

function roundTo(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  return parseFloat(value.toFixed(precision));
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function normalizeSalaryData(dataType: string, month: string) {
  try {
    // 1. 重算月度总览
    await recalculateOverviews(month);
    // 2. 重算部门数据
    await recalculateDepartments(month);
    // 3. 重算职级数据
    await recalculatePositions(month);
    // 4. 重算门店数据
    await recalculateStores(month);
  } catch (error) {
    console.error('[SalaryCalculator] 重算失败:', error);
  }
}

async function recalculateOverviews(month: string) {
  const overviews = await prisma.monthlyOverview.findMany();
  const departments = await prisma.department.findMany();

  for (const ov of overviews) {
    const prev = overviews.find((o) => o.month === addMonths(ov.month, -1));
    const lastYear = overviews.find((o) => o.month === addMonths(ov.month, -12));
    const companyDept = departments.find(
      (d) => d.month === ov.month && d.department === '全公司'
    );
    const segDepts = departments.filter(
      (d) => d.month === ov.month && d.department !== '全公司'
    );
    const headcount = companyDept
      ? companyDept.headcount
      : segDepts.reduce((s, d) => s + d.headcount, 0);

    const totalLaborCost = safeNum(ov.totalLaborCost);
    const totalRevenue = safeNum(ov.totalRevenue);

    await prisma.monthlyOverview.update({
      where: { id: ov.id },
      data: {
        avgSalary: headcount > 0 ? roundTo(totalLaborCost / headcount) : 0,
        laborCostRatio: totalRevenue > 0 ? roundTo((totalLaborCost / totalRevenue) * 100) : 0,
        perCapitaRevenue: headcount > 0 ? roundTo(totalRevenue / headcount) : 0,
        momRevenue: roundTo(totalRevenue - safeNum(prev?.totalRevenue)),
        yoyRevenue: roundTo(totalRevenue - safeNum(lastYear?.totalRevenue)),
        momLaborCost: roundTo(totalLaborCost - safeNum(prev?.totalLaborCost)),
        yoyLaborCost: roundTo(totalLaborCost - safeNum(lastYear?.totalLaborCost)),
      },
    });
  }
  console.log(`[SalaryCalculator] 月度总览重算完成 (${month})`);
}

async function recalculateDepartments(month: string) {
  const departments = await prisma.department.findMany();
  const overviews = await prisma.monthlyOverview.findMany();

  for (const dept of departments) {
    const ov = overviews.find((o) => o.month === dept.month);
    const prev = departments.find(
      (d) => d.month === addMonths(dept.month, -1) && d.department === dept.department
    );
    const lastYear = departments.find(
      (d) => d.month === addMonths(dept.month, -12) && d.department === dept.department
    );

    // 获取部门对应的业绩
    let revenue = 0;
    if (ov) {
      switch (dept.department) {
        case '全公司': revenue = safeNum(ov.totalRevenue); break;
        case '自营':   revenue = safeNum(ov.selfOperatedRevenue); break;
        case '加盟':   revenue = safeNum(ov.franchiseRevenue); break;
        case '线上':   revenue = safeNum(ov.platformRevenue); break;
        case '犀利工厂': revenue = safeNum(ov.factoryRevenue); break;
      }
    }

    const laborCost = safeNum(dept.laborCost);
    const headcount = dept.headcount;

    await prisma.department.update({
      where: { id: dept.id },
      data: {
        avgSalary: headcount > 0 ? roundTo(laborCost / headcount) : 0,
        perCapitaRevenue: headcount > 0 ? roundTo(revenue / headcount) : 0,
        laborCostRatio: revenue > 0 ? roundTo((laborCost / revenue) * 100) : 0,
        momLaborCost: roundTo(laborCost - safeNum(prev?.laborCost)),
        yoyLaborCost: roundTo(laborCost - safeNum(lastYear?.laborCost)),
        momHeadcount: headcount - safeNum(prev?.headcount),
        yoyHeadcount: headcount - safeNum(lastYear?.headcount),
      },
    });
  }
  console.log(`[SalaryCalculator] 部门数据重算完成 (${month})`);
}

async function recalculatePositions(month: string) {
  const positions = await prisma.positionLevel.findMany();

  for (const pos of positions) {
    const peers = positions.filter(
      (p) => p.month === pos.month && p.department === pos.department
    );
    const totalHC = peers.reduce((s, p) => s + p.headcount, 0);
    const prev = positions.find(
      (p) =>
        p.month === addMonths(pos.month, -1) &&
        p.department === pos.department &&
        p.level === pos.level
    );
    const lastYear = positions.find(
      (p) =>
        p.month === addMonths(pos.month, -12) &&
        p.department === pos.department &&
        p.level === pos.level
    );

    await prisma.positionLevel.update({
      where: { id: pos.id },
      data: {
        ratio: totalHC > 0 ? roundTo((pos.headcount / totalHC) * 100) : 0,
        momHeadcount: pos.headcount - (prev?.headcount ?? 0),
        yoyHeadcount: pos.headcount - (lastYear?.headcount ?? 0),
      },
    });
  }
}

async function recalculateStores(month: string) {
  const stores = await prisma.storeRegion.findMany();

  for (const store of stores) {
    const prev = stores.find(
      (s) => s.month === addMonths(store.month, -1) && s.region === store.region
    );
    const lastYear = stores.find(
      (s) => s.month === addMonths(store.month, -12) && s.region === store.region
    );

    const revenue = safeNum(store.revenue);
    const storeCount = store.storeCount;
    const laborCost = safeNum(store.laborCost);

    await prisma.storeRegion.update({
      where: { id: store.id },
      data: {
        storeEfficiency: storeCount > 0 ? roundTo(revenue / storeCount) : 0,
        personEfficiency: laborCost > 0 ? roundTo(revenue / laborCost) : 0,
        momRevenue: roundTo(revenue - safeNum(prev?.revenue)),
        yoyRevenue: roundTo(revenue - safeNum(lastYear?.revenue)),
      },
    });
  }
}
