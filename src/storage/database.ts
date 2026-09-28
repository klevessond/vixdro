// src/storage/database.ts
//
// Ponto único de acesso ao banco SQLite local. Toda outra parte do app
// que precisa ler/gravar dado local deve importar `getDatabase()` daqui,
// nunca abrir o banco em outro lugar - evita conexões duplicadas.
//
// O esquema tem versão (PRAGMA user_version). Para mudar tabelas no
// futuro, acrescente um bloco "if (versao < N)" em migrar(), nunca
// altere um bloco antigo: celulares com versões antigas passam por todos.

import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let abrindo: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  // Evita abrir duas vezes se duas partes do app pedirem ao mesmo tempo.
  if (!abrindo) {
    abrindo = (async () => {
      const db = await SQLite.openDatabaseAsync("vixdro.db");
      await migrar(db);
      dbInstance = db;
      return db;
    })();
  }
  return abrindo;
}

async function migrar(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  const linha = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const versao = linha?.user_version ?? 0;

  if (versao < 2) {
    // Versão 2: clientes passam a ter id UUID (gerado no app) e dono
    // (vidraceiro_id). Os registros da versão 1 eram de teste, de antes
    // de existir login, e não têm dono: são descartados.
    await db.execAsync(`
      DROP TABLE IF EXISTS fila_sync;
      DROP TABLE IF EXISTS clientes;

      CREATE TABLE clientes (
        id TEXT PRIMARY KEY,              -- UUID gerado no app, igual ao do servidor
        vidraceiro_id TEXT NOT NULL,      -- dono do registro
        nome TEXT NOT NULL,
        empresa TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        celular TEXT NOT NULL DEFAULT '',
        cpf_cnpj TEXT NOT NULL DEFAULT '',
        cep TEXT NOT NULL DEFAULT '',
        rua TEXT NOT NULL DEFAULT '',
        numero TEXT NOT NULL DEFAULT '',
        complemento TEXT NOT NULL DEFAULT '',
        bairro TEXT NOT NULL DEFAULT '',
        cidade TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL DEFAULT '',
        ativo INTEGER NOT NULL DEFAULT 1,
        sincronizado INTEGER NOT NULL DEFAULT 0, -- 0 = alteração local ainda não enviada
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_clientes_dono ON clientes (vidraceiro_id, ativo);

      -- Ações pendentes de envio à API. Cada linha pertence a um vidraceiro
      -- e só é enviada com o login DELE.
      CREATE TABLE fila_sync (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vidraceiro_id TEXT NOT NULL,
        tipo_acao TEXT NOT NULL,          -- ex: 'criar_cliente'
        entidade TEXT NOT NULL,           -- ex: 'clientes'
        entidade_id TEXT NOT NULL,        -- id (UUID) do registro afetado
        payload TEXT NOT NULL,            -- JSON pronto para a API
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        tentativas INTEGER NOT NULL DEFAULT 0,
        ultimo_erro TEXT
      );
      CREATE INDEX idx_fila_dono ON fila_sync (vidraceiro_id);

      PRAGMA user_version = 2;
    `);
  }
}

// Útil para telas de configuração/debug, ou para "resetar" o app em testes.
export async function apagarBancoLocal(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM fila_sync;
    DELETE FROM clientes;
  `);
}
