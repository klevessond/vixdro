// src/api/client.ts
//
// Cliente HTTP usado pela sincronização e pelas telas que preferem a
// interface { method, body }. Por baixo, usa o apiFetch do auth.ts:
// mesmo endereço (EXPO_PUBLIC_API_URL no .env), mesmo token e renovação
// automática do login. Não existe mais endereço fixo aqui.

import { API_URL, ApiError, SessaoExpiradaError, apiFetch as fetchAutenticado } from "./auth";

export { ApiError, SessaoExpiradaError };

interface OpcoesRequisicao {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  autenticado?: boolean; // padrão true - a maioria dos endpoints exige login
}

function primeiraMensagem(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    for (const v of data) {
      const m = primeiraMensagem(v);
      if (m) return m;
    }
  } else if (data && typeof data === "object") {
    for (const v of Object.values(data)) {
      const m = primeiraMensagem(v);
      if (m) return m;
    }
  }
  return null;
}

/**
 * Faz a requisição e devolve o JSON da resposta.
 * Erros viram ApiError; status 0 significa "sem conexão".
 */
export async function apiFetch<T = unknown>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { method = "GET", body, autenticado = true } = opcoes;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let resposta: Response;
  try {
    resposta = autenticado
      ? await fetchAutenticado(caminho, init)
      : await fetch(`${API_URL}${caminho}`, init);
  } catch (e) {
    if (e instanceof ApiError || e instanceof SessaoExpiradaError) throw e;
    throw new ApiError(0, null, "Sem conexão com o servidor");
  }

  const texto = await resposta.text();
  let data: any = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = null; // resposta que não é JSON (ex: página de erro do Nginx)
    }
  }

  if (!resposta.ok) {
    throw new ApiError(
      resposta.status,
      data,
      primeiraMensagem(data) ?? `O servidor respondeu com erro ${resposta.status}.`
    );
  }
  return data as T;
}
