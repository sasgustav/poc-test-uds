import axios from 'axios';
import type { CreateFaturaPayload, Fatura, ListFaturasResponse } from './types';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'minha-chave-secreta',
    'X-User-Id': 'tenant-demo',
  },
});

export async function listFaturas(page = 1, pageSize = 10): Promise<ListFaturasResponse> {
  const { data } = await api.get<ListFaturasResponse>('/v1/faturas', {
    params: { page, pageSize },
  });
  return data;
}

export async function getFatura(id: string): Promise<Fatura> {
  const { data } = await api.get<Fatura>(`/v1/faturas/${encodeURIComponent(id)}`);
  return data;
}

export async function createFatura(payload: CreateFaturaPayload): Promise<Fatura> {
  const idempotencyKey = crypto.randomUUID();
  const { data } = await api.post<Fatura>('/v1/faturas', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}

export async function updateFaturaStatus(
  id: string,
  status: 'paga' | 'cancelada',
): Promise<Fatura> {
  const { data } = await api.patch<Fatura>(
    `/v1/faturas/${encodeURIComponent(id)}/status`,
    { status },
  );
  return data;
}

export async function healthCheck(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>('/health');
  return data;
}
