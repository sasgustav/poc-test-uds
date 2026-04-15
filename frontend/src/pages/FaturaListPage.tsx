import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFaturas } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import type { Fatura, PaginationMeta } from '../types';

export function FaturaListPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    listFaturas(page, 10)
      .then((res) => {
        setFaturas(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Erro ao carregar faturas'))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return <p className="py-12 text-center text-muted">Carregando…</p>;
  }
  if (error) {
    return <p className="py-12 text-center text-danger">{error}</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Faturas</h1>
        <Link
          to="/faturas/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Fatura
        </Link>
      </div>

      {faturas.length === 0 ? (
        <p className="py-12 text-center text-muted">Nenhuma fatura encontrada.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Devedor</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{f.nomeDevedor}</td>
                  <td className="px-4 py-3 text-muted">{f.descricao}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(f.valor)}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(f.dataVencimento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/faturas/${f.id}`}
                      className="text-primary hover:underline"
                    >
                      Detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-muted">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
