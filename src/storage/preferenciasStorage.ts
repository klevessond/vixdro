// src/storage/preferenciasStorage.ts
//
// Preferências simples do usuário (não sensíveis - por isso AsyncStorage
// é suficiente aqui, diferente do token, que fica no SecureStore).

import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE_ULTIMA_SINCRONIZACAO = "vixdro_ultima_sincronizacao";

export async function salvarUltimaSincronizacao(dataISO: string): Promise<void> {
  await AsyncStorage.setItem(CHAVE_ULTIMA_SINCRONIZACAO, dataISO);
}

export async function obterUltimaSincronizacao(): Promise<string | null> {
  return AsyncStorage.getItem(CHAVE_ULTIMA_SINCRONIZACAO);
}

// Marca de "até quando já baixei" de cada tipo de dado, por vidraceiro.
// Ex: obterCursor("clientes", id) -> horário enviado como atualizado_desde.
function chaveCursor(entidade: string, vidraceiroId: string) {
  return `vixdro_cursor_${entidade}_${vidraceiroId}`;
}

export async function obterCursor(entidade: string, vidraceiroId: string): Promise<string | null> {
  return AsyncStorage.getItem(chaveCursor(entidade, vidraceiroId));
}

export async function salvarCursor(entidade: string, vidraceiroId: string, valor: string): Promise<void> {
  await AsyncStorage.setItem(chaveCursor(entidade, vidraceiroId), valor);
}
