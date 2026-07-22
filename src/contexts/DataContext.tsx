import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
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
import {
  ALL_SERVER_DATA_TYPES,
  DATA_TO_STORAGE_KEY,
  batchCreateDataItems,
  clearDataType,
  createDataItem,
  deleteDataItem,
  listData,
  loadAllSalaryData,
  updateDataItem,
  type PersistedSalaryData,
} from '@/lib/api';

type PersistedData = PersistedSalaryData;

const DATA_TYPE_REGISTRY: Record<DataType, keyof PersistedData> = {
  overview: DATA_TO_STORAGE_KEY.overview,
  department: DATA_TO_STORAGE_KEY.department,
  composition: DATA_TO_STORAGE_KEY.composition,
  position: DATA_TO_STORAGE_KEY.position,
  store: DATA_TO_STORAGE_KEY.store,
  budget: DATA_TO_STORAGE_KEY.budget,
  costStructure: DATA_TO_STORAGE_KEY.costStructure,
};

const DATA_TYPE_CHINESE_LABELS: Record<keyof PersistedData, string> = {
  overviews: '月度总览',
  departments: '部门数据',
  compositions: '成本构成',
  positions: '职级数据',
  stores: '门店/区域数据',
  hqBusinessLines: '总部业务线',
  hqDepts: '总部部门',
  platforms: '平台数据',
  budgets: '预算人力成本',
  costStructures: '人力成本组成',
};

const EMPTY_DATA: PersistedData = {
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
};

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
  loadedFromStorage: boolean;
  loading: boolean;
  syncError: string | null;

  addItem: (type: DataType, item: unknown) => Promise<void>;
  batchAddItems: (type: DataType, items: unknown[]) => Promise<{ total: number; success: number; skipped: number; errors: { index: number; message: string }[] }>;
  updateItem: (type: DataType, id: string, item: unknown) => Promise<void>;
  deleteItem: (type: DataType, id: string) => Promise<void>;
  getItem: (type: DataType, id: string) => unknown | undefined;
  resetData: () => Promise<void>;
  clearSourceData: () => Promise<{ clearedCount: number; clearedTypes: string[] }>;
  operationLogs: OperationLog[];
  exportData: () => string;
  importData: (jsonStr: string) => Promise<{ success: boolean; message: string }>;
}

const DataContext = createContext<DataContextValue | null>(null);

function countRecords(data: PersistedData): number {
  return Object.values(data).reduce((sum, items) => sum + items.length, 0);
}

function validateDataIntegrity(data: Partial<PersistedData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const key of Object.keys(EMPTY_DATA) as (keyof PersistedData)[]) {
    if (data[key] !== undefined && !Array.isArray(data[key])) errors.push(`${key} 不是有效数组`);
  }
  return { valid: errors.length === 0, errors };
}

async function clearAllServerData() {
  await Promise.all(ALL_SERVER_DATA_TYPES.map((dataType) => clearDataType(dataType)));
}

async function seedServerData(data: PersistedData) {
  for (const dataType of ALL_SERVER_DATA_TYPES) {
    const key = DATA_TO_STORAGE_KEY[dataType];
    const items = data[key] as unknown[];
    if (items.length > 0) await batchCreateDataItems(dataType, items as never[]);
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(EMPTY_DATA);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    try {
      const serverData = await loadAllSalaryData();
      setData(normalizeSalaryData(serverData));
      setLoadedFromStorage(true);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '服务器数据加载失败');
      setData(EMPTY_DATA);
      setLoadedFromStorage(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const addItem = useCallback(async (type: DataType, item: unknown) => {
    const created = await createDataItem(type, item as never);
    const key = DATA_TYPE_REGISTRY[type];
    setData((prev) => normalizeSalaryData({ ...prev, [key]: [...prev[key], created] }));
  }, []);

  const batchAddItems = useCallback(async (type: DataType, items: unknown[]) => {
    if (items.length === 0) return { total: 0, success: 0, skipped: 0, errors: [] };
    const result = await batchCreateDataItems(type, items as never[]);
    if (result.skipped > 0) {
      const details = result.errors.slice(0, 3).map((error) => `第 ${error.index + 1} 行：${error.message}`).join('；');
      toast.warning(`已导入/更新 ${result.success} 条，跳过 ${result.skipped} 条`, { description: details || '请检查导入数据后重试' });
    } else {
      toast.success(`成功导入/更新 ${result.success} 条数据`);
    }
    const key = DATA_TYPE_REGISTRY[type];
    const latest = await listData(type);
    setData((prev) => normalizeSalaryData({ ...prev, [key]: latest }));
    return result;
  }, []);

  const updateItem = useCallback(async (type: DataType, id: string, item: unknown) => {
    const updated = await updateDataItem(type, id, item as never);
    const key = DATA_TYPE_REGISTRY[type];
    setData((prev) => {
      const updatedList = (prev[key] as { id: string }[]).map((existing) =>
        existing.id === id ? (updated as typeof existing) : existing
      );
      return normalizeSalaryData({ ...prev, [key]: updatedList });
    });
  }, []);

  const deleteItem = useCallback(async (type: DataType, id: string) => {
    await deleteDataItem(type, id);
    const key = DATA_TYPE_REGISTRY[type];
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).filter((existing) => existing.id !== id),
    }));
  }, []);

  const getItem = useCallback(
    (type: DataType, id: string) => {
      const key = DATA_TYPE_REGISTRY[type];
      return (data[key] as { id: string }[]).find((existing) => existing.id === id);
    },
    [data]
  );

  const clearSourceData = useCallback(async () => {
    const clearedCount = countRecords(data);
    await clearAllServerData();
    setData(EMPTY_DATA);
    setLoadedFromStorage(true);

    const clearedTypes = ALL_SERVER_DATA_TYPES.map((dataType) => DATA_TYPE_CHINESE_LABELS[DATA_TO_STORAGE_KEY[dataType]]);
    const log: OperationLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'clear_source_data',
      description: `清空了全部服务器数据，共 ${clearedCount} 条记录`,
      details: { clearedTypes, totalRecordsCleared: clearedCount },
    };
    setOperationLogs((prev) => [log, ...prev].slice(0, 200));
    return { clearedCount, clearedTypes };
  }, [data]);

  const resetData = useCallback(async () => {
    const clearedCount = countRecords(data);
    await clearAllServerData();
    await seedServerData(DEFAULT_DATA);
    await refreshAll();

    const log: OperationLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'reset_data',
      description: `恢复初始数据，重置前清除了 ${clearedCount} 条服务器记录`,
      details: { clearedTypes: [], totalRecordsCleared: clearedCount },
    };
    setOperationLogs((prev) => [log, ...prev].slice(0, 200));
  }, [data, refreshAll]);

  const exportData = useCallback((): string => JSON.stringify(data, null, 2), [data]);

  const importData = useCallback(async (jsonStr: string): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonStr) as Partial<PersistedData>;
      const { valid, errors } = validateDataIntegrity(parsed);
      if (!valid) return { success: false, message: `数据格式校验失败：${errors.join('；')}` };

      const nextData = normalizeSalaryData({
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
      });

      await clearAllServerData();
      await seedServerData(nextData);
      await refreshAll();
      return { success: true, message: `成功导入 ${countRecords(nextData)} 条数据记录到服务器数据库` };
    } catch (error) {
      return { success: false, message: `导入失败：${error instanceof Error ? error.message : 'JSON 格式错误'}` };
    }
  }, [refreshAll]);

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
        loading,
        syncError,
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
