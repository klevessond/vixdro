// src/api/cofre.ts  (celular)
//
// Onde o login fica guardado. No celular, é o cofre seguro do sistema
// (Keychain no iPhone, Keystore no Android). No navegador, o Expo usa o
// cofre.web.ts no lugar deste arquivo.

export { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
