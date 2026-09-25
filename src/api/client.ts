// src/api/client.ts
//
// Ponto único de configuração da API. Trocar a URL base (por exemplo,
// de desenvolvimento local para produção) muda só aqui - nenhum outro
// arquivo do app deve montar URL de API na mão.

import { obterToken } from "../storage/authStorage";

// IMPORTANTE (desenvolvimento local):
// Ao testar no celular físico via Expo Go, "localhost" aponta para o
// PRÓPRIO CELULAR, não para o seu PC. Troque pelo IP local da sua
// máquina na rede Wi-Fi (ex: 192.168.0.15) e rode o Django com:
//   python manage.py runserver 0.0.0.0:8000
// e inclua esse IP em ALLOWED_HOSTS no settings.py do Django.
const API_BASE_URL = "http://192.168.0.2:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface OpcoesRequisicao {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  autenticado?: boolean; // default true - a maioria dos endpoints exige login
}

/**
 * Cliente HTTP central. Injeta o token automaticamente quando
 * `autenticado` é true (padrão), monta a URL completa e já trata
 * erros HTTP transformando em ApiError com uma mensagem legível.
 */
export async function apiFetch<T = unknown>(
  caminho: string,
  opcoes: OpcoesRequisicao = {}
): Promise<T> {
  const { method = "GET", body, autenticado = true } = opcoes;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (autenticado) {
    const token = await obterToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor");
  }

  if (!resposta.ok) {
    let mensagem = `Erro ${resposta.status}`;
    try {
      const corpoErro = await resposta.json();
      mensagem = corpoErro.detail || corpoErro.message || mensagem;
    } catch {
      // corpo de erro não era JSON válido - mantém a mensagem genérica
    }
    throw new ApiError(resposta.status, mensagem);
  }

  // Requisições como DELETE costumam voltar sem corpo
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : (undefined as T);
}