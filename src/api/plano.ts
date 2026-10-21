// src/api/plano.ts
//
// Plano da conta (Gratuito ou Pro). Por enquanto o Pro é liberado à mão,
// pela equipe vixdro, no admin.

import { ApiError, apiFetch } from './auth';

export type Plano = {
  plano: 'gratuito' | 'pro';
  pro: boolean;
  validade: string | null; // último dia do Pro; null = sem prazo
  dias_restantes: number | null;
  expirado: boolean; // era Pro e venceu
  recursos: { gratuito: string[]; pro: string[] };
};

export async function obterPlano(): Promise<Plano> {
  const res = await apiFetch('/vidraceiros/me/plano/');
  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : null;
  if (!res.ok) throw new ApiError(res.status, data, 'Não foi possível carregar o plano.');
  return data as Plano;
}

/** O servidor recusou porque o recurso é do Pro? (para mostrar o aviso do plano) */
export function ehRequerPro(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 403 && (erro.data as any)?.codigo === 'requer_pro';
}
