// src/storage/database.ts
//
// Ponto único de acesso ao banco SQLite local. Toda outra parte do app
// que precisa ler/gravar dado local deve importar `getDatabase()` daqui,
// nunca abrir o banco em outro lugar - evita conexões duplicadas.

import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabaseAsync("vixdro.db");
  await criarTabelas(dbInstance);
  return dbInstance;
}

async function criarTabelas(db: SQLite.SQLiteDatabase) {
  // PRAGMA foreign_keys garante integridade entre cliente -> pedidos -> itens,
  // e journal_mode WAL melhora concorrência de leitura/escrita no SQLite.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Cache local de clientes. O campo servidor_id fica NULL até o registro
    -- ser confirmado pela API (ver fila_sync) - é assim que sabemos se um
    -- cliente ainda existe só localmente ou já foi reconhecido pelo backend.
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      servidor_id INTEGER,
      nome TEXT NOT NULL,
      nome_empresa TEXT,
      email TEXT NOT NULL,
      celular TEXT NOT NULL,
      cpf_cnpj TEXT NOT NULL,
      cep TEXT NOT NULL,
      rua TEXT NOT NULL,
      numero TEXT NOT NULL,
      complemento TEXT,
      bairro TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      sincronizado INTEGER NOT NULL DEFAULT 0
    );

    -- Fila de ações pendentes de envio à API. Cada linha = uma ação que
    -- o serviço de sincronização precisa tentar enviar quando houver rede.
    CREATE TABLE IF NOT EXISTS fila_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_acao TEXT NOT NULL,          -- ex: 'criar_cliente', 'editar_cliente'
      entidade TEXT NOT NULL,           -- ex: 'clientes'
      entidade_local_id INTEGER NOT NULL, -- id local (tabela clientes.id) afetado
      payload TEXT NOT NULL,            -- JSON serializado com os dados a enviar
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      tentativas INTEGER NOT NULL DEFAULT 0,
      ultimo_erro TEXT
    );
  `);
}

// Útil para telas de configuração/debug, ou para "resetar" o app em testes.
export async function apagarBancoLocal(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM fila_sync;
    DELETE FROM clientes;
  `);
}