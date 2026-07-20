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
}

interface AuthSession {
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

type SalaryItemMap = {
  [K in keyof SalaryArrayMap]: SalaryArrayMap[K][number];
};

const DATA_TO_STORAGE_KEY: Record<ServerDataType, keyof PersistedSalaryData> = {
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null) as ApiResponse<T> | null;

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
    body: JSON.stringify({ username, password }),
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
  const entries = await Promise.all(
    ALL_SERVER_DATA_TYPES.map(async (dataType) => [dataType, await listData(dataType)] as const)
  );

  const data: PersistedSalaryData = {
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

  for (const [dataType, list] of entries) {
    (data[DATA_TO_STORAGE_KEY[dataType]] as unknown[]) = list;
  }

  return data;
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
