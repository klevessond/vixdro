// src/api/painel.ts
//
// Números da tela inicial, numa consulta só.

import { ApiError, apiFetch } from './auth';

export type Painel = {
  clientes: { total: number; novos_mes: number };
  projetos: { ativos: number; aguardando_cliente: number; parados: number; dias_lembrete: number };
  precos: { margem_padrao: string; itens_preco_novo: number; dias: number };
  produtos: number;
  meus_itens: number;
  empresa: { percentual: number; faltando: string[]; logo_url: string | null };
};

export async function obterPainel(): Promise<Painel> {
  const res = await apiFetch('/painel/');
  const texto = await res.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(res.status, data, data?.detail ?? 'Não foi possível carregar o painel.');
  return data as Painel;
}
