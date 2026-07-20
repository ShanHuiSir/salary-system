import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DataListPage } from '@/pages/DataListPage';
import { DataFormPage } from '@/pages/DataFormPage';
import { ReportPage } from '@/pages/ReportPage';
import { DataBindingPage } from '@/pages/DataBindingPage';
import { DataProvider } from '@/contexts/DataContext';
import { FieldConfigProvider } from '@/contexts/FieldConfigContext';
import { DataBindingProvider } from '@/contexts/DataBindingContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/sonner';

// ReportPage 内部大量按 type 使用 hooks，切换子报表时会导致 hooks 顺序变化。
// 通过 key 强制在 scope/type 变化时重新挂载，避免 React 的 Rules of Hooks 报错。
function ReportPageWrapper() {
  const { scope = '', type = '' } = useParams<{ scope?: string; type?: string }>();
  return <ReportPage key={`${scope}-${type}`} />;
}

function AppContent() {
  const { isAuthenticated, checking, login, logout } = useAuth();

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">正在验证登录状态...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <DataProvider>
      <FieldConfigProvider>
        <DataBindingProvider>
          <AppLayout onLogout={logout}>
            <ErrorBoundary>
              <Routes>
                <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                <Route path="/report/:scope/:type" element={<ErrorBoundary><ReportPageWrapper /></ErrorBoundary>} />
                <Route path="/data" element={<ErrorBoundary><DataListPage /></ErrorBoundary>} />
                <Route path="/data/:type/:id" element={<ErrorBoundary><DataFormPage /></ErrorBoundary>} />
                <Route path="/data-binding" element={<ErrorBoundary><DataBindingPage /></ErrorBoundary>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
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
