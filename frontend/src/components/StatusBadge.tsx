import { FaturaStatus } from '../types';

const map: Record<
  FaturaStatus,
  { label: string; className: string; dotClassName: string }
> = {
  [FaturaStatus.PENDENTE]: {
    label: 'Pendente',
    className: 'border-amber-200/60 bg-amber-50/80 text-amber-700 shadow-[0_1px_2px_rgba(251,191,36,0.1)]',
    dotClassName: 'bg-amber-500 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
  },
  [FaturaStatus.PAGA]: {
    label: 'Paga',
    className: 'border-emerald-200/60 bg-emerald-50/80 text-emerald-700 shadow-[0_1px_2px_rgba(52,211,153,0.1)]',
    dotClassName: 'bg-emerald-500 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  },
  [FaturaStatus.VENCIDA]: {
    label: 'Vencida',
    className: 'border-rose-200/60 bg-rose-50/80 text-rose-700 shadow-[0_1px_2px_rgba(251,113,133,0.1)]',
    dotClassName: 'bg-rose-500 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
  },
  [FaturaStatus.CANCELADA]: {
    label: 'Cancelada',
    className: 'border-slate-200/60 bg-slate-50/80 text-slate-700 shadow-[0_1px_2px_rgba(148,163,184,0.1)]',
    dotClassName: 'bg-slate-400 text-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]',
  },
};

export function StatusBadge({ status }: { status: FaturaStatus }) {
  const { label, className, dotClassName } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm ${className}`}
    >
      <span className={`relative flex h-[6px] w-[6px]`}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${dotClassName}`}></span>
        <span className={`relative inline-flex rounded-full h-[6px] w-[6px] ${dotClassName}`}></span>
      </span>
      {label}
    </span>
  );
}
