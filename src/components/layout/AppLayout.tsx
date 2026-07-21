import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { AuthUser } from '@/lib/api';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  user: AuthUser;
}

export function AppLayout({ children, onLogout, user }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header onLogout={onLogout} onMenuClick={() => setMobileOpen(true)} user={user} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
