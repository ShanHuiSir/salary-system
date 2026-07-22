import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { AuthUser } from '@/lib/api';

interface HeaderProps {
  onLogout: () => void;
  onMenuClick: () => void;
  user: AuthUser;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  hr_admin: 'HR 管理员',
  hr_staff: 'HR 专员',
  dept_manager: '部门负责人',
  finance: '财务',
  auditor: '审计/只读',
};

export function Header({ onLogout, onMenuClick, user }: HeaderProps) {
  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 min-w-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold md:text-lg">人力资源薪酬数据中心</h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="text-foreground">{user.displayName || user.username}</div>
            <div className="text-xs">{ROLE_LABELS[user.role] ?? user.role}</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout} className="gap-1">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">退出</span>
        </Button>
      </div>
    </header>
  );
}
