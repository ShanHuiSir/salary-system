import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DataType } from '@/types';
import type { FieldDef, FieldConfigs } from '@/types/fieldConfig';
import { defaultFieldConfigs } from '@/types/fieldConfig';

const STORAGE_KEY = 'salary-admin-field-configs';

function loadFromStorage(): FieldConfigs {
  if (typeof window === 'undefined') return defaultFieldConfigs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFieldConfigs;
    const parsed = JSON.parse(raw) as FieldConfigs;
    // 合并默认配置，确保新增的默认字段也能出现
    const merged: FieldConfigs = { ...defaultFieldConfigs };
    for (const dt of Object.keys(parsed) as DataType[]) {
      // 用户可能新增了自定义字段，也可能删除了某些非系统字段
      // 以用户配置为主，但确保系统字段始终存在
      const userFields = parsed[dt] ?? [];
      const systemFieldsFromDefault = defaultFieldConfigs[dt].filter((f) => f.system);
      const userNonSystemFields = userFields.filter((f) => !f.system);
      merged[dt] = [...systemFieldsFromDefault, ...userNonSystemFields];
    }
    return merged;
  } catch {
    return defaultFieldConfigs;
  }
}

function saveToStorage(configs: FieldConfigs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // storage full — silently ignore
  }
}

interface FieldConfigContextValue {
  fieldConfigs: FieldConfigs;
  getFields: (dataType: DataType) => FieldDef[];
  addField: (dataType: DataType, field: FieldDef) => void;
  updateField: (dataType: DataType, key: string, updates: Partial<FieldDef>) => void;
  removeField: (dataType: DataType, key: string) => void;
  reorderFields: (dataType: DataType, fromIndex: number, toIndex: number) => void;
  resetFieldConfigs: () => void;
}

const FieldConfigContext = createContext<FieldConfigContextValue | null>(null);

export function FieldConfigProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<FieldConfigs>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(configs);
  }, [configs]);

  const getFields = useCallback(
    (dataType: DataType) => configs[dataType] ?? [],
    [configs]
  );

  const addField = useCallback((dataType: DataType, field: FieldDef) => {
    setConfigs((prev) => {
      const existing = prev[dataType] ?? [];
      // 检查 key 是否已存在
      if (existing.some((f) => f.key === field.key)) return prev;
      const maxOrder = existing.reduce((max, f) => Math.max(max, f.order), 0);
      return {
        ...prev,
        [dataType]: [...existing, { ...field, order: field.order ?? maxOrder + 1 }],
      };
    });
  }, []);

  const updateField = useCallback((dataType: DataType, key: string, updates: Partial<FieldDef>) => {
    setConfigs((prev) => {
      const existing = prev[dataType] ?? [];
      return {
        ...prev,
        [dataType]: existing.map((f) => f.key === key ? { ...f, ...updates } : f),
      };
    });
  }, []);

  const removeField = useCallback((dataType: DataType, key: string) => {
    setConfigs((prev) => {
      const existing = prev[dataType] ?? [];
      const field = existing.find((f) => f.key === key);
      if (field?.system) return prev; // 不能删除系统字段
      return {
        ...prev,
        [dataType]: existing.filter((f) => f.key !== key),
      };
    });
  }, []);

  const reorderFields = useCallback((dataType: DataType, fromIndex: number, toIndex: number) => {
    setConfigs((prev) => {
      const fields = [...(prev[dataType] ?? [])].sort((a, b) => a.order - b.order);
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      // 更新 order
      fields.forEach((f, i) => { f.order = i; });
      return { ...prev, [dataType]: fields };
    });
  }, []);

  const resetFieldConfigs = useCallback(() => {
    setConfigs(defaultFieldConfigs);
  }, []);

  return (
    <FieldConfigContext.Provider
      value={{
        fieldConfigs: configs,
        getFields,
        addField,
        updateField,
        removeField,
        reorderFields,
        resetFieldConfigs,
      }}
    >
      {children}
    </FieldConfigContext.Provider>
  );
}

export function useFieldConfig() {
  const ctx = useContext(FieldConfigContext);
  if (!ctx) throw new Error('useFieldConfig must be used within FieldConfigProvider');
  return ctx;
}
