// src/api/precos.ts
//
// Padrões de preço do vidraceiro: todo projeto novo nasce com eles.
// O cliente final nunca vê estes valores.

import { ApiError, apiFetch } from './auth';

export type PrecosPadrao = {
  margem_padrao: string;
  mao_de_obra_m2_padrao: string;
  mao_de_obra_minima_padrao: string;
  perda_padrao: string;
  validade_padrao: string | number;
};

async function ler<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const primeira = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
    throw new ApiError(res.status, data, typeof primeira === 'string' ? primeira : padrao);
  }
  return data as T;
}

export async function obterPrecosPadrao(): Promise<PrecosPadrao> {
  return ler(await apiFetch('/vidraceiros/me/precos/'), 'Não foi possível carregar os preços.');
}

export async function salvarPrecosPadrao(p: PrecosPadrao): Promise<PrecosPadrao> {
  const res = await apiFetch('/vidraceiros/me/precos/', { method: 'PATCH', body: JSON.stringify(p) });
  return ler(res, 'Não foi possível salvar.');
}
