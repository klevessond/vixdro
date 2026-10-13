// src/storage/clientesRepository.web.ts  (navegador)
//
// Mesmas funções do clientesRepository.ts, mas sem banco local: tudo vai
// direto ao servidor. No computador a internet é o normal, e assim o site
// sempre mostra os dados mais recentes (inclusive os criados no celular).

import { carregarSessao } from "../api/auth";
import { ApiError, apiFetch } from "../api/client";
import { DadosCliente } from "../components/CadastroClienteForm";

export interface ClienteLocal extends DadosCliente {
  id: string;
  sincronizado: boolean;
  criadoEm: string;
}

export interface ClienteApi {
  id: string;
  nome: string;
  empresa: string;
  email: string;
  celular: string;
  cpf_cnpj: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  ativo?: boolean;
  criado_em?: string;
}

export async function vidraceiroAtualId(): Promise<string | null> {
  const v = await carregarSessao();
  return v?.id ?? null;
}

/** UUID v4. Usa getRandomValues, que funciona mesmo fora de HTTPS. */
function novoId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function paraApi(id: string, d: DadosCliente): ClienteApi {
  return {
    id,
    nome: d.nome.trim(),
    empresa: d.nomeEmpresa.trim(),
    email: d.email.trim(),
    celular: d.celular,
    cpf_cnpj: d.cpfCnpj,
    cep: d.cep,
    rua: d.rua.trim(),
    numero: d.numero.trim(),
    complemento: d.complemento.trim(),
    bairro: d.bairro.trim(),
    cidade: d.cidade.trim(),
    estado: d.estado,
  };
}

function daApi(c: ClienteApi): ClienteLocal {
  return {
    id: c.id,
    sincronizado: true,
    criadoEm: c.criado_em ?? "",
    nome: c.nome,
    nomeEmpresa: c.empresa ?? "",
    email: c.email ?? "",
    celular: c.celular ?? "",
    cpfCnpj: c.cpf_cnpj ?? "",
    cep: c.cep ?? "",
    rua: c.rua ?? "",
    numero: c.numero ?? "",
    complemento: c.complemento ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    estado: c.estado ?? "",
  };
}

export async function salvarClienteLocal(dados: DadosCliente): Promise<ClienteLocal> {
  const criado = await apiFetch<ClienteApi>("/clientes/", { method: "POST", body: paraApi(novoId(), dados) });
  return daApi(criado);
}

export async function listarClientesLocais(): Promise<ClienteLocal[]> {
  const todos: ClienteLocal[] = [];
  let pagina = 1;
  while (true) {
    const dados = await apiFetch<{ clientes: ClienteApi[]; proxima: string | null }>(
      `/clientes/?page=${pagina}&tamanho=500`
    );
    todos.push(...dados.clientes.map(daApi));
    if (!dados.proxima) break;
    pagina++;
  }
  return todos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function obterClienteLocal(id: string): Promise<ClienteLocal | null> {
  try {
    return daApi(await apiFetch<ClienteApi>(`/clientes/${id}/`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// Sem banco local no navegador: estas duas não têm o que fazer.
export async function marcarClienteSincronizado(_id: string): Promise<void> {}
export async function aplicarClientesDoServidor(_vidraceiroId: string, _clientes: ClienteApi[]): Promise<void> {}
