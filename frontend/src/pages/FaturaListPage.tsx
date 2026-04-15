import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, DollarSign, Activity, AlertCircle, ChevronRight, Loader2, RefreshCcw, ArrowRight } from 'lucide-react';
import { listFaturas } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { FaturaStatus, type Fatura, type PaginationMeta } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');

export function FaturaListPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    listFaturas(page, 10)
      .then((res) => {
        if (cancelled) return;
        setFaturas(res.data);
        setPagination(res.pagination);
      })
      .catch((err: { response?: { data?: { detail?: string } } }) => {
        if (cancelled) return;
        setError(err.response?.data?.detail ?? 'Não foi possível carregar as faturas.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const metrics = useMemo(() => {
    const totalDaPagina = faturas.reduce((total, item) => total + item.valor, 0);
    const pendentes = faturas.filter(
      (item) => item.status === FaturaStatus.PENDENTE || item.status === FaturaStatus.VENCIDA,
    ).length;
    const pagas = faturas.filter((item) => item.status === FaturaStatus.PAGA).length;
    const ticketMedio = faturas.length > 0 ? totalDaPagina / faturas.length : 0;

    return [
      {
        title: 'Faturas listadas',
        value: String(faturas.length).padStart(2, '0'),
        detail: `Total cadastrado: ${pagination?.total ?? 0}`,
        icon: FileText,
        color: 'text-brand-600',
        bg: 'bg-brand-50'
      },
      {
        title: 'Volume financeiro',
        value: brl.format(totalDaPagina),
        detail: 'Soma visível nesta página',
        icon: DollarSign,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      },
      {
        title: 'Pendências ativas',
        value: String(pendentes),
        detail: `${pagas} pagas nesta página`,
        icon: Activity,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      },
      {
        title: 'Ticket médio',
        value: brl.format(ticketMedio),
        detail: 'Média por cobrança',
        icon: Activity,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50'
      },
    ];
  }, [faturas, pagination?.total]);

  if (loading && faturas.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-muted-200 bg-white/50 border-dashed backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 mb-4" />
        <h3 className="text-lg font-semibold text-ink-900">Carregando painel...</h3>
        <p className="text-sm text-muted-500 mt-1">Sincronizando os registros mais recentes</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <AlertCircle size={24} />
        </div>
        <h1 className="text-xl font-semibold text-ink-900">Falha ao carregar faturas</h1>
        <p className="mt-2 text-sm text-red-600 max-w-sm text-center">{error}</p>
        <button
          type="button"
          className="btn-secondary mt-6"
          onClick={() => {
            setLoading(true);
            setError('');
            setReloadKey((v) => v + 1);
          }}
        >
          <RefreshCcw size={16} />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Faturas emitidas</h1>
          <p className="page-subtitle">
            Acompanhe o volume financeiro, status de recebimento e fluxo da régua de cobrança em tempo real.
          </p>
        </div>
        <Link to="/faturas/new" className="btn-primary w-full sm:w-auto">
          <Plus size={18} />
          Nova Fatura
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.title} className="metric-card group cursor-default">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-500">{metric.title}</p>
              <div className={`p-2 rounded-lg ${metric.bg} ${metric.color} transition-transform group-hover:scale-110`}>
                <metric.icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-ink-900">{metric.value}</p>
            <p className="mt-1 text-[13px] text-muted-500">{metric.detail}</p>
          </article>
        ))}
      </section>

      {faturas.length === 0 ? (
        <section className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-muted-200 border-dashed bg-white text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-5">
            <FileText size={32} />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Nenhuma fatura encontrada</h2>
          <p className="mt-2 text-sm text-muted-500 max-w-md">
            Você ainda não possui cobranças cadastradas. Crie a primeira fatura para dar início ao seu fluxo financeiro.
          </p>
          <Link to="/faturas/new" className="btn-secondary mt-6">
            <Plus size={16} />
            Criar primeira fatura
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Registros recentes</h2>
            {loading && <Loader2 size={16} className="animate-spin text-muted-400" />}
          </div>
          
          <div className="table-shell hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[30%]">Cliente / Detalhes</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status Operacional</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-50' : 'opacity-100 transition-opacity'}>
                {faturas.map((fatura) => (
                  <tr key={fatura.id} className="group">
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-900">{fatura.nomeDevedor}</span>
                        <span className="mt-1 text-[13px] text-muted-500 truncate max-w-[250px]">{fatura.descricao}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono font-medium text-ink-900">{brl.format(fatura.valor)}</span>
                    </td>
                    <td>
                      <span className="text-sm text-ink-700">{dateFormatter.format(new Date(fatura.dataVencimento))}</span>
                    </td>
                    <td>
                      <StatusBadge status={fatura.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/faturas/${fatura.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 hover:text-brand-800 transition-colors opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                      >
                        Abrir
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {faturas.map((fatura) => (
              <Link key={fatura.id} to={`/faturas/${fatura.id}`} className="surface-card p-4 hover:border-brand-300 transition-colors block">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-ink-900">{fatura.nomeDevedor}</p>
                    <p className="text-xs text-muted-500 line-clamp-1">{fatura.descricao}</p>
                  </div>
                  <StatusBadge status={fatura.status} />
                </div>
                <div className="flex items-center justify-between border-t border-muted-100 pt-3">
                  <div>
                    <p className="text-xs font-medium text-muted-500 mb-0.5">Valor</p>
                    <p className="font-mono text-sm font-semibold text-ink-900">{brl.format(fatura.valor)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-500 mb-0.5">Vencimento</p>
                    <p className="text-sm text-ink-900">{dateFormatter.format(new Date(fatura.dataVencimento))}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-muted-200 mt-6 pt-6 sm:flex-row">
              <p className="text-sm text-muted-500">
                Mostrando página <span className="font-medium text-ink-900">{pagination.page}</span> de{' '}
                <span className="font-medium text-ink-900">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPrev}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value - 1);
                  }}
                  className="btn-secondary"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNext}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value + 1);
                  }}
                  className="btn-secondary"
                >
                  Próxima
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
