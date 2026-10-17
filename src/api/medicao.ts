// src/api/medicao.ts
//
// Diário da medição de um projeto: fotos do vão e anotações.

import { ApiError, apiFetch } from './auth';

export type RegistroMedicao = {
  id: string;
  projeto: string;
  referencia: string; // nome da peça a que se refere (opcional)
  texto: string;
  foto_url: string | null;
  miniatura_url: string | null;
  criado_em: string;
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
    const msg = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
    throw new ApiError(res.status, data, typeof msg === 'string' ? msg : padrao);
  }
  return data as T;
}

export async function listarMedicao(projetoId: string): Promise<RegistroMedicao[]> {
  return ler(await apiFetch(`/medicao/?projeto=${projetoId}`), 'Não foi possível carregar o diário da medição.');
}

export async function criarRegistro(dados: {
  projeto: string;
  texto: string;
  referencia: string;
  imagem_base64?: string;
}): Promise<RegistroMedicao> {
  const res = await apiFetch('/medicao/', { method: 'POST', body: JSON.stringify(dados) });
  return ler(res, 'Não foi possível salvar. Confira a internet e tente de novo.');
}

export async function editarRegistro(id: string, dados: { texto: string; referencia: string }): Promise<RegistroMedicao> {
  const res = await apiFetch(`/medicao/${id}/`, { method: 'PATCH', body: JSON.stringify(dados) });
  return ler(res, 'Não foi possível salvar.');
}

export async function excluirRegistro(id: string): Promise<void> {
  const res = await apiFetch(`/medicao/${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir.');
}
