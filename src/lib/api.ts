import type {
  BudgetLaborCostData,
  CostComposition,
  CostStructureData,
  DataType,
  DepartmentData,
  HqBusinessLineData,
  HqDeptData,
  MonthlyOverview,
  PlatformData,
  PositionLevelData,
  StoreRegionData,
} from '@/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'salary-admin-auth-session';

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  departmentScope?: string[];
}

export interface ManagedUser extends AuthUser {
  email: string | null;
  departmentScope: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  loginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleOption {
  role: string;
  label: string;
}

export interface UserInput {
  username?: string;
  password?: string;
  displayName?: string;
  email?: string | null;
  role?: string;
  departmentScope?: string[];
  isActive?: boolean;
  lockedUntil?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface LoginResponse extends AuthSession {
  expiresIn: number;
}

export interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PersistedSalaryData {
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

export type ServerDataType = DataType | 'hqBusinessLine' | 'hqDept' | 'platform';

type SalaryArrayMap = {
  overview: MonthlyOverview[];
  department: DepartmentData[];
  composition: CostComposition[];
  position: PositionLevelData[];
  store: StoreRegionData[];
  budget: BudgetLaborCostData[];
  costStructure: CostStructureData[];
  hqBusinessLine: HqBusinessLineData[];
  hqDept: HqDeptData[];
  platform: PlatformData[];
};

export type SalaryItemMap = {
  [K in keyof SalaryArrayMap]: SalaryArrayMap[K][number];
};

export const DATA_TO_STORAGE_KEY: Record<ServerDataType, keyof PersistedSalaryData> = {
  overview: 'overviews',
  department: 'departments',
  composition: 'compositions',
  position: 'positions',
  store: 'stores',
  budget: 'budgets',
  costStructure: 'costStructures',
  hqBusinessLine: 'hqBusinessLines',
  hqDept: 'hqDepts',
  platform: 'platforms',
};

export const ALL_SERVER_DATA_TYPES = Object.keys(DATA_TO_STORAGE_KEY) as ServerDataType[];

function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  return getStoredSession();
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshAccessToken(): Promise<AuthSession | null> {
  const session = getStoredSession();
  if (!session?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const payload = await response.json().catch(() => null) as ApiResponse<{ accessToken: string; expiresIn: number }> | null;
      if (!response.ok || !payload || payload.code !== 0 || !payload.data?.accessToken) return null;

      // refresh token 轮换由服务端实现时也可在此兼容新的 refreshToken；当前接口只返回 access token。
      const nextSession: AuthSession = { ...session, accessToken: payload.data.accessToken };
      saveAuthSession(nextSession);
      return nextSession;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const session = getStoredSession();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null) as ApiResponse<T> | null;

  if ((!response.ok || !payload || payload.code !== 0) && response.status === 401 && allowRefresh && path !== '/auth/refresh') {
    const refreshedSession = await refreshAccessToken();
    if (refreshedSession) return request<T>(path, options, false);
  }

  if (!response.ok || !payload || payload.code !== 0) {
    const message = payload?.message || `请求失败：${response.status}`;
    if (response.status === 401) clearAuthSession();
    throw new Error(message);
  }

  return payload.data as T;
}

export async function loginWithPassword(username: string, password: string): Promise<AuthUser> {
  const session = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password }),
  });
  saveAuthSession(session);
  return session.user;
}

export async function logoutFromServer() {
  try {
    await request<null>('/auth/logout', { method: 'POST' });
  } finally {
    clearAuthSession();
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me');
}

export async function listUserRoles(): Promise<UserRoleOption[]> {
  return request<UserRoleOption[]>('/users/roles');
}

export async function listUsers(params: { search?: string; role?: string; isActive?: boolean; page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 100));
  return request<ListResponse<ManagedUser>>(`/users?${query.toString()}`);
}

export async function createUser(input: UserInput): Promise<ManagedUser> {
  return request<ManagedUser>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateUser(id: string, input: UserInput): Promise<ManagedUser> {
  return request<ManagedUser>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function resetUserPassword(id: string, password: string) {
  return request<null>(`/users/${id}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function disableUser(id: string): Promise<ManagedUser> {
  return request<ManagedUser>(`/users/${id}`, { method: 'DELETE' });
}

export async function listData<T extends ServerDataType>(dataType: T): Promise<SalaryItemMap[T][]> {
  const firstPage = await request<ListResponse<SalaryItemMap[T]>>(`/data/${dataType}?page=1&pageSize=200`);
  if (firstPage.totalPages <= 1) return firstPage.list;

  const restPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      request<ListResponse<SalaryItemMap[T]>>(`/data/${dataType}?page=${index + 2}&pageSize=200`)
    )
  );

  return [firstPage.list, ...restPages.map((page) => page.list)].flat();
}

export async function loadAllSalaryData(): Promise<PersistedSalaryData> {
  return request<PersistedSalaryData>('/dashboard/summary');
}

export async function createDataItem<T extends DataType>(dataType: T, item: SalaryItemMap[T]): Promise<SalaryItemMap[T]> {
  return request<SalaryItemMap[T]>(`/data/${dataType}`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function batchCreateDataItems<T extends ServerDataType>(dataType: T, items: SalaryItemMap[T][]) {
  return request<{ total: number; success: number; skipped: number; errors: { index: number; message: string }[] }>(`/data/${dataType}/batch`, {
    method: 'POST',
    body: JSON.stringify({ items, skipInvalid: false }),
  });
}

export async function updateDataItem<T extends DataType>(dataType: T, id: string, item: SalaryItemMap[T]): Promise<SalaryItemMap[T]> {
  return request<SalaryItemMap[T]>(`/data/${dataType}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });
}

export async function deleteDataItem(dataType: DataType, id: string) {
  return request<null>(`/data/${dataType}/${id}`, { method: 'DELETE' });
}

export async function clearDataType(dataType: ServerDataType): Promise<{ count: number }> {
  return request<{ count: number }>(`/data/${dataType}`, { method: 'DELETE' });
}

export async function loadClientState<T>(key: string): Promise<T | null> {
  try {
    return await request<T>(`/state/${encodeURIComponent(key)}`);
  } catch (error) {
    if (error instanceof Error && error.message === '状态不存在') return null;
    throw error;
  }
}

export async function saveClientState<T>(key: string, value: T): Promise<T> {
  return request<T>(`/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function deleteClientState(key: string) {
  return request<null>(`/state/${encodeURIComponent(key)}`, { method: 'DELETE' });
}
