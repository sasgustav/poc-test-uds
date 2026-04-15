import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle2, FilePlus, Sparkles, User, 
  Mail, FileText, DollarSign, Calendar, Globe, AlertTriangle, Loader2 
} from 'lucide-react';
import { createFatura } from '../api';

export function FaturaCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    try {
      const fatura = await createFatura({
        nomeDevedor: String(fd.get('nomeDevedor') ?? ''),
        emailDevedor: String(fd.get('emailDevedor') ?? ''),
        descricao: String(fd.get('descricao') ?? ''),
        valor: Number(fd.get('valor')),
        dataVencimento: String(fd.get('dataVencimento') ?? ''),
        timezone: String(fd.get('timezone') ?? 'America/Sao_Paulo'),
      });
      navigate(`/faturas/${fatura.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string | string[] } } }).response?.data
          ?.detail ?? 'Erro ao criar fatura.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_380px] animate-in">
      <section className="surface-card p-6 sm:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-6">
          <ArrowLeft size={16} />
          Voltar ao painel
        </Link>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-brand-600">
            <FilePlus size={20} />
            <p className="eyebrow !mb-0 text-brand-600">Onboarding financeiro</p>
          </div>
          <h1 className="page-title">Emitir nova cobrança</h1>
          <p className="page-subtitle">
            Preencha os dados abaixo para registrar a fatura. A régua de lembretes será acionada instantaneamente.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={18} className="shrslate-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2 mb-4">Dados do Sacado</h3>
            
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1 border-r-0 md:pr-2">
                <label className="input-label" htmlFor="nomeDevedor">
                  Nome do cliente
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <input
                    id="nomeDevedor"
                    name="nomeDevedor"
                    required
                    className="input-control pl-9"
                    placeholder="Ex: Marina Souza LTDA"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="input-label" htmlFor="emailDevedor">
                  E-mail de faturamento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-slate-400" />
                  </div>
                  <input
                    id="emailDevedor"
                    name="emailDevedor"
                    type="email"
                    required
                    className="input-control pl-9"
                    placeholder="financeiro@empresa.com"
                  />
                </div>
              </div>
            </div>
            
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2 mb-4 pt-4">Detalhes Financeiros</h3>

            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="descricao">
                Descrição do fornecimento
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText size={16} className="text-slate-400" />
                </div>
                <textarea
                  id="descricao"
                  name="descricao"
                  required
                  rows={3}
                  className="input-control pl-9 resize-y"
                  placeholder="Referência do contrato, período do serviço ou detalhamento dos itens cobrados."
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="input-label" htmlFor="valor">
                  Valor Total
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign size={16} className="text-slate-400" />
                  </div>
                  <input
                    id="valor"
                    name="valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="input-control pl-9 font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="input-label" htmlFor="dataVencimento">
                  Vencimento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={16} className="text-slate-400" />
                  </div>
                  <input
                    id="dataVencimento"
                    name="dataVencimento"
                    type="date"
                    required
                    className="input-control pl-9"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="input-label" htmlFor="timezone">
                  Fuso Operacional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe size={16} className="text-slate-400" />
                  </div>
                  <select id="timezone" name="timezone" defaultValue="America/Sao_Paulo" className="input-control pl-9 text-[13px]">
                    <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                    <option value="America/Fortaleza">America/Fortaleza</option>
                    <option value="America/Campo_Grande">America/Campo_Grande</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6 mt-4 border-t border-slate-200">
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? <Loader2 className="animate-spin -ml-1 mr-1" size={16} /> : <CheckCircle2 size={16} />}
              {submitting ? 'Emitindo...' : 'Emitir Fatura Oficial'}
            </button>
            <Link to="/" className="btn-secondary w-full sm:w-auto">
              Cancelar operação
            </Link>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="surface-card p-6 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-2 mb-4 text-indigo-700">
            <Sparkles size={20} />
            <h2 className="text-lg font-bold text-slate-900">Checkout Eficiente</h2>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-500 mb-6">
            Preencha os dados com exatidão. O sistema assume o fluxo de notificação automaticamente para maximizar a conversão.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5 text-[13px] text-slate-500">
              <div className="flex bg-slate-100 p-1.5 rounded-md text-slate-900 mt-0.5"><FileText size={14} /></div>
              <span>Seja clínico na descrição. Termos confusos aumentam a chance de retenção (chargeback) no D+1.</span>
            </li>
            <li className="flex items-start gap-2.5 text-[13px] text-slate-500">
              <div className="flex bg-slate-100 p-1.5 rounded-md text-slate-900 mt-0.5"><Mail size={14} /></div>
              <span>A auditoria da régua de comunicação depende da validade do e-mail do sacado.</span>
            </li>
            <li className="flex items-start gap-2.5 text-[13px] text-slate-500">
              <div className="flex bg-slate-100 p-1.5 rounded-md text-slate-900 mt-0.5"><Calendar size={14} /></div>
              <span>A régua é orquestrada (D-3, D+1 e D+7) a partir da Data de Vencimento preenchida.</span>
            </li>
          </ul>
        </section>

        <section className="surface-card p-6 bg-gradient-to-br from-brand-50 to-white">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800 mb-2">Motor de Cobrança</h2>
          <p className="text-[13px] text-brand-700/80 mb-4 leading-relaxed">
            Assim que a fatura é processada, a fila de agendamento (cron-jobs) planeja automaticamente até 3 notificações.
          </p>
          <div className="rounded-xl border border-brand-200/60 bg-white/60 p-4 text-[12px] shadow-sm">
            <p className="font-semibold text-brand-900 mb-1 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Standard API
            </p>
            <p className="text-brand-800">
              As faturas vencidas são reconciliadas em background (Midnight cron). Configure o Timezone adequadamente à sede do cliente.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
