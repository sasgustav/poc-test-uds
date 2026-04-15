import { FaturaStatus } from '../types';

const map: Record<
  FaturaStatus,
  { label: string; className: string; dotClassName: string }
> = {
  [FaturaStatus.PENDENTE]: {
    label: 'Pendente',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
  [FaturaStatus.PAGA]: {
    label: 'Paga',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  [FaturaStatus.VENCIDA]: {
    label: 'Vencida',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    dotClassName: 'bg-rose-500',
  },
  [FaturaStatus.CANCELADA]: {
    label: 'Cancelada',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    dotClassName: 'bg-slate-500',
  },
};

export function StatusBadge({ status }: { status: FaturaStatus }) {
  const { label, className, dotClassName } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
      {label}
    </span>
  );
}
