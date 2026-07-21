import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table2, X, ChevronDown, ChevronRight, Link2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { canAccessDataBinding, canAccessDataManagement, canAccessReports, canManageUsers, isReadOnlyUser } from '@/lib/permissions';
import type { AuthUser } from '@/lib/api';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  user: AuthUser;
}

type Dimension = '总览' | '总部' | '自营区域' | '线上' | '犀利工厂';

interface SubReport {
  label: string;
  path: string;
}

const SUB_REPORTS: Record<'总部' | '自营区域' | '线上' | '犀利工厂', SubReport[]> = {
  总部: [
    { label: '固浮比', path: '/report/hq/fixed-variable' },
    { label: '业务线', path: '/report/hq/business-line' },
    { label: '部门', path: '/report/hq/department' },
    { label: '层级', path: '/report/hq/level' },
  ],
  自营区域: [
    { label: '固浮比', path: '/report/self/fixed-variable' },
    { label: '业务线', path: '/report/self/business-line' },
    { label: '部门', path: '/report/self/department' },
    { label: '区域人效', path: '/report/self/region' },
  ],
  线上: [
    { label: '固浮比', path: '/report/online/fixed-variable' },
    { label: '业务线', path: '/report/online/business-line' },
    { label: '部门', path: '/report/online/department' },
    { label: '各平台', path: '/report/online/platform' },
  ],
  犀利工厂: [
    { label: '业务线', path: '/report/factory/business-line' },
    { label: '部门', path: '/report/factory/department' },
  ],
};

const DIMENSIONS_WITH_SUBS: Dimension[] = ['总部', '自营区域', '线上', '犀利工厂'];

function NavList({ user, onClick }: { user: AuthUser; onClick?: () => void }) {
  const { pathname, search } = useLocation();
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [overviewSubOpen, setOverviewSubOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set(['总部']));

  const searchParams = new URLSearchParams(search);
  const currentDimension = (searchParams.get('dimension') ?? '总览') as Dimension;

  const isDashboard = pathname.startsWith('/dashboard');
  const isReport = pathname.startsWith('/report');
  const showReports = canAccessReports(user);
  const showDataManagement = canAccessDataManagement(user);
  const showDataBinding = canAccessDataBinding(user);
  const showUserManagement = canManageUsers(user);
  const readonly = isReadOnlyUser(user);

  // Auto-open overview sub when cost-comparison report is active
  useEffect(() => {
    if (pathname === '/report/overview/cost-comparison') {
      setOverviewSubOpen(true);
    }
  }, [pathname]);

  const toggleSub = (dim: string) => {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  };

  const isActiveReport = (path: string) => pathname === path;

  const renderSubItem = (dim: Dimension) => {
    const reports = SUB_REPORTS[dim as '总部' | '自营区域' | '线上' | '犀利工厂'];
    const isOpen = openSubs.has(dim);
    const hasActiveReport = reports.some((r) => isActiveReport(r.path));

    return (
      <Collapsible key={dim} open={isOpen} onOpenChange={() => toggleSub(dim)}>
        <div className="flex items-center">
          <NavLink
            to={`/dashboard?dimension=${encodeURIComponent(dim)}`}
            onClick={onClick}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm transition-colors',
              isDashboard && currentDimension === dim
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {dim}
          </NavLink>
          {showReports && (
            <CollapsibleTrigger asChild>
              <button
                className="ml-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={isOpen ? '收起' : '展开'}
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </CollapsibleTrigger>
          )}
        </div>
        {showReports && <CollapsibleContent>
          <div className="flex flex-col gap-0.5 pl-5 pr-1 pt-0.5">
            {reports.map((r) => (
              <NavLink
                key={r.path}
                to={r.path}
                onClick={onClick}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActiveReport(r.path)
                    ? 'bg-primary/10 text-primary font-medium'
                    : hasActiveReport
                      ? 'text-muted-foreground/70 hover:bg-accent hover:text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {r.label}
              </NavLink>
            ))}
          </div>
        </CollapsibleContent>}
      </Collapsible>
    );
  };

  return (
    <nav className="flex flex-col gap-1 px-2">
      <Collapsible open={dashboardOpen} onOpenChange={setDashboardOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              (isDashboard || isReport)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5" />
              数据看板
            </span>
            {readonly && <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">只读</span>}
            {dashboardOpen ? (
              <ChevronDown className="h-4 w-4 opacity-70" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-70" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 pl-3 pr-1 pt-1">
            {/* 总览 */}
            <Collapsible open={overviewSubOpen} onOpenChange={setOverviewSubOpen}>
              <div className="flex items-center">
                <NavLink
                  to="/dashboard?dimension=总览"
                  onClick={onClick}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm transition-colors',
                    isDashboard && currentDimension === '总览'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  总览
                </NavLink>
                {showReports && (
                  <CollapsibleTrigger asChild>
                    <button
                      className="ml-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={overviewSubOpen ? '收起' : '展开'}
                    >
                      {overviewSubOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </CollapsibleTrigger>
                )}
              </div>
              {showReports && <CollapsibleContent>
                <div className="flex flex-col gap-0.5 pl-5 pr-1 pt-0.5">
                  <NavLink
                    to="/report/overview/cost-comparison"
                    onClick={onClick}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs transition-colors',
                      isActiveReport('/report/overview/cost-comparison')
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    人力成本对比表
                  </NavLink>
                </div>
              </CollapsibleContent>}
            </Collapsible>

            {/* 总部 / 自营区域 / 线上 / 犀利工厂 with sub-reports */}
            {DIMENSIONS_WITH_SUBS.map((dim) => renderSubItem(dim))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {showDataManagement && (
        <NavLink
          to="/data"
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith('/data') && !pathname.startsWith('/data-binding')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Table2 className="h-5 w-5" />
          数据管理
        </NavLink>
      )}

      {showDataBinding && (
        <NavLink
          to="/data-binding"
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith('/data-binding')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Link2 className="h-5 w-5" />
          数据绑定配置
        </NavLink>
      )}

      {showUserManagement && (
        <NavLink
          to="/users"
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith('/users')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Users className="h-5 w-5" />
          账号管理
        </NavLink>
      )}
    </nav>
  );
}

export function Sidebar({ mobileOpen, setMobileOpen, user }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold tracking-tight">薪酬管理系统</span>
        </div>
        <ScrollArea className="flex-1 py-4">
          <NavList user={user} />
        </ScrollArea>
        <div className="border-t p-4 text-xs text-muted-foreground">
          数据模板：2026年5月薪酬分析
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-16 items-center justify-between border-b px-6">
            <span className="text-lg font-bold tracking-tight">薪酬管理系统</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              aria-label="关闭菜单"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 py-4">
            <NavList user={user} onClick={() => setMobileOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
