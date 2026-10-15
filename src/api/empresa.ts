// src/api/empresa.ts
//
// Logomarca da vidraçaria, impressa no topo do orçamento em PDF.

import { ApiError, apiFetch } from './auth';

export type Logo = { logo_url: string | null; logo_data_uri: string | null };

async function ler<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
    throw new ApiError(res.status, data, typeof msg === 'string' ? msg : padrao);
  }
  return data as T;
}

export async function obterLogo(): Promise<Logo> {
  return ler(await apiFetch('/vidraceiros/me/logo/'), 'Não foi possível carregar a logomarca.');
}

export async function enviarLogo(imagemBase64: string): Promise<Logo> {
  const res = await apiFetch('/vidraceiros/me/logo/', {
    method: 'POST',
    body: JSON.stringify({ imagem_base64: imagemBase64 }),
  });
  return ler(res, 'Não foi possível enviar a logomarca.');
}

export async function removerLogo(): Promise<void> {
  const res = await apiFetch('/vidraceiros/me/logo/', { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível remover a logomarca.');
}
