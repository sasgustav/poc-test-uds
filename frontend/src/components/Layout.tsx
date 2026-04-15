import { Link, Outlet, useLocation } from 'react-router-dom';

export function Layout() {
  const { pathname } = useLocation();
  const links = [
    { href: '/', label: 'Painel de Faturas' },
    { href: '/faturas/new', label: 'Nova Fatura' },
  ];

  return (
    <div className="app-shell">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="surface-card mb-7 overflow-hidden px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="eyebrow">Receivables Platform</p>
              <Link to="/" className="block text-2xl font-extrabold tracking-[-0.03em] text-ink-900">
                Cobranca Pro Suite
              </Link>
              <p className="max-w-2xl text-sm text-muted-500">
                Operacao centralizada para faturas, status e regua de cobranca com controle em
                tempo real.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operacao ativa
              </span>

              <nav className="flex flex-wrap gap-2">
                {links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`nav-link ${active ? 'nav-link-active' : ''}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        <main className="pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
