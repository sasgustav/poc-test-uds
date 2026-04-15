import { Link, Outlet, useLocation } from 'react-router-dom';

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold text-primary">
            Cobrança <span className="text-sm font-normal text-muted">Dashboard</span>
          </Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link
              to="/"
              className={pathname === '/' ? 'text-primary' : 'text-muted hover:text-gray-900'}
            >
              Faturas
            </Link>
            <Link
              to="/faturas/new"
              className={
                pathname === '/faturas/new' ? 'text-primary' : 'text-muted hover:text-gray-900'
              }
            >
              Nova Fatura
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
