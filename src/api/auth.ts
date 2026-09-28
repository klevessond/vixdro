import * as SecureStore from "expo-secure-store";

// Defina EXPO_PUBLIC_API_URL no arquivo .env do app, por exemplo:
// EXPO_PUBLIC_API_URL=http://IP_DA_VM:8000/api/v1
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://168.119.245.32:8000/api/v1";

const CHAVE_ACCESS = "vixdro_access";
const CHAVE_REFRESH = "vixdro_refresh";
const CHAVE_USUARIO = "vixdro_vidraceiro";

export type Vidraceiro = {
  id: string;
  email: string;
  nome: string;
  empresa: string;
  celular: string;
  cpf_cnpj: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export class ApiError extends Error {
  constructor(public status: number, public data: unknown, mensagem: string) {
    super(mensagem);
  }
}

/** Lançado quando o refresh token expirou ou foi revogado: é preciso entrar de novo. */
export class SessaoExpiradaError extends Error {
  constructor() {
    super("Sua sessão expirou. Entre novamente.");
  }
}

// ---------- Aviso de sessão expirada (o AuthContext escuta isso) ----------

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

export function aoExpirarSessao(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

// ---------- Armazenamento seguro ----------

async function salvarSessao(access: string, refresh: string, vidraceiro?: Vidraceiro) {
  await SecureStore.setItemAsync(CHAVE_ACCESS, access);
  await SecureStore.setItemAsync(CHAVE_REFRESH, refresh);
  if (vidraceiro) {
    await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(vidraceiro));
  }
}

async function limparSessao() {
  await SecureStore.deleteItemAsync(CHAVE_ACCESS);
  await SecureStore.deleteItemAsync(CHAVE_REFRESH);
  await SecureStore.deleteItemAsync(CHAVE_USUARIO);
}

/** Usado ao abrir o app: devolve o vidraceiro salvo, ou null se não houver sessão. */
export async function carregarSessao(): Promise<Vidraceiro | null> {
  const refresh = await SecureStore.getItemAsync(CHAVE_REFRESH);
  const usuario = await SecureStore.getItemAsync(CHAVE_USUARIO);
  if (!refresh || !usuario) return null;
  try {
    return JSON.parse(usuario) as Vidraceiro;
  } catch {
    return null;
  }
}

// ---------- Chamadas ----------

async function lerJson(res: Response): Promise<any> {
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
   } catch {
    return { detail: `O servidor respondeu de forma inesperada (erro ${res.status}). Confira o endereço da API.` };
  }
}

function mensagemDoServidor(data: any, padrao: string): string {
  if (data?.detail) return String(data.detail);
  if (data && typeof data === "object") {
    const primeiro = Object.values(data)[0];
    if (Array.isArray(primeiro) && primeiro.length) return String(primeiro[0]);
  }
  return padrao;
}

export async function login(email: string, senha: string): Promise<Vidraceiro> {
  const res = await fetch(`${API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
  });
  const data = await lerJson(res);
  if (!res.ok) {
    throw new ApiError(res.status, data, mensagemDoServidor(data, "Não foi possível entrar."));
  }
  await salvarSessao(data.access, data.refresh, data.vidraceiro);
  return data.vidraceiro;
}

export type NovoVidraceiro = Omit<Vidraceiro, "id"> & { password: string };

/** Cria a conta no servidor e já deixa o vidraceiro logado. Exige internet. */
export async function cadastrar(dados: NovoVidraceiro): Promise<Vidraceiro> {
  const res = await fetch(`${API_URL}/vidraceiros/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...dados, email: dados.email.trim().toLowerCase() }),
  });
  const data = await lerJson(res);
  if (!res.ok) {
    throw new ApiError(res.status, data, mensagemDoServidor(data, "Não foi possível criar a conta."));
  }
  await salvarSessao(data.access, data.refresh, data.vidraceiro);
  return data.vidraceiro;
}

export async function logout() {
  const refresh = await SecureStore.getItemAsync(CHAVE_REFRESH);
  // Revoga o token no servidor. Se estiver offline, sai localmente mesmo assim.
  if (refresh) {
    try {
      await fetch(`${API_URL}/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
    } catch {
      // sem conexão: tudo bem, o token expira sozinho
    }
  }
  await limparSessao();
}

// O servidor troca o refresh token a cada renovação e invalida o antigo.
// Se duas requisições tentassem renovar ao mesmo tempo, a segunda usaria um
// token já invalidado e derrubaria a sessão. Por isso só existe uma renovação por vez.
let renovacaoEmAndamento: Promise<string> | null = null;

async function renovarAccessToken(): Promise<string> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = (async () => {
      const refresh = await SecureStore.getItemAsync(CHAVE_REFRESH);
      if (!refresh) throw new SessaoExpiradaError();

      const res = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (res.status === 401) {
        await limparSessao();
        ouvintes.forEach((o) => o());
        throw new SessaoExpiradaError();
      }
      const data = await lerJson(res);
      if (!res.ok) {
        throw new ApiError(res.status, data, "Não foi possível renovar a sessão.");
      }
      await salvarSessao(data.access, data.refresh ?? refresh);
      return data.access as string;
    })().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

/**
 * fetch autenticado: coloca o token, e se ele tiver expirado (401),
 * renova uma vez e repete a chamada. Use para todas as rotas protegidas.
 */
export async function apiFetch(caminho: string, init: RequestInit = {}): Promise<Response> {
  const chamar = (token: string | null) =>
    fetch(`${API_URL}${caminho}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await chamar(await SecureStore.getItemAsync(CHAVE_ACCESS));
  if (res.status === 401) {
    const novoToken = await renovarAccessToken();
    res = await chamar(novoToken);
  }
  return res;
}
