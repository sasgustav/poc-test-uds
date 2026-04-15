import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Activity, UserCircle } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';

const statusConfig = {
  online:   { label: 'API Online',      border: 'border-emerald-200', bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', ping: 'bg-emerald-400' },
  offline:  { label: 'API Offline',      border: 'border-red-200',     bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500',     ping: 'bg-red-400' },
  checking: { label: 'Verificando…',     border: 'border-amber-200',   bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500',   ping: 'bg-amber-400' },
} as const;

export function Layout() {
  const { pathname } = useLocation();
  const backendStatus = useBackendStatus();
  const cfg = statusConfig[backendStatus];
  const links = [
    { href: '/', label: 'Painel de Faturas', icon: LayoutDashboard },
    { href: '/faturas/new', label: 'Nova Fatura', icon: PlusCircle },
  ];

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white shadow-sm transition-transform group-hover:scale-105">
                <Activity size={18} />
              </div>
              <span className="text-lg font-semibold tracking-tight text-ink-900">
                CobrançaPro
              </span>
            </Link>

            <nav className="hidden items-center md:flex gap-1">
              {links.map((link) => {
                const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`nav-link ${active ? 'nav-link-active' : ''}`}
                  >
                    <Icon size={16} className={active ? 'text-ink-900' : 'text-muted-400'} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden sm:flex items-center gap-2 rounded-full border ${cfg.border} ${cfg.bg} px-2.5 py-1 text-[11px] font-semibold ${cfg.text} uppercase tracking-wide transition-colors duration-300`}>
              <span className="relative flex h-2 w-2">
                {backendStatus === 'online' && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ping} opacity-75`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`}></span>
              </span>
              {cfg.label}
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-muted-200 bg-white text-muted-500 hover:text-ink-900 hover:bg-muted-50 transition-colors">
              <UserCircle size={20} />
            </button>
          </div>
        </div>
        {/* Mobile Navigation */}
        <div className="flex h-12 items-center overflow-x-auto border-t border-muted-200 px-4 md:hidden gap-1">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`nav-link whitespace-nowrap ${active ? 'nav-link-active' : ''}`}
              >
                <Icon size={14} className={active ? 'text-ink-900' : 'text-muted-400'} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-muted-200 bg-white py-6 text-center text-sm text-muted-500">
        <p>
          Desenvolvido por{' '}
          <a
            href="https://www.linkedin.com/in/gustavo-vasconcelos-software-engineer/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink-900 transition-colors hover:text-brand-600 hover:underline"
          >
            Gustavo Vasconcelos
          </a>
        </p>
      </footer>
    </div>
  );
}
