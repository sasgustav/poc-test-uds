import { FaturaStatus } from '../types';

const map: Record<FaturaStatus, { label: string; className: string }> = {
  [FaturaStatus.PENDENTE]: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-800',
  },
  [FaturaStatus.PAGA]: {
    label: 'Paga',
    className: 'bg-green-100 text-green-800',
  },
  [FaturaStatus.VENCIDA]: {
    label: 'Vencida',
    className: 'bg-red-100 text-red-800',
  },
  [FaturaStatus.CANCELADA]: {
    label: 'Cancelada',
    className: 'bg-gray-100 text-gray-600',
  },
};

export function StatusBadge({ status }: { status: FaturaStatus }) {
  const { label, className } = map[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
