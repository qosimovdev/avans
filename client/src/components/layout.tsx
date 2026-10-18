import { BarChart3, HandCoins, LayoutDashboard, LogOut, Menu, Settings, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogTitle, SheetContent } from './ui/dialog';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Bosh sahifa', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Xodimlar', icon: Users },
  { to: '/advances', label: 'Avanslar', icon: HandCoins },
  { to: '/reports', label: 'Hisobotlar', icon: BarChart3 },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-semibold">IshHaqqi</p>
        <p className="text-xs text-muted-foreground">Ish haqi va avanslar</p>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1" aria-label="Asosiy menyu">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-slate-600 hover:bg-secondary hover:text-foreground',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  const handleLogout = async () => {
    await logout();
    toast.success('Tizimdan chiqdingiz');
  };

  return (
    <div className="min-h-dvh">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card px-4 py-5 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <NavItems />
        </div>
        <div className="border-t pt-4">
          <p className="truncate px-3 text-sm font-medium">{user?.username}</p>
          <p className="px-3 text-xs text-muted-foreground">Administrator</p>
          <Button variant="ghost" className="mt-2 w-full justify-start text-slate-600" onClick={handleLogout}>
            <LogOut /> Chiqish
          </Button>
        </div>
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="px-4 py-5" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Menyu</DialogTitle>
          <Brand />
          <div className="mt-8 flex-1">
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut /> Chiqish
          </Button>
        </SheetContent>
      </Dialog>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Menyuni ochish"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="!h-5 !w-5" />
          </Button>
          <p className="font-semibold lg:hidden">IshHaqqi</p>
          <p className="hidden text-sm text-muted-foreground lg:block">{current?.label}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.username}</span>
            <Button variant="ghost" size="icon" aria-label="Chiqish" title="Chiqish" onClick={handleLogout}>
              <LogOut />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
