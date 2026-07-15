import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  MonthlyOverview,
  DepartmentData,
  CostComposition,
  PositionLevelData,
  StoreRegionData,
  HqBusinessLineData,
  HqDeptData,
  PlatformData,
  BudgetLaborCostData,
  CostStructureData,
  DataType,
} from '@/types';
import {
  monthlyOverviews,
  departmentData,
  costCompositions,
  positionLevelData,
  storeRegionData,
  hqBusinessLineData,
  hqDeptData,
  platformData,
  budgetLaborCostData,
  costStructureData,
} from '@/data/mockData';
import { normalizeSalaryData } from '@/utils/salaryCalculations';

const STORAGE_KEY = 'salary-admin-data';
const BACKUP_KEY = 'salary-admin-data-backup';
const LOG_STORAGE_KEY = 'salary-admin-op-logs';
const MAX_LOGS = 200;

interface PersistedData {
  overviews: MonthlyOverview[];
  departments: DepartmentData[];
  compositions: CostComposition[];
  positions: PositionLevelData[];
  stores: StoreRegionData[];
  hqBusinessLines: HqBusinessLineData[];
  hqDepts: HqDeptData[];
  platforms: PlatformData[];
  budgets: BudgetLaborCostData[];
  costStructures: CostStructureData[];
}

// 操作日志
export interface OperationLog {
  id: string;
  timestamp: string;
  action: 'clear_source_data' | 'reset_data';
  description: string;
  details: {
    clearedTypes: string[];
    totalRecordsCleared: number;
  };
}

function loadLogs(): OperationLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OperationLog[];
  } catch {
    return [];
  }
}

function saveLogs(logs: OperationLog[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

// ========== 数据备份与完整性校验 ==========

/** 创建数据备份 */
function createBackup(data: PersistedData): void {
  if (typeof window === 'undefined') return;
  try {
    // 只有在有实际数据时才备份，避免备份空数据覆盖有效备份
    const totalRecords =
      data.overviews.length + data.departments.length + data.compositions.length +
      data.positions.length + data.stores.length + data.hqBusinessLines.length +
      data.hqDepts.length + data.platforms.length + data.budgets.length +
      data.costStructures.length;
    if (totalRecords > 0) {
      const backupPayload = {
        timestamp: Date.now(),
        data,
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backupPayload));
    }
  } catch {
    // storage full — silently ignore
  }
}

/** 尝试从备份恢复（仅当主数据为空或损坏时） */
function tryRestoreFromBackup(): PersistedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw) as { timestamp: number; data: PersistedData };
    if (!data || typeof data !== 'object') return null;
    // 简单校验：至少有一个数组且有数据
    const keys: (keyof PersistedData)[] = [
      'overviews', 'departments', 'compositions', 'positions', 'stores',
      'hqBusinessLines', 'hqDepts', 'platforms', 'budgets', 'costStructures',
    ];
    const valid = keys.every((k) => Array.isArray(data[k]));
    if (!valid) return null;
    return data;
  } catch {
    return null;
  }
}

