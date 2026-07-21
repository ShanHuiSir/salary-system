/**
 * 数据库初始种子数据
 *
 * 运行: npx tsx prisma/seed.ts
 * 或:   npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始导入初始数据...');

  // 1. 创建管理员（仅允许通过环境变量显式提供密码，避免仓库内置可用凭据）
  const adminUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword === 'change-me-now' || adminPassword.length < 12) {
    throw new Error('请设置长度至少 12 位且非占位符的 ADMIN_PASSWORD 后再执行 db:seed');
  }
  const hash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { role: 'super_admin', isActive: true, loginAttempts: 0, lockedUntil: null },
    create: {
      username: adminUsername,
      passwordHash: hash,
      displayName: '系统管理员',
      role: 'super_admin',
    },
  });
  console.log('✅ 管理员创建完成');

  // 2. 月度总览 (2025-05 ~ 2026-06)
  const overviews = generateOverviews();
  for (const ov of overviews) {
    await prisma.monthlyOverview.upsert({
      where: { month: ov.month },
      update: ov,
      create: ov,
    });
  }
  console.log(`✅ 月度总览 ${overviews.length} 条`);

  // 3. 部门数据
  const depts = generateDepartments();
  for (const d of depts) {
    await prisma.department.create({ data: d });
  }
  console.log(`✅ 部门数据 ${depts.length} 条`);

  // 4. 成本构成
  const comps = generateCompositions();
  for (const c of comps) {
    await prisma.costComposition.create({ data: c });
  }
  console.log(`✅ 成本构成 ${comps.length} 条`);

  // 5. 职级数据
  const positions = generatePositions();
  for (const p of positions) {
    await prisma.positionLevel.create({ data: p });
  }
  console.log(`✅ 职级数据 ${positions.length} 条`);

  // 6. 门店数据
  const stores = generateStores();
  for (const s of stores) {
    await prisma.storeRegion.create({ data: s });
  }
  console.log(`✅ 门店数据 ${stores.length} 条`);

  // 7. 预算数据
  const budgets = generateBudgets();
  for (const b of budgets) {
    await prisma.budgetLaborCost.create({ data: b });
  }
  console.log(`✅ 预算数据 ${budgets.length} 条`);

  // 8. 薪酬结构
  const structures = generateCostStructures();
  for (const s of structures) {
    await prisma.costStructure.create({ data: s });
  }
  console.log(`✅ 薪酬结构 ${structures.length} 条`);

  console.log('🎉 初始数据导入完成！');
}

// ===== 数据生成函数（与前端 mockData.ts 保持一致）=====

function generateOverviews() {
  const months = [
    '2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
    '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06',
  ];
  const baseRevenue = [3231, 3450, 3680, 3850, 3720, 4010, 4250, 4120, 3950, 3800, 4320, 4510, 4652, 4780];
  const baseCost = [838, 865, 892, 905, 891, 910, 935, 925, 908, 895, 942, 960, 973, 985];

  return months.map((month, i) => ({
    month,
    totalRevenue: baseRevenue[i] + Math.random() * 5,
    selfOperatedRevenue: baseRevenue[i] * 0.6 + Math.random() * 3,
    franchiseRevenue: baseRevenue[i] * 0.17 + Math.random() * 2,
    platformRevenue: baseRevenue[i] * 0.15 + Math.random() * 2,
    factoryRevenue: baseRevenue[i] * 0.08 + Math.random() * 1,
    totalLaborCost: baseCost[i] + Math.random() * 3,
    avgSalary: 0, laborCostRatio: 0, perCapitaRevenue: 0, storeEfficiency: 0,
    momRevenue: 0, yoyRevenue: 0, momLaborCost: 0, yoyLaborCost: 0,
  }));
}

function generateDepartments() {
  const departments = ['全公司', '总部', '自营', '线上', '犀利工厂'];
  const data: { month: string; department: string; headcount: number; laborCost: number }[] = [];

  for (const dept of departments) {
    for (const month of ['2025-05', '2026-04', '2026-05']) {
      const base: Record<string, { hc: number; cost: number }> = {
        '全公司': { hc: 1190, cost: 973 },
        '总部': { hc: 380, cost: 320 },
        '自营': { hc: 620, cost: 480 },
        '线上': { hc: 110, cost: 95 },
        '犀利工厂': { hc: 80, cost: 78 },
      };
      const b = base[dept];
      const variation = month === '2026-05' ? 1 : month === '2026-04' ? 0.98 : 0.92;
      data.push({
        month,
        department: dept,
        headcount: Math.round(b.hc * variation),
        laborCost: parseFloat((b.cost * variation).toFixed(1)),
        avgSalary: 0, perCapitaRevenue: 0, storeEfficiency: dept === '自营' ? 20.5 : 0,
        laborCostRatio: 0, momLaborCost: 0, yoyLaborCost: 0, momHeadcount: 0, yoyHeadcount: 0,
      });
    }
  }
  return data;
}

function generateCompositions() {
  const departments = ['总部', '自营', '线上', '犀利工厂'];
  const data: { month: string; department: string; fixedIncome: number; floatingIncome: number; socialInsurance: number; severance: number; outsourcing: number }[] = [];

  for (const dept of departments) {
    for (const month of ['2025-05', '2026-03', '2026-04', '2026-05']) {
      const baseCost = dept === '总部' ? 320 : dept === '自营' ? 480 : dept === '线上' ? 95 : 78;
      const fixedPct = dept === '总部' ? 0.58 : dept === '自营' ? 0.45 : dept === '线上' ? 0.62 : 0.70;
      const floatPct = dept === '总部' ? 0.20 : dept === '自营' ? 0.33 : dept === '线上' ? 0.15 : 0.10;
      data.push({
        month, department: dept,
        fixedIncome: parseFloat((baseCost * fixedPct).toFixed(1)),
        floatingIncome: parseFloat((baseCost * floatPct).toFixed(1)),
        socialInsurance: parseFloat((baseCost * 0.12).toFixed(1)),
        severance: parseFloat((baseCost * 0.02).toFixed(1)),
        outsourcing: parseFloat((baseCost * (dept === '线上' ? 0.08 : 0.04)).toFixed(1)),
      });
    }
  }
  return data;
}

function generatePositions() {
  const levels = ['职能高管', '经理', '主管', '专员', '助理'];
  const hcMap: Record<string, number> = { '职能高管': 15, '经理': 80, '主管': 180, '专员': 500, '助理': 350 };
  return levels.map((level) => ({
    month: '2026-05',
    department: '总部' as const,
    level,
    headcount: hcMap[level],
    laborCost: parseFloat((hcMap[level] * 0.85).toFixed(1)),
    ratio: 0, momHeadcount: 0, yoyHeadcount: 0,
  }));
}

function generateStores() {
  const regions = ['广州', '深圳', '上海', '北京', '成都', '杭州', '武汉'];
  return regions.map((region) => {
    const stores = 5 + Math.floor(Math.random() * 20);
    const revenue = stores * (18 + Math.random() * 10);
    return {
      month: '2026-05', region,
      storeCount: stores,
      revenue: parseFloat(revenue.toFixed(1)),
      laborCost: parseFloat((revenue * 0.25).toFixed(1)),
      storeEfficiency: 0, personEfficiency: 0, momRevenue: 0, yoyRevenue: 0,
    };
  });
}

function generateBudgets() {
  const segments = ['总部', '自营', '线上', '犀利工厂'];
  const centers: Record<string, string[]> = {
    '总部': ['职能中心', '运营中心'],
    '自营': ['区域管理中心'],
    '线上': ['电商事业部'],
    '犀利工厂': ['工厂管理部'],
  };
  const data: { month: string; segment: string; center: string; department: string; businessLine: string; headcount: number; laborCost: number; budgetLaborCost: number }[] = [];

  for (const seg of segments) {
    for (const center of (centers[seg] || [])) {
      for (const month of ['2026-04', '2026-05']) {
        const hc = seg === '总部' ? 50 : seg === '自营' ? 80 : seg === '线上' ? 30 : 20;
        const cost = hc * 0.85;
        data.push({
          month, segment: seg, center, department: `${center}下属部门A`, businessLine: `${seg}业务线`,
          headcount: hc, laborCost: parseFloat(cost.toFixed(1)), budgetLaborCost: parseFloat((cost * 1.1).toFixed(1)),
        });
      }
    }
  }
  return data;
}

function generateCostStructures() {
  const segments = ['总部', '自营', '线上', '犀利工厂'];
  const data: { month: string; segment: string; attendanceSalary: number; performanceBonus: number; overtimePay: number; annualLeaveAllowance: number; sickLeavePay: number; maternityLeavePay: number; otherPayable: number; employerSocialInsurance: number }[] = [];

  for (const seg of segments) {
    for (const month of ['2025-05', '2026-04', '2026-05']) {
      const base = seg === '总部' ? 320 : seg === '自营' ? 480 : seg === '线上' ? 95 : 78;
      data.push({
        month, segment: seg,
        attendanceSalary: parseFloat((base * 0.45).toFixed(1)),
        performanceBonus: parseFloat((base * 0.25).toFixed(1)),
        overtimePay: parseFloat((base * 0.05).toFixed(1)),
        annualLeaveAllowance: parseFloat((base * 0.03).toFixed(1)),
        sickLeavePay: parseFloat((base * 0.02).toFixed(1)),
        maternityLeavePay: parseFloat((base * 0.04).toFixed(1)),
        otherPayable: parseFloat((base * 0.06).toFixed(1)),
        employerSocialInsurance: parseFloat((base * 0.10).toFixed(1)),
      });
    }
  }
  return data;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
