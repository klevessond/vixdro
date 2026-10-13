// src/api/cofre.web.ts  (navegador)
//
// O navegador não tem o cofre seguro do celular. A sessão fica no
// localStorage, com as mesmas funções, para o auth.ts não precisar mudar.

function disponivel(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false; // navegação privada em alguns navegadores bloqueia o acesso
  }
}

export async function getItemAsync(chave: string): Promise<string | null> {
  return disponivel() ? window.localStorage.getItem(chave) : null;
}

export async function setItemAsync(chave: string, valor: string): Promise<void> {
  if (disponivel()) window.localStorage.setItem(chave, valor);
}

export async function deleteItemAsync(chave: string): Promise<void> {
  if (disponivel()) window.localStorage.removeItem(chave);
}
