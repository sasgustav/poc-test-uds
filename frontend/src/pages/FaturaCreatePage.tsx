import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_340px]">
      <section className="surface-card p-6 sm:p-8">
        <div className="mb-6">
          <Link to="/" className="mb-4 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-600">
            Voltar ao painel
          </Link>
          <p className="eyebrow">Onboarding financeiro</p>
          <h1 className="page-title">Cadastrar nova fatura</h1>
          <p className="page-subtitle">
            Registre os dados da cobranca para acionar automaticamente o fluxo de acompanhamento.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="nomeDevedor">
                Nome do devedor
              </label>
              <input
                id="nomeDevedor"
                name="nomeDevedor"
                required
                className="input-control"
                placeholder="Ex: Marina Souza"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="emailDevedor">
                E-mail do devedor
              </label>
              <input
                id="emailDevedor"
                name="emailDevedor"
                type="email"
                required
                className="input-control"
                placeholder="cliente@empresa.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="descricao">
                Descricao da cobranca
              </label>
              <textarea
                id="descricao"
                name="descricao"
                required
                rows={4}
                className="input-control resize-y"
                placeholder="Descreva o servico, periodo ou referencia da fatura"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="valor">
                Valor (R$)
              </label>
              <input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="input-control"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="dataVencimento">
                Data de vencimento
              </label>
              <input
                id="dataVencimento"
                name="dataVencimento"
                type="date"
                required
                className="input-control"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="input-label" htmlFor="timezone">
                Timezone operacional
              </label>
              <select id="timezone" name="timezone" defaultValue="America/Sao_Paulo" className="input-control">
                <option value="America/Sao_Paulo">America/Sao_Paulo (padrao)</option>
                <option value="America/Fortaleza">America/Fortaleza</option>
                <option value="America/Campo_Grande">America/Campo_Grande</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Criando fatura...' : 'Criar fatura'}
            </button>
            <Link to="/" className="btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="surface-card p-6">
          <h2 className="text-lg font-bold text-ink-900">Boas praticas de cadastro</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-500">
            <li className="rounded-xl border border-muted-300/70 bg-white/70 p-3">
              Use descricao objetiva para facilitar conciliacao financeira e auditoria.
            </li>
            <li className="rounded-xl border border-muted-300/70 bg-white/70 p-3">
              Confirme o e-mail do devedor para garantir o envio correto dos lembretes.
            </li>
            <li className="rounded-xl border border-muted-300/70 bg-white/70 p-3">
              Defina data real de vencimento para manter previsibilidade de caixa.
            </li>
          </ul>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-bold text-ink-900">Fluxo automatico</h2>
          <p className="mt-3 text-sm text-muted-500">
            Assim que a fatura for criada, a regua de cobranca pode agendar lembretes de acordo com
            as regras de negocio do backend.
          </p>
          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-sm">
            <p className="font-semibold text-brand-700">Sugestao:</p>
            <p className="mt-1 text-brand-700/90">
              Mantenha padrao de nomenclatura para facilitar filtragem e analise operacional.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
