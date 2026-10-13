// src/sync/syncService.web.ts  (navegador)
//
// No navegador tudo é gravado direto no servidor, então não existe fila
// para sincronizar. Mesmas funções do syncService.ts, sem efeito.

export interface ResultadoSincronizacao {
  processados: number;
  falharam: number;
}

export async function sincronizar(): Promise<ResultadoSincronizacao> {
  return { processados: 0, falharam: 0 };
}

export async function contarPendentesSincronizacao(): Promise<number> {
  return 0;
}
