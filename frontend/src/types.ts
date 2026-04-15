export enum FaturaStatus {
  PENDENTE = 'pendente',
  PAGA = 'paga',
  VENCIDA = 'vencida',
  CANCELADA = 'cancelada',
}

export enum LembreteStatus {
  PENDENTE = 'pendente',
  ENVIADO = 'enviado',
  FALHOU = 'falhou',
  DESCARTADO = 'descartado',
}

export enum LembreteTipo {
  D_MENOS_3 = 'D-3',
  D_MAIS_1 = 'D+1',
  D_MAIS_7 = 'D+7',
}

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
