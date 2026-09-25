// src/sync/syncService.ts
//
// Varre a fila_sync e tenta enviar cada ação pendente para a API.
// Chamado (a) quando o app detecta que a conexão voltou, e (b)
// opcionalmente em um intervalo periódico enquanto o app está aberto.
//
// Cada tipo de ação (criar_cliente, editar_cliente, ...) tem seu próprio
// "executor". Adicionar um novo tipo de sincronização = adicionar uma
// nova entrada no mapa EXECUTORES, sem mexer no restante do serviço.

import { ApiError, apiFetch } from "../api/client";
import { marcarClienteSincronizado } from "../storage/clientesRepository";
import { getDatabase } from "../storage/database";
import { salvarUltimaSincronizacao } from "../storage/preferenciasStorage";

interface ItemFila {
  id: number;
  tipo_acao: string;
  entidade: string;
  entidade_local_id: number;
  payload: string;
  tentativas: number;
}

const MAX_TENTATIVAS = 5;

type Executor = (item: ItemFila) => Promise<void>;

const EXECUTORES: Record<string, Executor> = {
  criar_cliente: async (item) => {
    const dados = JSON.parse(item.payload);

    // Ajuste os nomes de campo aqui para bater com o que sua API Django
    // espera (ex: se o serializer usar snake_case em vez de camelCase).
    const clienteCriado = await apiFetch<{ id: number }>("/clientes/", {
      method: "POST",
      body: dados,
    });

    await marcarClienteSincronizado(item.entidade_local_id, clienteCriado.id);
  },

  // Exemplo de como um segundo tipo de ação seria adicionado no futuro:
  // editar_cliente: async (item) => {
  //   const dados = JSON.parse(item.payload);
  //   await apiFetch(`/clientes/${dados.servidorId}/`, { method: "PATCH", body: dados });
  // },
};

export interface ResultadoSincronizacao {
  processados: number;
  falharam: number;
}

/**
 * Processa a fila de sincronização inteira, um item por vez, na ordem
 * em que foram criados. Itens que falham continuam na fila para a
 * próxima tentativa, até o limite de MAX_TENTATIVAS.
 */
export async function sincronizar(): Promise<ResultadoSincronizacao> {
  const db = await getDatabase();
  const itens = await db.getAllAsync<ItemFila>(
    `SELECT * FROM fila_sync WHERE tentativas < ? ORDER BY criado_em ASC`,
    [MAX_TENTATIVAS]
  );

  let processados = 0;
  let falharam = 0;

  for (const item of itens) {
    const executor = EXECUTORES[item.tipo_acao];

    if (!executor) {
      // Tipo de ação desconhecido não deve travar a fila inteira -
      // registra o problema e segue para o próximo item.
      console.warn(`Sem executor para tipo_acao "${item.tipo_acao}"`);
      continue;
    }

    try {
      await executor(item);
      await db.runAsync(`DELETE FROM fila_sync WHERE id = ?`, [item.id]);
      processados++;
    } catch (erro) {
      falharam++;
      const mensagemErro = erro instanceof ApiError ? erro.message : String(erro);

      await db.runAsync(
        `UPDATE fila_sync SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?`,
        [mensagemErro, item.id]
      );

      // Erro de rede (status 0) significa "ainda sem conexão" - para
      // de tentar os próximos itens agora, tentaremos tudo de novo
      // na próxima chamada de sincronizar().
      if (erro instanceof ApiError && erro.status === 0) {
        break;
      }
    }
  }

  await salvarUltimaSincronizacao(new Date().toISOString());
  return { processados, falharam };
}

/** Quantos itens ainda estão esperando para sincronizar (para mostrar um badge na UI, por exemplo). */
export async function contarPendentesSincronizacao(): Promise<number> {
  const db = await getDatabase();
  const resultado = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM fila_sync WHERE tentativas < ?`,
    [MAX_TENTATIVAS]
  );
  return resultado?.total ?? 0;
}