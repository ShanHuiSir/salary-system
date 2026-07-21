import type { AuthUser } from '@/lib/api';
import type { DataType } from '@/types';

const USER_ADMIN_ROLES = new Set(['super_admin', 'hr_admin']);
const CONFIG_ADMIN_ROLES = new Set(['super_admin', 'hr_admin']);
const DASHBOARD_ONLY_SCOPE_KEYS = new Set(['数据看板', '看板', 'dashboard', 'Dashboard']);

const ALL_DATA_TYPES: DataType[] = ['overview', 'department', 'composition', 'position', 'store', 'budget', 'costStructure'];
const HR_DATA_TYPES: DataType[] = ['overview', 'department', 'composition', 'position', 'store', 'costStructure'];
const FINANCE_DATA_TYPES: DataType[] = ['overview', 'composition', 'budget', 'costStructure'];

const DATA_WRITE_TYPES_BY_ROLE: Record<string, DataType[]> = {
  super_admin: ALL_DATA_TYPES,
  hr_admin: ALL_DATA_TYPES,
  hr_staff: HR_DATA_TYPES,
  finance: FINANCE_DATA_TYPES,
  dept_manager: [],
  auditor: [],
};

const DATA_DELETE_TYPES_BY_ROLE: Record<string, DataType[]> = {
  super_admin: ALL_DATA_TYPES,
  hr_admin: ALL_DATA_TYPES,
  hr_staff: [],
  finance: [],
  dept_manager: [],
  auditor: [],
};

export function hasDashboardOnlyScope(user: AuthUser): boolean {
  return (user.departmentScope ?? []).some((scope) => DASHBOARD_ONLY_SCOPE_KEYS.has(scope.trim()));
}

export function isReadOnlyUser(user: AuthUser): boolean {
  return user.role === 'auditor' || user.role === 'dept_manager' || hasDashboardOnlyScope(user);
}

export function canAccessDashboard(_user: AuthUser): boolean {
  return true;
}

export function canAccessReports(_user: AuthUser): boolean {
  return true;
}

export function getReadableDataTypes(user: AuthUser): DataType[] {
  if (hasDashboardOnlyScope(user) || user.role === 'dept_manager' || user.role === 'auditor') return [];
  if (user.role === 'finance') return FINANCE_DATA_TYPES;
  if (user.role === 'hr_staff') return HR_DATA_TYPES;
  if (user.role === 'super_admin' || user.role === 'hr_admin') return ALL_DATA_TYPES;
  return [];
}

export function canAccessDataManagement(user: AuthUser): boolean {
  return getReadableDataTypes(user).length > 0;
}

export function canAccessDataBinding(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && CONFIG_ADMIN_ROLES.has(user.role);
}

export function canCustomizeDashboardLayout(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && CONFIG_ADMIN_ROLES.has(user.role);
}

export function canManageFieldConfig(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && CONFIG_ADMIN_ROLES.has(user.role);
}

export function canWriteDataType(user: AuthUser, dataType: DataType): boolean {
  if (hasDashboardOnlyScope(user)) return false;
  return DATA_WRITE_TYPES_BY_ROLE[user.role]?.includes(dataType) ?? false;
}

export function canDeleteDataType(user: AuthUser, dataType: DataType): boolean {
  if (hasDashboardOnlyScope(user)) return false;
  return DATA_DELETE_TYPES_BY_ROLE[user.role]?.includes(dataType) ?? false;
}

export function canClearAllData(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && user.role === 'super_admin';
}

export function canResetData(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && user.role === 'super_admin';
}

export function canManageUsers(user: AuthUser): boolean {
  return !hasDashboardOnlyScope(user) && USER_ADMIN_ROLES.has(user.role);
}
