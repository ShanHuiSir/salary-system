import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createUser,
  disableUser,
  listUserRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  type AuthUser,
  type ManagedUser,
  type UserRoleOption,
} from '@/lib/api';

interface UserManagementPageProps {
  currentUser: AuthUser;
}

interface UserFormState {
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: string;
  departmentScope: string;
  isActive: boolean;
}

const DEFAULT_FORM: UserFormState = {
  username: '',
  password: '',
  displayName: '',
  email: '',
  role: 'hr_staff',
  departmentScope: '',
  isActive: true,
};

const FALLBACK_ROLES: UserRoleOption[] = [
  { role: 'super_admin', label: '超级管理员' },
  { role: 'hr_admin', label: 'HR 管理员' },
  { role: 'hr_staff', label: 'HR 专员' },
  { role: 'dept_manager', label: '部门负责人' },
  { role: 'finance', label: '财务' },
  { role: 'auditor', label: '审计/只读' },
];

function roleLabel(role: string, roles: UserRoleOption[]) {
  return roles.find((item) => item.role === role)?.label ?? role;
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'super_admin') return 'default';
  if (role === 'hr_admin') return 'secondary';
  return 'outline';
}

function formatDate(value: string | null) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function parseDepartmentScope(value: string) {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toForm(user: ManagedUser): UserFormState {
  return {
    username: user.username,
    password: '',
    displayName: user.displayName,
    email: user.email ?? '',
    role: user.role,
    departmentScope: user.departmentScope.join(', '),
    isActive: user.isActive,
  };
}

export function UserManagementPage({ currentUser }: UserManagementPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<UserRoleOption[]>(FALLBACK_ROLES);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [disableTarget, setDisableTarget] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const canManageUsers = currentUser.role === 'super_admin' || currentUser.role === 'hr_admin';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [roleOptions, userPage] = await Promise.all([
        listUserRoles().catch(() => FALLBACK_ROLES),
        listUsers({ page: 1, pageSize: 200 }),
      ]);
      setRoles(roleOptions);
      setUsers(userPage.list);
    } catch (error) {
      toast.error('账号列表加载失败', { description: error instanceof Error ? error.message : '请检查登录状态和权限' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageUsers) return;
    void loadUsers();
  }, [canManageUsers, loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => [
      user.username,
      user.displayName,
      user.email ?? '',
      roleLabel(user.role, roles),
      user.departmentScope.join(','),
    ].some((item) => item.toLowerCase().includes(keyword)));
  }, [roles, search, users]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (user: ManagedUser) => {
    setEditingUser(user);
    setForm(toForm(user));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.displayName.trim()) {
      toast.error('请填写显示名称');
      return;
    }
    if (!editingUser && !form.username.trim()) {
      toast.error('请填写用户名');
      return;
    }
    if (!editingUser && form.password.length < 8) {
      toast.error('新账号密码至少 8 位');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        email: form.email.trim() || null,
        role: form.role,
        departmentScope: parseDepartmentScope(form.departmentScope),
        isActive: form.isActive,
      };

      if (editingUser) {
        await updateUser(editingUser.id, {
          displayName: payload.displayName,
          email: payload.email,
          role: payload.role,
          departmentScope: payload.departmentScope,
          isActive: payload.isActive,
        });
        toast.success('账号已更新');
      } else {
        await createUser(payload);
        toast.success('账号已创建');
      }

      setDialogOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(editingUser ? '更新失败' : '创建失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setSaving(true);
    try {
      await disableUser(disableTarget.id);
      toast.success('账号已停用');
      setDisableTarget(null);
      await loadUsers();
    } catch (error) {
      toast.error('停用失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      toast.error('新密码至少 8 位');
      return;
    }
    setSaving(true);
    try {
      await resetUserPassword(resetTarget.id, newPassword);
      toast.success('密码已重置');
      setResetTarget(null);
      setNewPassword('');
      await loadUsers();
    } catch (error) {
      toast.error('重置失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>账号管理</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          当前账号没有访问账号管理的权限。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">账号管理</h2>
          <p className="text-sm text-muted-foreground">创建账号、分配角色、停用账号和重置密码。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />刷新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />新增账号
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />账号列表
          </CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索用户名、姓名、角色或部门"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>部门范围</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">正在加载账号...</TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">暂无账号</TableCell></TableRow>
                ) : filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-xs text-muted-foreground">{user.username}{user.email ? ` · ${user.email}` : ''}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.role)}>{roleLabel(user.role, roles)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                      {user.departmentScope.length > 0 ? user.departmentScope.join('、') : '全部'}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? <Badge variant="outline">启用</Badge> : <Badge variant="secondary">停用</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.lastLoginAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} aria-label="编辑账号">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setResetTarget(user); setNewPassword(''); }} aria-label="重置密码">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDisableTarget(user)}
                          disabled={!user.isActive || user.id === currentUser.id}
                          aria-label="停用账号"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑账号' : '新增账号'}</DialogTitle>
            <DialogDescription>
              {editingUser ? '修改账号显示信息、角色、部门范围和启用状态。' : '创建后用户即可使用账号密码登录系统。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                disabled={Boolean(editingUser)}
                placeholder="如 hr01"
              />
            </div>
            {!editingUser && (
              <div className="grid gap-2">
                <Label htmlFor="password">初始密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="至少 8 位"
                />
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="displayName">显示名称</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="如 HR 专员 01"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>角色</Label>
                <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.role} value={role.role}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === 'active' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="departmentScope">部门范围</Label>
              <Input
                id="departmentScope"
                value={form.departmentScope}
                onChange={(event) => setForm((prev) => ({ ...prev, departmentScope: event.target.value }))}
                placeholder="留空表示全部；填 数据看板 表示仅允许看板只读"
              />
              <p className="text-xs text-muted-foreground">
                如需只看数据看板且不能操作：角色选“审计/只读”，部门范围填“数据看板”。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>为 {resetTarget?.displayName} 设置新密码，保存后该账号需要重新登录。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="至少 8 位"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>取消</Button>
            <Button onClick={() => void handleResetPassword()} disabled={saving}>确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(disableTarget)} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停用账号？</AlertDialogTitle>
            <AlertDialogDescription>
              停用后，{disableTarget?.displayName} 将无法继续登录，已保存的刷新令牌也会被撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDisable()} className="bg-destructive text-destructive-foreground">
              确认停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
