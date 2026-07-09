'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Users,
  Car,
  Wrench,
  Tag,
  Package,
  BarChart3,
  Calendar,
  FileText,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home, testId: 'nav-dashboard' },
  { href: '/clients', label: 'Clienți', icon: Users, testId: 'nav-clients' },
  { href: '/vehicles', label: 'Mașini', icon: Car, testId: 'nav-vehicles' },
  { href: '/interventions', label: 'Intervenții', icon: Wrench, testId: 'nav-interventions' },
  { href: '/services', label: 'Servicii & Prețuri', icon: Tag, testId: 'nav-services' },
  { href: '/parts-inventory', label: 'Stoc Piese', icon: Package, testId: 'nav-parts' },
  { href: '/reports', label: 'Rapoarte Marjă', icon: BarChart3, testId: 'nav-reports' },
  { href: '/appointments', label: 'Programări', icon: Calendar, testId: 'nav-appointments' },
  { href: '/invoices', label: 'Facturi', icon: FileText, testId: 'nav-invoices' },
  { href: '/settings', label: 'Setări', icon: Settings, testId: 'nav-settings' },
];

const COLLAPSE_STORAGE_KEY = 'carcore-sidebar-collapsed';

interface DashboardShellProps {
  tenantName: string;
  fullName: string;
  role: string;
  children: React.ReactNode;
}

export default function DashboardShell({ tenantName, fullName, role, children }: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Reading localStorage must happen post-mount to avoid an SSR/client hydration
    // mismatch, so this can't be a useState lazy initializer.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
    } catch {
      // localStorage unavailable (private mode etc) — keep default
    }
  }, []);

  useEffect(() => {
    // Close the mobile drawer on every route change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-zinc-100">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-zinc-900 text-white flex items-center px-4 z-30 gap-3">
        <button
          onClick={() => setIsMobileOpen(true)}
          aria-label="Deschide meniul"
          className="p-1 -ml-1 rounded-lg hover:bg-zinc-800"
        >
          <Menu size={22} />
        </button>
        <span className="font-semibold">CarCore</span>
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:static inset-y-0 left-0 z-50
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          transition-transform duration-200 ease-in-out
          ${isCollapsed ? 'md:w-16' : 'md:w-64'} w-64
          bg-zinc-900 text-white flex flex-col shrink-0
        `}
      >
        <div className={`p-4 border-b border-zinc-800 flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'}`}>
          <div className={isCollapsed ? 'md:hidden' : ''}>
            <div className="font-semibold text-xl">CarCore</div>
            <div className="text-xs text-zinc-400 mt-1 truncate">{tenantName}</div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            aria-label="Închide meniul"
            className="md:hidden p-1 rounded-lg hover:bg-zinc-800"
          >
            <X size={20} />
          </button>

          <button
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Extinde meniul' : 'Restrânge meniul'}
            className="hidden md:block p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
          >
            {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 text-sm overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, testId }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              title={isCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 ${isCollapsed ? 'md:justify-center' : ''}`}
            >
              <Icon size={18} className="shrink-0" />
              <span className={isCollapsed ? 'md:hidden' : ''}>{label}</span>
            </Link>
          ))}
        </nav>

        <div className={`p-4 border-t border-zinc-800 text-xs ${isCollapsed ? 'md:hidden' : ''}`}>
          <div className="text-zinc-400">{fullName}</div>
          <div className="text-zinc-500">{role}</div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="text-red-400 hover:text-red-300 text-xs">Deconectare</button>
          </form>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
