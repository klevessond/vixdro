// src/storage/clientesRepository.ts
//
// Camada que sabe gravar/ler clientes no SQLite local. Quem chama esta
// camada (ex: a tela de cadastro) não precisa saber que existe uma fila
// de sincronização por trás - a gravação local e o registro na fila
// acontecem juntos, numa transação, para nunca ficar um sem o outro.

import { getDatabase } from "./database";
import { DadosCliente } from "../components/CadastroClienteForm";

export interface ClienteLocal extends DadosCliente {
  id: number;
  servidorId: number | null;
  sincronizado: boolean;
  criadoEm: string;
}

/**
 * Salva um cliente novo localmente e enfileira a criação para sincronizar
 * com a API assim que houver conexão. Retorna o registro já com o id local.
 */
export async function salvarClienteLocal(dados: DadosCliente): Promise<ClienteLocal> {
  const db = await getDatabase();

  return db.withTransactionAsync(async () => {
    const resultado = await db.runAsync(
      `INSERT INTO clientes
        (nome, nome_empresa, email, celular, cpf_cnpj, cep, rua, numero, complemento, bairro, cidade, estado, sincronizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        dados.nome,
        dados.nomeEmpresa || null,
        dados.email,
        dados.celular,
        dados.cpfCnpj,
        dados.cep,
        dados.rua,
        dados.numero,
        dados.complemento || null,
        dados.bairro,
        dados.cidade,
        dados.estado,
      ]
    );

    const clienteLocalId = resultado.lastInsertRowId;

    await db.runAsync(
      `INSERT INTO fila_sync (tipo_acao, entidade, entidade_local_id, payload)
       VALUES (?, ?, ?, ?)`,
      ["criar_cliente", "clientes", clienteLocalId, JSON.stringify(dados)]
    );

    return {
      id: clienteLocalId,
      servidorId: null,
      sincronizado: false,
      criadoEm: new Date().toISOString(),
      ...dados,
    };
  }) as unknown as Promise<ClienteLocal>;
}

export async function listarClientesLocais(): Promise<ClienteLocal[]> {
  const db = await getDatabase();
  const linhas = await db.getAllAsync<any>(
    `SELECT * FROM clientes ORDER BY criado_em DESC`
  );

  return linhas.map(linhaParaClienteLocal);
}

/** Marca um cliente local como sincronizado, guardando o id que a API atribuiu. */
export async function marcarClienteSincronizado(
  clienteLocalId: number,
  servidorId: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE clientes SET servidor_id = ?, sincronizado = 1, atualizado_em = datetime('now') WHERE id = ?`,
    [servidorId, clienteLocalId]
  );
}

function linhaParaClienteLocal(linha: any): ClienteLocal {
  return {
    id: linha.id,
    servidorId: linha.servidor_id,
    sincronizado: linha.sincronizado === 1,
    criadoEm: linha.criado_em,
    nome: linha.nome,
    nomeEmpresa: linha.nome_empresa || "",
    email: linha.email,
    celular: linha.celular,
    cpfCnpj: linha.cpf_cnpj,
    cep: linha.cep,
    rua: linha.rua,
    numero: linha.numero,
    complemento: linha.complemento || "",
    bairro: linha.bairro,
    cidade: linha.cidade,
    estado: linha.estado,
  };
}
