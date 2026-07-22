import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompanyLogo } from '@/components/brand/CompanyLogo';
import logoWatermark from '@/assets/brand/logo-watermark.png';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await onLogin(username, password);
      if (success) navigate('/dashboard', { replace: true });
      else toast.error('登录失败', { description: '用户名或密码错误' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f4ef] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(67,39,21,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(247,244,239,0.76))]" />
      <img
        src={logoWatermark}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-80 top-10 hidden w-[78rem] max-w-none opacity-60 mix-blend-multiply lg:block"
      />
      <Card className="relative w-full max-w-md border-white/70 bg-white/92 shadow-2xl shadow-stone-900/10 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto rounded-2xl border border-stone-200/80 bg-white px-5 py-4 shadow-sm">
            <CompanyLogo className="w-64 max-w-full" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-stone-950">薪酬数据管理系统</CardTitle>
            <CardDescription>请使用管理员账号登录</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
