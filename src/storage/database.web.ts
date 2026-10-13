// src/storage/database.web.ts  (navegador)
//
// No navegador não existe banco local: os clientes são lidos e gravados
// direto no servidor (veja clientesRepository.web.ts). Este arquivo existe
// só para o expo-sqlite nunca ser carregado na versão web.

export async function getDatabase(): Promise<never> {
  throw new Error("O banco local não é usado na versão web.");
}

export async function apagarBancoLocal(): Promise<void> {}
