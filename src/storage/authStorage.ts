// src/storage/authStorage.ts
//
// Guarda o token de login no cofre criptografado do sistema operacional
// (Keychain no iOS, Keystore no Android) via expo-secure-store.
// NUNCA use AsyncStorage para token - AsyncStorage grava em texto puro.

import * as SecureStore from "expo-secure-store";

const CHAVE_TOKEN = "vixdro_auth_token";

export async function salvarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_TOKEN, token);
}

export async function obterToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_TOKEN);
}

export async function removerToken(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
}