/** 校验数据完整性 */
function validateDataIntegrity(data: Partial<PersistedData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys: (keyof PersistedData)[] = [
    'overviews', 'departments', 'compositions', 'positions', 'stores',
    'hqBusinessLines', 'hqDepts', 'platforms', 'budgets', 'costStructures',
  ];

  // 检查每个 key 是否都是数组
  for (const key of keys) {
    if (!Array.isArray(data[key])) {
      errors.push(`${key} 不是有效的数组`);
    }
  }

  // 检查每个项目是否有 id 字段
  for (const key of keys) {
    const arr = data[key];
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item || typeof item !== 'object') {
          errors.push(`${key}[${i}] 不是有效的对象`);
          continue;
        }
        if (typeof (item as { id?: unknown }).id !== 'string') {
          errors.push(`${key}[${i}] 缺少 id 字段`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 数据迁移：将旧版成本构成字段名映射到新字段名
 * 旧字段 → 新字段：
 *   fixedSalary    → fixedIncome
 *   variableSalary → floatingIncome
 *   socialBenefits → socialInsurance
 *   otherCosts     → severance
 *   (新增)          → outsourcing (默认 0)
 */
function migrateCompositions(compositions: unknown[]): CostComposition[] {
  return compositions.map((item, i) => {
    const c = item as Record<string, unknown>;
    // 如果已经有新字段名，说明已迁移过，直接返回
    if (c.fixedIncome !== undefined || c.floatingIncome !== undefined) {
      // 确保 outsourcing 字段存在
      if (c.outsourcing === undefined) c.outsourcing = 0;
      return c as unknown as CostComposition;
    }
    // 旧字段名 → 新字段名
    const migrated: CostComposition = {
      id: String(c.id ?? `migrated-${i}`),
      month: String(c.month ?? ''),
      department: c.department as CostComposition['department'],
      fixedIncome: Number(c.fixedSalary ?? 0),
      floatingIncome: Number(c.variableSalary ?? 0),
      socialInsurance: Number(c.socialBenefits ?? 0),
      severance: Number(c.otherCosts ?? 0),
      outsourcing: 0,
    };
    return migrated;
  });
}

/** 检测 compositions 是否需要迁移 */
function needsMigration(compositions: unknown[]): boolean {
  if (compositions.length === 0) return false;
  const first = compositions[0] as Record<string, unknown>;
  return first.fixedIncome === undefined && first.floatingIncome === undefined;
}

/** 对已加载的数据应用所有迁移 */
function applyMigrations(data: PersistedData): PersistedData {
  let migrated = data;
  if (needsMigration(data.compositions)) {
    console.info('[DataContext] 检测到旧版成本构成字段，执行数据迁移');
    migrated = { ...data, compositions: migrateCompositions(data.compositions) };
  }
  return normalizeSalaryData(migrated);
}

const DEFAULT_DATA: PersistedData = normalizeSalaryData({
  overviews: monthlyOverviews,
  departments: departmentData,
  compositions: costCompositions,
  positions: positionLevelData,
  stores: storeRegionData,
  hqBusinessLines: hqBusinessLineData,
  hqDepts: hqDeptData,
  platforms: platformData,
  budgets: budgetLaborCostData,
  costStructures: costStructureData,
});

function loadFromStorage(): { data: PersistedData; loadedFromStorage: boolean } {
  if (typeof window === 'undefined') return { data: DEFAULT_DATA, loadedFromStorage: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('[DataContext] localStorage 无数据，使用默认模拟数据');
      return { data: DEFAULT_DATA, loadedFromStorage: false };
    }

    let parsed: Partial<PersistedData>;
    try {
      parsed = JSON.parse(raw) as Partial<PersistedData>;
    } catch {
      // JSON 解析失败，数据可能损坏，尝试从备份恢复
      console.warn('[DataContext] 主数据损坏，尝试从备份恢复');
      const backup = tryRestoreFromBackup();
      if (backup) {
        const migrated = applyMigrations(backup);
        // 将迁移后的备份写回主存储
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return { data: migrated, loadedFromStorage: true };
      }
      return { data: DEFAULT_DATA, loadedFromStorage: false };
    }

    // 校验数据完整性
    const { valid, errors } = validateDataIntegrity(parsed);
    if (!valid) {
      console.warn('[DataContext] 数据完整性检查失败:', errors);
      // 尝试从备份恢复
      const backup = tryRestoreFromBackup();
      if (backup) {
        console.info('[DataContext] 从备份恢复成功');
        const migrated = applyMigrations(backup);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return { data: migrated, loadedFromStorage: true };
      }
      // 无有效备份，回退默认数据
      console.info('[DataContext] 无有效备份，回退默认数据');
    }

    const result = applyMigrations({
      overviews: parsed.overviews ?? DEFAULT_DATA.overviews,
      departments: parsed.departments ?? DEFAULT_DATA.departments,
      compositions: parsed.compositions ?? DEFAULT_DATA.compositions,
      positions: parsed.positions ?? DEFAULT_DATA.positions,
      stores: parsed.stores ?? DEFAULT_DATA.stores,
      hqBusinessLines: parsed.hqBusinessLines ?? DEFAULT_DATA.hqBusinessLines,
      hqDepts: parsed.hqDepts ?? DEFAULT_DATA.hqDepts,
      platforms: parsed.platforms ?? DEFAULT_DATA.platforms,
      budgets: parsed.budgets ?? DEFAULT_DATA.budgets,
      costStructures: parsed.costStructures ?? DEFAULT_DATA.costStructures,
    });
    console.log('[DataContext] 从 localStorage 加载数据成功:', {
      overviews: result.overviews.length,
      departments: result.departments.length,
      compositions: result.compositions.length,
      positions: result.positions.length,
      stores: result.stores.length,
      budgets: result.budgets.length,
    });
    return { data: result, loadedFromStorage: true };
  } catch {
    return { data: DEFAULT_DATA, loadedFromStorage: false };
  }
}

function saveToStorage(data: PersistedData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 每次保存时同时创建备份
    createBackup(data);
  } catch {
    // storage full or unavailable — silently ignore
  }
}

interface DataContextValue {
  overviews: MonthlyOverview[];
  departments: DepartmentData[];
  compositions: CostComposition[];
  positions: PositionLevelData[];
  stores: StoreRegionData[];
  hqBusinessLines: HqBusinessLineData[];
  hqDepts: HqDeptData[];
  platforms: PlatformData[];
  budgets: BudgetLaborCostData[];
  costStructures: CostStructureData[];
  loadedFromStorage: boolean;  // 是否从 localStorage 加载（false 表示使用默认模拟数据）

  addItem: (type: DataType, item: unknown) => void;
  batchAddItems: (type: DataType, items: unknown[]) => void;
  updateItem: (type: DataType, id: string, item: unknown) => void;
  deleteItem: (type: DataType, id: string) => void;
  getItem: (type: DataType, id: string) => unknown | undefined;
  resetData: () => void;
  clearSourceData: () => { clearedCount: number; clearedTypes: string[] };
  operationLogs: OperationLog[];
  /** 导出全部数据为 JSON 字符串（用于手动备份） */
  exportData: () => string;
  /** 从 JSON 字符串导入数据 */
  importData: (jsonStr: string) => { success: boolean; message: string };
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  // 一次性加载，避免 StrictMode 下重复读取 localStorage
  const [initialLoad] = useState(() => loadFromStorage());
  const [data, setData] = useState<PersistedData>(initialLoad.data);
  const [loadedFromStorage, setLoadedFromStorage] = useState(initialLoad.loadedFromStorage);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>(() => loadLogs());

  useEffect(() => {
    saveToStorage(data);
    console.log('[DataContext] 数据已保存到 localStorage:', {
      overviews: data.overviews.length,
      departments: data.departments.length,
      compositions: data.compositions.length,
      positions: data.positions.length,
      stores: data.stores.length,
      budgets: data.budgets.length,
    });
  }, [data]);

  useEffect(() => {
    saveLogs(operationLogs);
  }, [operationLogs]);

  const addItem = useCallback((type: DataType, item: unknown) => {
    setData((prev) => {
      let next: PersistedData;
      switch (type) {
        case 'overview':
          next = { ...prev, overviews: [...prev.overviews, item as MonthlyOverview] };
          break;
        case 'department':
          next = { ...prev, departments: [...prev.departments, item as DepartmentData] };
          break;
        case 'composition':
          next = { ...prev, compositions: [...prev.compositions, item as CostComposition] };
          break;
        case 'position':
          next = { ...prev, positions: [...prev.positions, item as PositionLevelData] };
          break;
        case 'store':
          next = { ...prev, stores: [...prev.stores, item as StoreRegionData] };
          break;
        case 'budget':
          next = { ...prev, budgets: [...prev.budgets, item as BudgetLaborCostData] };
          break;
        case 'costStructure':
          next = { ...prev, costStructures: [...prev.costStructures, item as CostStructureData] };
          break;
        default:
          return prev;
      }
      return normalizeSalaryData(next);
    });
  }, []);

  const batchAddItems = useCallback((type: DataType, items: unknown[]) => {
    setData((prev) => {
      let next: PersistedData;
      switch (type) {
        case 'overview':
          next = { ...prev, overviews: [...prev.overviews, ...items as MonthlyOverview[]] };
          break;
        case 'department':
          next = { ...prev, departments: [...prev.departments, ...items as DepartmentData[]] };
          break;
        case 'composition':
          next = { ...prev, compositions: [...prev.compositions, ...items as CostComposition[]] };
          break;
        case 'position':
          next = { ...prev, positions: [...prev.positions, ...items as PositionLevelData[]] };
          break;
        case 'store':
          next = { ...prev, stores: [...prev.stores, ...items as StoreRegionData[]] };
          break;
        case 'budget':
          next = { ...prev, budgets: [...prev.budgets, ...items as BudgetLaborCostData[]] };
          break;
        case 'costStructure':
          next = { ...prev, costStructures: [...prev.costStructures, ...items as CostStructureData[]] };
          break;
        default:
          return prev;
      }
      return normalizeSalaryData(next);
    });
  }, []);

  const updateItem = useCallback((type: DataType, id: string, item: unknown) => {
    setData((prev) => {
      const replace = <T extends { id: string }>(list: T[]): T[] =>
        list.map((existing) => (existing.id === id ? (item as T) : existing));
      let next: PersistedData;
      switch (type) {
        case 'overview':
          next = { ...prev, overviews: replace(prev.overviews) };
          break;
        case 'department':
          next = { ...prev, departments: replace(prev.departments) };
          break;
        case 'composition':
          next = { ...prev, compositions: replace(prev.compositions) };
          break;
        case 'position':
          next = { ...prev, positions: replace(prev.positions) };
          break;
        case 'store':
          next = { ...prev, stores: replace(prev.stores) };
          break;
        case 'budget':
          next = { ...prev, budgets: replace(prev.budgets) };
          break;
        case 'costStructure':
          next = { ...prev, costStructures: replace(prev.costStructures) };
          break;
        default:
          return prev;
      }
      return normalizeSalaryData(next);
    });
  }, []);

  const deleteItem = useCallback((type: DataType, id: string) => {
    setData((prev) => {
      const remove = <T extends { id: string }>(list: T[]): T[] =>
        list.filter((existing) => existing.id !== id);
      switch (type) {
        case 'overview':
          return { ...prev, overviews: remove(prev.overviews) };
        case 'department':
          return { ...prev, departments: remove(prev.departments) };
        case 'composition':
          return { ...prev, compositions: remove(prev.compositions) };
        case 'position':
          return { ...prev, positions: remove(prev.positions) };
        case 'store':
          return { ...prev, stores: remove(prev.stores) };
        case 'budget':
          return { ...prev, budgets: remove(prev.budgets) };
        case 'costStructure':
          return { ...prev, costStructures: remove(prev.costStructures) };
        default:
          return prev;
      }
    });
  }, []);

  const getItem = useCallback(
    (type: DataType, id: string) => {
      const list = (() => {
        switch (type) {
          case 'overview': return data.overviews;
          case 'department': return data.departments;
          case 'composition': return data.compositions;
          case 'position': return data.positions;
          case 'store': return data.stores;
          case 'budget': return data.budgets;
          case 'costStructure': return data.costStructures;
          default: return [];
        }
      })();
      return list.find((existing) => (existing as { id: string }).id === id);
    },
    [data]
  );

  const resetData = useCallback(() => {
    setData((prev) => {
      const clearedCount =
        prev.overviews.length +
        prev.departments.length +
        prev.compositions.length +
        prev.positions.length +
        prev.stores.length +
        prev.hqBusinessLines.length +
        prev.hqDepts.length +
        prev.platforms.length +
        prev.budgets.length +
        prev.costStructures.length;

      const log: OperationLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'reset_data',
        description: `恢复初始数据，清除了 ${clearedCount} 条已编辑记录`,
        details: {
          clearedTypes: [],
          totalRecordsCleared: clearedCount,
        },
      };
      setOperationLogs((prevLogs) => [log, ...prevLogs].slice(0, MAX_LOGS));

      return DEFAULT_DATA;
    });
    setLoadedFromStorage(false);
  }, []);

  const clearSourceData = useCallback(() => {
    const clearedCount =
      data.overviews.length +
      data.departments.length +
      data.compositions.length +
      data.positions.length +
      data.stores.length +
      data.hqBusinessLines.length +
      data.hqDepts.length +
      data.platforms.length +
      data.budgets.length +
      data.costStructures.length;

    setData({
      overviews: [],
      departments: [],
      compositions: [],
      positions: [],
      stores: [],
      hqBusinessLines: [],
      hqDepts: [],
      platforms: [],
      budgets: [],
      costStructures: [],
    });

    const clearedTypes = [
      '月度总览', '部门数据', '成本构成', '职级数据',
      '门店/区域数据', '总部业务线', '总部部门', '平台数据', '预算人力成本', '人力成本组成',
    ];

    const log: OperationLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'clear_source_data',
      description: `清空了全部源数据，共 ${clearedCount} 条记录`,
      details: {
        clearedTypes,
        totalRecordsCleared: clearedCount,
      },
    };

    setOperationLogs((prev) => [log, ...prev].slice(0, MAX_LOGS));

    setLoadedFromStorage(false);
    return { clearedCount, clearedTypes };
  }, [data]);

  /** 导出全部数据 */
  const exportData = useCallback((): string => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  /** 从 JSON 导入数据 */
  const importData = useCallback((jsonStr: string): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonStr) as Partial<PersistedData>;
      const { valid, errors } = validateDataIntegrity(parsed);
      if (!valid) {
        return { success: false, message: `数据格式校验失败：${errors.join('；')}` };
      }
      setData(normalizeSalaryData({
        overviews: parsed.overviews ?? [],
        departments: parsed.departments ?? [],
        compositions: parsed.compositions ?? [],
        positions: parsed.positions ?? [],
        stores: parsed.stores ?? [],
        hqBusinessLines: parsed.hqBusinessLines ?? [],
        hqDepts: parsed.hqDepts ?? [],
        platforms: parsed.platforms ?? [],
        budgets: parsed.budgets ?? [],
        costStructures: parsed.costStructures ?? [],
      }));
      const totalRecords =
        (parsed.overviews?.length ?? 0) +
        (parsed.departments?.length ?? 0) +
        (parsed.compositions?.length ?? 0) +
        (parsed.positions?.length ?? 0) +
        (parsed.stores?.length ?? 0) +
        (parsed.hqBusinessLines?.length ?? 0) +
        (parsed.hqDepts?.length ?? 0) +
        (parsed.platforms?.length ?? 0) +
        (parsed.budgets?.length ?? 0) +
        (parsed.costStructures?.length ?? 0);
      return { success: true, message: `成功导入 ${totalRecords} 条数据记录` };
    } catch (e) {
      return { success: false, message: `导入失败：${e instanceof Error ? e.message : 'JSON 格式错误'}` };
    }
  }, []);

  return (
    <DataContext.Provider
      value={{
        overviews: data.overviews,
        departments: data.departments,
        compositions: data.compositions,
        positions: data.positions,
        stores: data.stores,
        hqBusinessLines: data.hqBusinessLines,
        hqDepts: data.hqDepts,
        platforms: data.platforms,
        budgets: data.budgets,
        costStructures: data.costStructures,
        loadedFromStorage,
        addItem,
        batchAddItems,
        updateItem,
        deleteItem,
        getItem,
        resetData,
        clearSourceData,
        operationLogs,
        exportData,
        importData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
