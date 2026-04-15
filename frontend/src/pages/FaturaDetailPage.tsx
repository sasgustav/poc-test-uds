import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFatura, updateFaturaStatus } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { FaturaStatus, LembreteStatus, type Fatura } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const transitionMap: Record<string, Array<'paga' | 'cancelada'>> = {
  [FaturaStatus.PENDENTE]: ['paga', 'cancelada'],
  [FaturaStatus.VENCIDA]: ['paga', 'cancelada'],
};

const statusLabelMap: Record<FaturaStatus, string> = {
  [FaturaStatus.PENDENTE]: 'Pendente',
  [FaturaStatus.PAGA]: 'Paga',
  [FaturaStatus.VENCIDA]: 'Vencida',
  [FaturaStatus.CANCELADA]: 'Cancelada',
};

const lembreteStatusMap: Record<LembreteStatus, { label: string; className: string }> = {
  [LembreteStatus.PENDENTE]: {
    label: 'Pendente',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  [LembreteStatus.ENVIADO]: {
    label: 'Enviado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  [LembreteStatus.FALHOU]: {
    label: 'Falhou',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  [LembreteStatus.DESCARTADO]: {
    label: 'Descartado',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

function dueHint(dateIso: string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(dateIso);
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays > 1) return `Vence em ${diffDays} dias`;
  if (diffDays === 1) return 'Vence amanha';
  if (diffDays === 0) return 'Vence hoje';
  if (diffDays === -1) return 'Venceu ontem';
  return `Venceu ha ${Math.abs(diffDays)} dias`;
}

export function FaturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getFatura(id)
      .then((data) => {
        if (!cancelled) setFatura(data);
      })
      .catch((err: { response?: { data?: { detail?: string } } }) => {
        if (!cancelled) setLoadError(err.response?.data?.detail ?? 'Nao foi possivel carregar a fatura.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleStatusChange(status: 'paga' | 'cancelada') {
    if (!id) return;
    setActionLoading(true);
    setActionError('');

    try {
      const updated = await updateFaturaStatus(id, status);
      setFatura(updated);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'Nao foi possivel atualizar o status.';
      setActionError(detail);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="surface-card p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <p className="text-sm font-semibold text-ink-900">Carregando detalhes da fatura...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="surface-card p-8 text-center sm:p-12">
        <h1 className="text-2xl font-bold text-ink-900">Erro ao carregar detalhes</h1>
        <p className="mt-2 text-sm text-rose-700">{loadError}</p>
        <Link to="/" className="btn-secondary mt-5">
          Voltar para o painel
        </Link>
      </section>
    );
  }

  if (!fatura) return null;

  const actions = transitionMap[fatura.status] ?? [];
  const stateFlow: FaturaStatus[] = [
    FaturaStatus.PENDENTE,
    FaturaStatus.VENCIDA,
    FaturaStatus.PAGA,
    FaturaStatus.CANCELADA,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="btn-secondary">
          Voltar ao painel
        </Link>
        <p className="font-mono text-xs text-muted-500">ID: {fatura.id}</p>
      </div>

      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Visao da cobranca</p>
            <h1 className="page-title">{fatura.descricao}</h1>
            <p className="page-subtitle">
              Devedor: <span className="font-semibold text-ink-900">{fatura.nomeDevedor}</span> (
              {fatura.emailDevedor})
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={fatura.status} />
              <span className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {dueHint(fatura.dataVencimento)}
              </span>
            </div>
          </div>

          <aside className="w-full rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 lg:max-w-[290px]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Valor da fatura</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.02em] text-ink-900">
              {brl.format(fatura.valor)}
            </p>
            <p className="mt-3 text-xs text-muted-500">
              Vencimento: {dateFormatter.format(new Date(fatura.dataVencimento))}
            </p>
            <p className="mt-1 text-xs text-muted-500">
              Timezone: <span className="font-semibold text-ink-900">{fatura.timezone}</span>
            </p>
          </aside>
        </div>

        {actionError && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {actionError}
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.includes('paga') && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('paga')}
                className="btn-success disabled:cursor-not-allowed disabled:opacity-55"
              >
                Marcar como paga
              </button>
            )}
            {actions.includes('cancelada') && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('cancelada')}
                className="btn-danger disabled:cursor-not-allowed disabled:opacity-55"
              >
                Cancelar fatura
              </button>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Criada em</p>
          <p className="mt-2 text-sm font-semibold text-ink-900">{dateTimeFormatter.format(new Date(fatura.createdAt))}</p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Atualizada em</p>
          <p className="mt-2 text-sm font-semibold text-ink-900">{dateTimeFormatter.format(new Date(fatura.updatedAt))}</p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Status atual</p>
          <p className="mt-2 text-sm font-semibold text-ink-900">{statusLabelMap[fatura.status]}</p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Lembretes</p>
          <p className="mt-2 text-sm font-semibold text-ink-900">{fatura.lembretes.length} agendado(s)</p>
        </article>
      </section>

      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-ink-900">Fluxo de estados</h2>
          <p className="text-sm text-muted-500">Transicoes validas: pendente/vencida para paga ou cancelada.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stateFlow.map((state) => {
            const active = state === fatura.status;
            return (
              <article
                key={state}
                className={`rounded-2xl border p-4 ${
                  active
                    ? 'border-brand-200 bg-brand-50 shadow-[0_14px_28px_-22px_rgba(31,94,255,1)]'
                    : 'border-muted-300/80 bg-white'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-500">Estado</p>
                <p className="mt-2 text-sm font-bold text-ink-900">{statusLabelMap[state]}</p>
                {active && (
                  <p className="mt-1 text-xs font-semibold text-brand-700">Estado atual</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-ink-900">Lembretes da regua</h2>
          <p className="text-sm text-muted-500">Historico de envios e tentativas por etapa.</p>
        </div>

        {fatura.lembretes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-muted-300 bg-white/70 p-5 text-sm text-muted-500">
            Ainda nao existem lembretes vinculados a esta fatura.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {fatura.lembretes.map((lembrete) => {
              const style = lembreteStatusMap[lembrete.status];
              return (
                <article key={lembrete.id} className="rounded-2xl border border-muted-300/80 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-ink-900">{lembrete.tipo}</p>
                      <p className="mt-1 text-sm text-muted-500">
                        Envio previsto: {dateTimeFormatter.format(new Date(lembrete.dataEnvio))}
                      </p>
                      <p className="mt-1 text-xs text-muted-500">
                        Tentativas: <span className="font-semibold text-ink-900">{lembrete.tentativas}</span>
                        {lembrete.proximaTentativa && (
                          <>
                            {' '}
                            | Proxima: {dateTimeFormatter.format(new Date(lembrete.proximaTentativa))}
                          </>
                        )}
                      </p>
                      {lembrete.erro && (
                        <p className="mt-2 text-xs font-medium text-rose-700">Erro: {lembrete.erro}</p>
                      )}
                    </div>

                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${style.className}`}>
                      {style.label}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
