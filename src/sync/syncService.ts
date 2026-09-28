// src/sync/syncService.ts
//
// Sincronização em duas direções, sempre com o vidraceiro logado:
//   1. ENVIAR: varre a fila_sync DESTE vidraceiro e manda cada ação à API.
//   2. BAIXAR: busca no servidor o que mudou desde a última vez (clientes
//      criados no site ou em outro aparelho) e grava no celular.
//
// Cada tipo de ação (criar_cliente, ...) tem seu próprio "executor".
// Adicionar um novo tipo = adicionar uma entrada em EXECUTORES.

import { ApiError, SessaoExpiradaError, apiFetch } from "../api/client";
import {
  ClienteApi,
  aplicarClientesDoServidor,
  marcarClienteSincronizado,
  vidraceiroAtualId,
} from "../storage/clientesRepository";
import { getDatabase } from "../storage/database";
import { obterCursor, salvarCursor, salvarUltimaSincronizacao } from "../storage/preferenciasStorage";

interface ItemFila {
  id: number;
  tipo_acao: string;
  entidade: string;
  entidade_id: string;
  payload: string;
  tentativas: number;
}

// Tentativas contam só quando o SERVIDOR recusa (dados inválidos, erro
// interno). Falta de internet não gasta tentativa: o item espera o tempo
// que for preciso.
const MAX_TENTATIVAS = 5;

type Executor = (item: ItemFila) => Promise<void>;

const EXECUTORES: Record<string, Executor> = {
  criar_cliente: async (item) => {
    // O payload já está no formato da API, com o id gerado no celular.
    // Se este cliente já chegou antes, o servidor responde 200 sem duplicar.
    await apiFetch("/clientes/", { method: "POST", body: JSON.parse(item.payload) });
    await marcarClienteSincronizado(item.entidade_id);
  },
};

export interface ResultadoSincronizacao {
  processados: number;
  falharam: number;
}

function semConexao(erro: unknown): boolean {
  return erro instanceof SessaoExpiradaError || (erro instanceof ApiError && erro.status === 0);
}

async function enviarPendentes(vidraceiroId: string): Promise<ResultadoSincronizacao> {
  const db = await getDatabase();
  const itens = await db.getAllAsync<ItemFila>(
    `SELECT * FROM fila_sync WHERE vidraceiro_id = ? AND tentativas < ? ORDER BY id ASC`,
    [vidraceiroId, MAX_TENTATIVAS]
  );

  let processados = 0;
  let falharam = 0;

  for (const item of itens) {
    const executor = EXECUTORES[item.tipo_acao];
    if (!executor) {
      console.warn(`Sem executor para tipo_acao "${item.tipo_acao}"`);
      continue;
    }

    try {
      await executor(item);
      await db.runAsync(`DELETE FROM fila_sync WHERE id = ?`, [item.id]);
      processados++;
    } catch (erro) {
      falharam++;
      if (semConexao(erro)) {
        // Sem internet (ou login expirado): para aqui, sem gastar tentativa.
        break;
      }
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await db.runAsync(
        `UPDATE fila_sync SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?`,
        [mensagem, item.id]
      );
    }
  }
  return { processados, falharam };
}

type PaginaClientes = { clientes: ClienteApi[]; proxima: string | null; gerado_em: string };

async function baixarClientes(vidraceiroId: string): Promise<void> {
  const desde = await obterCursor("clientes", vidraceiroId);
  let pagina = 1;
  let marca: string | null = null;

  while (true) {
    const params = new URLSearchParams({ page: String(pagina), tamanho: "500" });
    if (desde) params.set("atualizado_desde", desde);
    const dados = await apiFetch<PaginaClientes>(`/clientes/?${params}`);
    if (pagina === 1) marca = dados.gerado_em;
    await aplicarClientesDoServidor(vidraceiroId, dados.clientes);
    if (!dados.proxima) break;
    pagina++;
  }
  // Só avança a marca se baixou tudo; se falhar no meio, repete na próxima.
  if (marca) await salvarCursor("clientes", vidraceiroId, marca);
}

let emAndamento: Promise<ResultadoSincronizacao> | null = null;

/**
 * Envia as pendências e baixa as novidades do vidraceiro logado.
 * Se já houver uma sincronização rodando, devolve a mesma (não duplica).
 */
export function sincronizar(): Promise<ResultadoSincronizacao> {
  if (!emAndamento) {
    emAndamento = (async () => {
      const vidraceiroId = await vidraceiroAtualId();
      if (!vidraceiroId) return { processados: 0, falharam: 0 };

      const resultado = await enviarPendentes(vidraceiroId);
      try {
        await baixarClientes(vidraceiroId);
      } catch (erro) {
        if (!semConexao(erro)) console.warn("Falha ao baixar clientes:", erro);
      }
      await salvarUltimaSincronizacao(new Date().toISOString());
      return resultado;
    })().finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

/** Quantos itens do vidraceiro logado ainda esperam envio (para um aviso na tela). */
export async function contarPendentesSincronizacao(): Promise<number> {
  const vidraceiroId = await vidraceiroAtualId();
  if (!vidraceiroId) return 0;
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM fila_sync WHERE vidraceiro_id = ? AND tentativas < ?`,
    [vidraceiroId, MAX_TENTATIVAS]
  );
  return r?.total ?? 0;
}
