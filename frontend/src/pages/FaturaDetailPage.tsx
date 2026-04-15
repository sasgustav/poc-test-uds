import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFatura, updateFaturaStatus } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { FaturaStatus, LembreteStatus, type Fatura } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const transitionMap: Record<string, ('paga' | 'cancelada')[]> = {
  [FaturaStatus.PENDENTE]: ['paga', 'cancelada'],
  [FaturaStatus.VENCIDA]: ['paga', 'cancelada'],
};

const lembreteStatusMap: Record<LembreteStatus, string> = {
  [LembreteStatus.PENDENTE]: 'bg-yellow-100 text-yellow-800',
  [LembreteStatus.ENVIADO]: 'bg-green-100 text-green-800',
  [LembreteStatus.FALHOU]: 'bg-red-100 text-red-800',
  [LembreteStatus.DESCARTADO]: 'bg-gray-100 text-gray-600',
};

export function FaturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    getFatura(id)
      .then(setFatura)
      .catch((err) => setError(err.response?.data?.message ?? 'Erro ao carregar fatura'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleStatusChange(status: 'paga' | 'cancelada') {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await updateFaturaStatus(id, status);
      setFatura(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Erro ao atualizar status';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <p className="py-12 text-center text-muted">Carregando…</p>;
  if (error) return <p className="py-12 text-center text-danger">{error}</p>;
  if (!fatura) return null;

  const actions = transitionMap[fatura.status] ?? [];

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Voltar
      </Link>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{fatura.descricao}</h1>
            <p className="text-sm text-muted">ID: {fatura.id}</p>
          </div>
          <StatusBadge status={fatura.status} />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-muted">Devedor</span>
            <p>{fatura.nomeDevedor}</p>
          </div>
          <div>
            <span className="font-medium text-muted">E-mail</span>
            <p>{fatura.emailDevedor}</p>
          </div>
          <div>
            <span className="font-medium text-muted">Valor</span>
            <p className="font-mono text-lg font-semibold">{brl.format(fatura.valor)}</p>
          </div>
          <div>
            <span className="font-medium text-muted">Vencimento</span>
            <p>{new Date(fatura.dataVencimento).toLocaleDateString('pt-BR')}</p>
          </div>
          <div>
            <span className="font-medium text-muted">Criado em</span>
            <p>{new Date(fatura.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <span className="font-medium text-muted">Atualizado em</span>
            <p>{new Date(fatura.updatedAt).toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Status transition diagram */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">Máquina de Estados</h3>
          <div className="flex items-center justify-center gap-2 text-xs">
            {[FaturaStatus.PENDENTE, FaturaStatus.VENCIDA, FaturaStatus.PAGA, FaturaStatus.CANCELADA].map(
              (s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted">·</span>}
                  <span
                    className={`rounded px-2 py-1 font-medium ${
                      s === fatura.status ? 'bg-primary text-white' : 'bg-white border text-muted'
                    }`}
                  >
                    {s}
                  </span>
                </span>
              ),
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            pendente → paga | cancelada · vencida → paga | cancelada
          </p>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex gap-3">
            {actions.includes('paga') && (
              <button
                disabled={actionLoading}
                onClick={() => handleStatusChange('paga')}
                className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Marcar como Paga
              </button>
            )}
            {actions.includes('cancelada') && (
              <button
                disabled={actionLoading}
                onClick={() => handleStatusChange('cancelada')}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Cancelar Fatura
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lembretes */}
      {fatura.lembretes.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Lembretes Agendados</h2>
          <div className="space-y-3">
            {fatura.lembretes.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div>
                  <span className="font-mono font-medium">{l.tipo}</span>
                  <span className="ml-2 text-muted">
                    Envio: {new Date(l.dataEnvio).toLocaleString('pt-BR')}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lembreteStatusMap[l.status]}`}
                >
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
