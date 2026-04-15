import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
      .catch((err: { response?: { data?: { message?: string } } }) => {
        if (cancelled) return;
        setError(err.response?.data?.message ?? 'Nao foi possivel carregar as faturas.');
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
        title: 'Faturas na pagina',
        value: String(faturas.length).padStart(2, '0'),
        detail: `Total cadastrado: ${pagination?.total ?? 0}`,
      },
      {
        title: 'Volume financeiro',
        value: brl.format(totalDaPagina),
        detail: 'Soma das faturas exibidas',
      },
      {
        title: 'Pendencias ativas',
        value: String(pendentes),
        detail: `${pagas} pagas nesta pagina`,
      },
      {
        title: 'Ticket medio',
        value: brl.format(ticketMedio),
        detail: 'Media por cobranca',
      },
    ];
  }, [faturas, pagination?.total]);

  if (loading) {
    return (
      <div className="surface-card p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <p className="text-sm font-semibold text-ink-900">Carregando painel de cobrancas...</p>
        <p className="mt-1 text-sm text-muted-500">Sincronizando os ultimos registros.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card p-8 text-center sm:p-12">
        <h1 className="text-2xl font-bold text-ink-900">Falha ao carregar</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <button
          type="button"
          className="btn-secondary mt-5"
          onClick={() => {
            setLoading(true);
            setError('');
            setReloadKey((v) => v + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Painel executivo</p>
            <h1 className="page-title">Controle de Faturas</h1>
            <p className="page-subtitle">
              Visualize o fluxo financeiro, acompanhe status e avance rapidamente para os detalhes
              de cada cobranca.
            </p>
          </div>
          <Link to="/faturas/new" className="btn-primary">
            Cadastrar nova fatura
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.title} className="metric-card">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-500">{metric.title}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-ink-900">{metric.value}</p>
            <p className="mt-1 text-sm text-muted-500">{metric.detail}</p>
          </article>
        ))}
      </section>

      {faturas.length === 0 ? (
        <section className="surface-card p-8 text-center sm:p-12">
          <h2 className="text-xl font-bold text-ink-900">Nenhuma fatura encontrada</h2>
          <p className="mt-2 text-sm text-muted-500">
            Crie a primeira cobranca para iniciar o fluxo operacional.
          </p>
          <Link to="/faturas/new" className="btn-primary mt-5">
            Criar primeira fatura
          </Link>
        </section>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {faturas.map((fatura) => (
              <article key={fatura.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-ink-900">{fatura.nomeDevedor}</p>
                    <p className="mt-0.5 text-sm text-muted-500">{fatura.descricao}</p>
                  </div>
                  <StatusBadge status={fatura.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Valor</p>
                    <p className="mt-1 font-mono font-semibold text-ink-900">{brl.format(fatura.valor)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Vencimento</p>
                    <p className="mt-1 text-ink-900">{dateFormatter.format(new Date(fatura.dataVencimento))}</p>
                  </div>
                </div>

                <Link
                  to={`/faturas/${fatura.id}`}
                  className="mt-4 inline-flex items-center rounded-xl border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Ver detalhes
                </Link>
              </article>
            ))}
          </div>

          <section className="table-shell hidden md:block">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[840px]">
                <thead>
                  <tr>
                    <th>Devedor</th>
                    <th>Descricao</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th className="text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((fatura) => (
                    <tr key={fatura.id} className="hover:bg-brand-50/40">
                      <td>
                        <p className="font-semibold text-ink-900">{fatura.nomeDevedor}</p>
                        <p className="mt-1 text-xs text-muted-500">{fatura.emailDevedor}</p>
                      </td>
                      <td className="text-muted-500">{fatura.descricao}</td>
                      <td className="font-mono font-semibold text-ink-900">{brl.format(fatura.valor)}</td>
                      <td className="text-ink-900">{dateFormatter.format(new Date(fatura.dataVencimento))}</td>
                      <td>
                        <StatusBadge status={fatura.status} />
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/faturas/${fatura.id}`}
                          className="inline-flex items-center rounded-xl border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <section className="surface-card p-4 sm:p-5">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-500">
              Pagina <span className="font-semibold text-ink-900">{pagination.page}</span> de{' '}
              <span className="font-semibold text-ink-900">{pagination.totalPages}</span>
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!pagination.hasPrev}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setPage((value) => value - 1);
                }}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-45"
              >
                Pagina anterior
              </button>
              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setPage((value) => value + 1);
                }}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-45"
              >
                Proxima pagina
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
