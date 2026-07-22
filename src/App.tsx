import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DataProvider } from '@/contexts/DataContext';
import { FieldConfigProvider } from '@/contexts/FieldConfigContext';
import { DataBindingProvider } from '@/contexts/DataBindingContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/sonner';
import {
  canAccessDataManagement,
  canAccessReports,
  canManageUsers,
} from '@/lib/permissions';
import type { AuthUser } from '@/lib/api';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })));
const DataListPage = lazy(() => import('@/pages/DataListPage').then(({ DataListPage }) => ({ default: DataListPage })));
const DataFormPage = lazy(() => import('@/pages/DataFormPage').then(({ DataFormPage }) => ({ default: DataFormPage })));
const ReportPage = lazy(() => import('@/pages/ReportPage').then(({ ReportPage }) => ({ default: ReportPage })));
const UserManagementPage = lazy(() => import('@/pages/UserManagementPage').then(({ UserManagementPage }) => ({ default: UserManagementPage })));

function PageFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">页面加载中...</div>;
}

// ReportPage 内部大量按 type 使用 hooks，切换子报表时会导致 hooks 顺序变化。
// 通过 key 强制在 scope/type 变化时重新挂载，避免 React 的 Rules of Hooks 报错。
function ReportPageWrapper() {
  const { scope = '', type = '' } = useParams<{ scope?: string; type?: string }>();
  return <ReportPage key={`${scope}-${type}`} />;
}

function ProtectedRoute({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { isAuthenticated, checking, user, login, logout } = useAuth();

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">正在验证登录状态...</div>;
  }

  if (!isAuthenticated || !user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <DataProvider>
      <FieldConfigProvider>
        <DataBindingProvider>
          <AppLayout onLogout={logout} user={user}>
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/dashboard" element={<ErrorBoundary><DashboardPage user={user} /></ErrorBoundary>} />
                  <Route path="/report/:scope/:type" element={<ErrorBoundary><ProtectedRoute allowed={canAccessReports(user)}><ReportPageWrapper /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/data" element={<ErrorBoundary><ProtectedRoute allowed={canAccessDataManagement(user)}><DataListPage user={user} /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/data/:type/:id" element={<ErrorBoundary><ProtectedRoute allowed={canAccessDataManagement(user)}><DataFormPage user={user} /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/users" element={<ErrorBoundary><ProtectedRoute allowed={canManageUsers(user)}><UserManagementPage currentUser={user as AuthUser} /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </AppLayout>
        </DataBindingProvider>
      </FieldConfigProvider>
    </DataProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
