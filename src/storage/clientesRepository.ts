// src/storage/clientesRepository.ts
//
// Camada que sabe gravar/ler clientes no SQLite local. Quem chama esta
// camada (ex: a tela de cadastro) não precisa saber que existe uma fila
// de sincronização por trás - a gravação local e o registro na fila
// acontecem juntos, numa transação, para nunca ficar um sem o outro.
//
// Todo registro pertence a um vidraceiro. As consultas filtram sempre
// pelo vidraceiro logado, então duas contas no mesmo celular não se veem.

import * as Crypto from "expo-crypto";

import { carregarSessao } from "../api/auth";
import { DadosCliente } from "../components/CadastroClienteForm";
import { getDatabase } from "./database";

export interface ClienteLocal extends DadosCliente {
  id: string;
  sincronizado: boolean;
  criadoEm: string;
}

/** Formato do cliente na API do servidor (snake_case). */
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
}

export async function vidraceiroAtualId(): Promise<string | null> {
  const v = await carregarSessao();
  return v?.id ?? null;
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

/**
 * Salva um cliente novo localmente e enfileira a criação para sincronizar
 * com a API assim que houver conexão. Funciona sem internet.
 */
export async function salvarClienteLocal(dados: DadosCliente): Promise<ClienteLocal> {
  const vidraceiroId = await vidraceiroAtualId();
  if (!vidraceiroId) throw new Error("Entre na sua conta para cadastrar clientes.");

  const db = await getDatabase();
  // O id é criado aqui, no celular. É o mesmo que o servidor vai usar,
  // e é o que impede duplicatas se a fila reenviar o cadastro.
  const id = Crypto.randomUUID();
  const api = paraApi(id, dados);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO clientes
        (id, vidraceiro_id, nome, empresa, email, celular, cpf_cnpj, cep, rua, numero,
         complemento, bairro, cidade, estado, sincronizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, vidraceiroId, api.nome, api.empresa, api.email, api.celular, api.cpf_cnpj, api.cep,
       api.rua, api.numero, api.complemento, api.bairro, api.cidade, api.estado]
    );
    await db.runAsync(
      `INSERT INTO fila_sync (vidraceiro_id, tipo_acao, entidade, entidade_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [vidraceiroId, "criar_cliente", "clientes", id, JSON.stringify(api)]
    );
  });

  return { ...dados, id, sincronizado: false, criadoEm: new Date().toISOString() };
}

export async function listarClientesLocais(): Promise<ClienteLocal[]> {
  const vidraceiroId = await vidraceiroAtualId();
  if (!vidraceiroId) return [];
  const db = await getDatabase();
  const linhas = await db.getAllAsync<any>(
    `SELECT * FROM clientes WHERE vidraceiro_id = ? AND ativo = 1 ORDER BY nome COLLATE NOCASE`,
    [vidraceiroId]
  );
  return linhas.map(linhaParaClienteLocal);
}

/** Um cliente do vidraceiro logado, pelo id (ou null se não existir no celular). */
export async function obterClienteLocal(id: string): Promise<ClienteLocal | null> {
  const vidraceiroId = await vidraceiroAtualId();
  if (!vidraceiroId) return null;
  const db = await getDatabase();
  const linha = await db.getFirstAsync<any>(
    `SELECT * FROM clientes WHERE id = ? AND vidraceiro_id = ?`,
    [id, vidraceiroId]
  );
  return linha ? linhaParaClienteLocal(linha) : null;
}

/** Marca como enviado (o id local e o do servidor são o mesmo UUID). */
export async function marcarClienteSincronizado(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE clientes SET sincronizado = 1, atualizado_em = datetime('now') WHERE id = ?`,
    [id]
  );
}

/**
 * Grava no celular os clientes vindos do servidor (criados no site, em
 * outro aparelho, ou editados). Um registro com alteração local ainda
 * não enviada NÃO é sobrescrito: a alteração local vence até ser enviada.
 */
export async function aplicarClientesDoServidor(vidraceiroId: string, clientes: ClienteApi[]) {
  if (!clientes.length) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const c of clientes) {
      await db.runAsync(
        `INSERT INTO clientes
          (id, vidraceiro_id, nome, empresa, email, celular, cpf_cnpj, cep, rua, numero,
           complemento, bairro, cidade, estado, ativo, sincronizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           nome = excluded.nome, empresa = excluded.empresa, email = excluded.email,
           celular = excluded.celular, cpf_cnpj = excluded.cpf_cnpj, cep = excluded.cep,
           rua = excluded.rua, numero = excluded.numero, complemento = excluded.complemento,
           bairro = excluded.bairro, cidade = excluded.cidade, estado = excluded.estado,
           ativo = excluded.ativo, atualizado_em = datetime('now')
         WHERE clientes.sincronizado = 1 AND clientes.vidraceiro_id = excluded.vidraceiro_id`,
        [c.id, vidraceiroId, c.nome, c.empresa ?? "", c.email ?? "", c.celular ?? "",
         c.cpf_cnpj ?? "", c.cep ?? "", c.rua ?? "", c.numero ?? "", c.complemento ?? "",
         c.bairro ?? "", c.cidade ?? "", c.estado ?? "", c.ativo === false ? 0 : 1]
      );
    }
  });
}

function linhaParaClienteLocal(linha: any): ClienteLocal {
  return {
    id: linha.id,
    sincronizado: linha.sincronizado === 1,
    criadoEm: linha.criado_em,
    nome: linha.nome,
    nomeEmpresa: linha.empresa,
    email: linha.email,
    celular: linha.celular,
    cpfCnpj: linha.cpf_cnpj,
    cep: linha.cep,
    rua: linha.rua,
    numero: linha.numero,
    complemento: linha.complemento,
    bairro: linha.bairro,
    cidade: linha.cidade,
    estado: linha.estado,
  };
}
