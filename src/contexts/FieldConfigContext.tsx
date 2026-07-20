import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { DataType } from '@/types';
import type { FieldDef, FieldConfigs } from '@/types/fieldConfig';
import { defaultFieldConfigs } from '@/types/fieldConfig';
import { getCanonicalFieldLabel } from '@/utils/fieldStandards';
import { loadClientState, saveClientState } from '@/lib/api';

const STORAGE_KEY = 'salary-admin-field-configs';

function mergeFieldConfigs(configs: Partial<FieldConfigs>): FieldConfigs {
  const merged: FieldConfigs = { ...defaultFieldConfigs };
  for (const dt of Object.keys(defaultFieldConfigs) as DataType[]) {
    const userFields = configs[dt] ?? [];
    const systemFieldsFromDefault = defaultFieldConfigs[dt].filter((f) => f.system);
    const userNonSystemFields = userFields
      .filter((f) => !f.system)
      .map((field) => ({ ...field, label: getCanonicalFieldLabel(field.key, field.label) }));
    merged[dt] = [...systemFieldsFromDefault, ...userNonSystemFields];
  }
  return merged;
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
  const [configs, setConfigs] = useState<FieldConfigs>(() => mergeFieldConfigs(defaultFieldConfigs));
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadClientState<Partial<FieldConfigs>>(STORAGE_KEY)
      .then((serverConfigs) => {
        if (!cancelled && serverConfigs) setConfigs(mergeFieldConfigs(serverConfigs));
      })
      .catch((error) => console.error('[FieldConfig] 加载服务器配置失败:', error))
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveClientState(STORAGE_KEY, configs).catch((error) => console.error('[FieldConfig] 保存服务器配置失败:', error));
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
