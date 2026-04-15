export const FaturaStatus = {
  PENDENTE: 'pendente',
  PAGA: 'paga',
  VENCIDA: 'vencida',
  CANCELADA: 'cancelada',
} as const;

export type FaturaStatus = (typeof FaturaStatus)[keyof typeof FaturaStatus];

export const LembreteStatus = {
  PENDENTE: 'pendente',
  ENVIADO: 'enviado',
  FALHOU: 'falhou',
  DESCARTADO: 'descartado',
} as const;

export type LembreteStatus = (typeof LembreteStatus)[keyof typeof LembreteStatus];

export const LembreteTipo = {
  D_MENOS_3: 'D-3',
  D_MAIS_1: 'D+1',
  D_MAIS_7: 'D+7',
} as const;

export type LembreteTipo = (typeof LembreteTipo)[keyof typeof LembreteTipo];

export interface Lembrete {
  id: string;
  tipo: LembreteTipo;
  status: LembreteStatus;
  dataEnvio: string;
  tentativas: number;
  proximaTentativa: string | null;
  erro: string | null;
}

export interface Fatura {
  id: string;
  nomeDevedor: string;
  emailDevedor: string;
  descricao: string;
  valor: number;
  valorCents: number;
  dataVencimento: string;
  timezone: string;
  status: FaturaStatus;
  createdAt: string;
  updatedAt: string;
  lembretes: Lembrete[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListFaturasResponse {
  data: Fatura[];
  pagination: PaginationMeta;
}

export interface CreateFaturaPayload {
  nomeDevedor: string;
  emailDevedor: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  timezone?: string;
}
