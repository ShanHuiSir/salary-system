import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DataType } from '@/types';
import type { DataPath, MatchingRule, ConsistencyResult } from '@/types/dataBinding';
import { defaultDataPaths, defaultMatchingRules } from '@/types/dataBinding';

const STORAGE_KEY = 'salary-admin-data-binding';

interface PersistedBinding {
  paths: DataPath[];
  rules: MatchingRule[];
}

function loadFromStorage(): PersistedBinding {
  if (typeof window === 'undefined') return { paths: defaultDataPaths, rules: defaultMatchingRules };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { paths: defaultDataPaths, rules: defaultMatchingRules };
    const parsed = JSON.parse(raw) as Partial<PersistedBinding>;
    // 合并默认配置，确保新增的默认路径和规则也能出现
    const existingPathIds = new Set((parsed.paths ?? []).map((p) => p.id));
    const newDefaultPaths = defaultDataPaths.filter((p) => !existingPathIds.has(p.id));
    const existingRuleIds = new Set((parsed.rules ?? []).map((r) => r.id));
    const newDefaultRules = defaultMatchingRules.filter((r) => !existingRuleIds.has(r.id));
    return {
      paths: [...(parsed.paths ?? defaultDataPaths), ...newDefaultPaths],
      rules: [...(parsed.rules ?? defaultMatchingRules), ...newDefaultRules],
    };
  } catch {
    return { paths: defaultDataPaths, rules: defaultMatchingRules };
  }
}

function saveToStorage(binding: PersistedBinding) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(binding));
  } catch {
    // ignore
  }
}

interface DataBindingContextValue {
  paths: DataPath[];
  rules: MatchingRule[];

  // 路径操作
  addPath: (path: DataPath) => void;
  updatePath: (id: string, updates: Partial<DataPath>) => void;
  removePath: (id: string) => void;
  getPath: (id: string) => DataPath | undefined;
  getPathsByDimension: (dimension: string) => DataPath[];

  // 匹配规则操作
  addRule: (rule: MatchingRule) => void;
  updateRule: (id: string, updates: Partial<MatchingRule>) => void;
  removeRule: (id: string) => void;
  getRule: (id: string) => MatchingRule | undefined;

  // 一致性校验结果
  consistencyResults: ConsistencyResult[];
  setConsistencyResults: (results: ConsistencyResult[]) => void;

  // 重置
  resetBinding: () => void;
}

const DataBindingContext = createContext<DataBindingContextValue | null>(null);

export function DataBindingProvider({ children }: { children: ReactNode }) {
  const [binding, setBinding] = useState<PersistedBinding>(() => loadFromStorage());
  const [consistencyResults, setConsistencyResults] = useState<ConsistencyResult[]>([]);

  useEffect(() => {
    saveToStorage(binding);
  }, [binding]);

  // ===== 路径操作 =====
  const addPath = useCallback((path: DataPath) => {
    setBinding((prev) => {
      if (prev.paths.some((p) => p.id === path.id)) return prev;
      return { ...prev, paths: [...prev.paths, path] };
    });
  }, []);

  const updatePath = useCallback((id: string, updates: Partial<DataPath>) => {
    setBinding((prev) => ({
      ...prev,
      paths: prev.paths.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const removePath = useCallback((id: string) => {
    setBinding((prev) => ({
      ...prev,
      paths: prev.paths.filter((p) => p.id !== id),
    }));
  }, []);

  const getPath = useCallback(
    (id: string) => binding.paths.find((p) => p.id === id),
    [binding.paths]
  );

  const getPathsByDimension = useCallback(
    (dimension: string) => binding.paths.filter((p) => p.dimension === dimension),
    [binding.paths]
  );

  // ===== 匹配规则操作 =====
  const addRule = useCallback((rule: MatchingRule) => {
    setBinding((prev) => {
      if (prev.rules.some((r) => r.id === rule.id)) return prev;
      return { ...prev, rules: [...prev.rules, rule] };
    });
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<MatchingRule>) => {
    setBinding((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setBinding((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  }, []);

  const getRule = useCallback(
    (id: string) => binding.rules.find((r) => r.id === id),
    [binding.rules]
  );

  const resetBinding = useCallback(() => {
    setBinding({ paths: defaultDataPaths, rules: defaultMatchingRules });
    setConsistencyResults([]);
  }, []);

  return (
    <DataBindingContext.Provider
      value={{
        paths: binding.paths,
        rules: binding.rules,
        addPath,
        updatePath,
        removePath,
        getPath,
        getPathsByDimension,
        addRule,
        updateRule,
        removeRule,
        getRule,
        consistencyResults,
        setConsistencyResults,
        resetBinding,
      }}
    >
      {children}
    </DataBindingContext.Provider>
  );
}

export function useDataBinding() {
  const ctx = useContext(DataBindingContext);
  if (!ctx) throw new Error('useDataBinding must be used within DataBindingProvider');
  return ctx;
}

/**
 * 辅助函数：生成唯一 ID
 */
export function generateBindingId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 获取所有可用数据类型标签
 */
export function getAllDataTypeLabels(): { value: DataType; label: string }[] {
  return [
    { value: 'overview', label: '月度总览' },
    { value: 'department', label: '部门数据' },
    { value: 'composition', label: '成本构成' },
    { value: 'position', label: '职级数据' },
    { value: 'store', label: '门店/区域数据' },
    { value: 'budget', label: '预算人力成本' },
    { value: 'costStructure', label: '人力成本组成' },
  ];
}
