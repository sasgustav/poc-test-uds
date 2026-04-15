import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        nomeDevedor: fd.get('nomeDevedor') as string,
        emailDevedor: fd.get('emailDevedor') as string,
        descricao: fd.get('descricao') as string,
        valor: Number(fd.get('valor')),
        dataVencimento: fd.get('dataVencimento') as string,
      });
      navigate(`/faturas/${fatura.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data
          ?.message ?? 'Erro ao criar fatura';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Nova Fatura</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium">Nome do Devedor</label>
          <input name="nomeDevedor" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">E-mail do Devedor</label>
          <input name="emailDevedor" type="email" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descrição</label>
          <input name="descricao" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Valor (R$)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Data de Vencimento</label>
          <input name="dataVencimento" type="date" required className={inputClass} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Criando…' : 'Criar Fatura'}
        </button>
      </form>
    </div>
  );
}
