import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  Activity, ArrowLeft, CalendarClock, CreditCard, Banknote, Clock, MailWarning, 
  CheckCircle2, XCircle, Loader2, User, Mail, Globe, 
  RefreshCcw, AlertTriangle, AlertCircle 
} from 'lucide-react';
import { getFatura, updateFaturaStatus } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { FaturaStatus, LembreteStatus, type Fatura } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
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

const lembreteStatusMap: Record<LembreteStatus, { label: string; className: string, icon: any }> = {
  [LembreteStatus.PENDENTE]: {
    label: 'Agendado',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock
  },
  [LembreteStatus.ENVIADO]: {
    label: 'Enviado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2
  },
  [LembreteStatus.FALHOU]: {
    label: 'Falhou',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertCircle
  },
  [LembreteStatus.DESCARTADO]: {
    label: 'Cancelado',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    icon: XCircle
  },
};

function dueHint(dateIso: string): { text: string, urgent: boolean } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(dateIso);
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays > 1) return { text: `Vence em ${diffDays} dias`, urgent: false };
  if (diffDays === 1) return { text: 'Vence amanhã', urgent: true };
  if (diffDays === 0) return { text: 'Vence hoje!', urgent: true };
  if (diffDays === -1) return { text: 'Venceu ontem', urgent: true };
  return { text: `Venceu há ${Math.abs(diffDays)} dias`, urgent: true };
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
        if (!cancelled) setLoadError(err.response?.data?.detail ?? 'Não foi possível carregar a fatura.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleStatusChange(status: 'paga' | 'cancelada') {
    if (!id || actionLoading) return;
    setActionLoading(true);
    setActionError('');

    try {
      const updated = await updateFaturaStatus(id, status);
      setFatura(updated);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'Não foi possível atualizar o status.';
      setActionError(detail);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white/50 border-dashed backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Carregando detalhes...</h3>
        <p className="text-sm text-slate-500 mt-1">Obtendo informações em tempo real</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <AlertCircle size={24} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Falha ao carregar</h1>
        <p className="mt-2 text-sm text-red-600 max-w-sm text-center">{loadError}</p>
        <Link to="/" className="btn-secondary mt-6">
          <ArrowLeft size={16} />
          Voltar ao painel
        </Link>
      </div>
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

  const due = dueHint(fatura.dataVencimento);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} />
          Voltar ao painel
        </Link>
        <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1">
          <span className="text-xs font-mono font-medium text-slate-500">ID</span>
          <span className="text-xs font-mono text-slate-900 select-all">{fatura.id}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          <section className="surface-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="eyebrow flex items-center gap-1.5"><Banknote size={14} /> Detalhes da Cobrança</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">{fatura.descricao}</h1>
              </div>
              <StatusBadge status={fatura.status} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1 flex items-center gap-1.5"><User size={14} /> Devedor</p>
                <p className="font-semibold text-slate-900">{fatura.nomeDevedor}</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Mail size={14} /> E-mail de Contato</p>
                <p className="text-slate-900">{fatura.emailDevedor}</p>
              </div>
            </div>

            {actionError && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle size={18} className="shrslate-0 mt-0.5" />
                <p>{actionError}</p>
              </div>
            )}

            {actions.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-slate-200">
                {actions.includes('paga') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('paga')}
                    className="btn-success"
                  >
                    {actionLoading && <Loader2 className="animate-spin -ml-1 border-emerald-600" size={16} />}
                    <CheckCircle2 size={18} className={actionLoading ? 'hidden' : ''} />
                    Confirmar Pagamento
                  </button>
                )}
                {actions.includes('cancelada') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('cancelada')}
                    className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                  >
                    {actionLoading && <Loader2 className="animate-spin -ml-1" size={16} />}
                    <XCircle size={18} className={actionLoading ? 'hidden' : ''} />
                    Cancelar Cobrança
                  </button>
                )}
              </div>
            )}
          </section>
          
          <section className="surface-card p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <MailWarning size={18} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Régua de Lembretes</h2>
            </div>
            
            {fatura.lembretes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <p className="text-sm font-medium text-slate-500">Nenhum lembrete programado.</p>
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {fatura.lembretes.map((lembrete) => {
                  const style = lembreteStatusMap[lembrete.status];
                  const Icon = style.icon;
                  return (
                    <div key={lembrete.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow-sm md:mx-auto shrslate-0 z-10 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                        <Icon size={16} />
                      </div>
                      
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-900">
                            {lembrete.tipo}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${style.className}`}>
                            {style.label}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-500 mb-1">
                          <span className="font-medium text-slate-900">Previsto:</span> {dateTimeFormatter.format(new Date(lembrete.dataEnvio))}
                        </p>
                        
                        <div className="flex items-center gap-3 text-[12px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                          <span>Tentativas: <strong className="text-slate-900">{lembrete.tentativas}</strong></span>
                          {lembrete.proximaTentativa && (
                            <span className="flex items-center gap-1">
                              <RefreshCcw size={10} />
                              Próxima: {dateTimeFormatter.format(new Date(lembrete.proximaTentativa))}
                            </span>
                          )}
                        </div>
                        
                        {lembrete.erro && (
                          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-2.5 text-[12px] text-red-700">
                            <span className="font-semibold block mb-0.5">Erro na última tentativa:</span>
                            {lembrete.erro}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <aside className="surface-card overflow-hidden">
            <div className="bg-slate-900 px-6 py-8 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CreditCard size={80} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400 mb-2 relative z-10">Resumo Financeiro</p>
              <p className="font-mono text-4xl font-semibold tracking-tight relative z-10">
                {brl.format(fatura.valor)}
              </p>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="pb-5 border-b border-slate-100">
                <p className="text-[13px] font-medium text-slate-500 mb-1 flex items-center gap-1.5"><CalendarClock size={14} /> Data de Vencimento</p>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{dateFormatter.format(new Date(fatura.dataVencimento))}</p>
                  {fatura.status === FaturaStatus.PENDENTE && (
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${due.urgent ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {due.text}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="pb-5 border-b border-slate-100">
                <p className="text-[13px] font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Globe size={14} /> Timezone / Local</p>
                <p className="font-medium text-slate-900">{fatura.timezone}</p>
              </div>
              
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-2 flex items-center gap-1.5"><Activity size={14} /> Ciclo de Vida</p>
                <div className="flex flex-col gap-3">
                  {stateFlow.map((state, index) => {
                    const active = state === fatura.status;
                    const passed = stateFlow.indexOf(fatura.status) >= index && fatura.status !== FaturaStatus.CANCELADA && fatura.status !== FaturaStatus.VENCIDA;
                    const isFailed = (state === FaturaStatus.VENCIDA || state === FaturaStatus.CANCELADA) && state === fatura.status;
                    
                    return (
                      <div key={state} className={`flex items-center gap-3 ${active ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`relative flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          active ? 'border-brand-600 bg-brand-50 text-brand-600' : 
                          isFailed ? 'border-red-500 bg-red-50 text-red-500' :
                          passed ? 'border-emerald-500 bg-emerald-50 text-emerald-500' : 'border-slate-300 bg-slate-50 text-transparent'
                        }`}>
                          {(passed || active) ? <CheckCircle2 size={12} className={isFailed ? 'hidden' : ''} /> : null}
                          {isFailed ? <XCircle size={12} /> : null}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}> {statusLabelMap[state]} </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>

          <aside className="surface-card p-6">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-4">Metadados Internos</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-slate-500">Registro Criado</p>
                <p className="text-sm font-medium text-slate-900">{dateTimeFormatter.format(new Date(fatura.createdAt))}</p>
              </div>
              <div>
                <p className="text-[12px] text-slate-500">Última Atualização</p>
                <p className="text-sm font-medium text-slate-900">{dateTimeFormatter.format(new Date(fatura.updatedAt))}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
