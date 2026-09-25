// src/storage/preferenciasStorage.ts
//
// Preferências simples do usuário (não sensíveis - por isso AsyncStorage
// é suficiente aqui, diferente do token que fica no authStorage/SecureStore).

import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE_ULTIMA_SINCRONIZACAO = "vixdro_ultima_sincronizacao";

export async function salvarUltimaSincronizacao(dataISO: string): Promise<void> {
  await AsyncStorage.setItem(CHAVE_ULTIMA_SINCRONIZACAO, dataISO);
}

export async function obterUltimaSincronizacao(): Promise<string | null> {
  return AsyncStorage.getItem(CHAVE_ULTIMA_SINCRONIZACAO);
}
