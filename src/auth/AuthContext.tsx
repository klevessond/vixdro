import { useRouter, useSegments } from "expo-router";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { NovoVidraceiro, Vidraceiro } from "../api/auth";
import * as auth from "../api/auth";
import { sincronizar } from "../sync/syncService";

type AuthContextValue = {
  vidraceiro: Vidraceiro | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: NovoVidraceiro) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vidraceiro, setVidraceiro] = useState<Vidraceiro | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    auth
      .carregarSessao()
      .then(setVidraceiro)
      .finally(() => setCarregando(false));

    // Se o refresh token expirar no meio do uso, volta para o login.
    const parar = auth.aoExpirarSessao(() => setVidraceiro(null));
    return () => {
      parar();
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const v = await auth.login(email, senha);
    setVidraceiro(v);
  }, []);

  const cadastrar = useCallback(async (dados: NovoVidraceiro) => {
    const v = await auth.cadastrar(dados);
    setVidraceiro(v);
  }, []);

  const sair = useCallback(async () => {
    await sincronizar().catch(() => {}); // tenta enviar o que estiver pendente
    await auth.logout();
    setVidraceiro(null);
  }, []);

  return (
    <AuthContext.Provider value={{ vidraceiro, carregando, entrar, cadastrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}

/**
 * Redireciona conforme a sessão: sem login, só as telas do grupo (auth)
 * ficam acessíveis; com login, quem estiver no (auth) vai para a home.
 */
export function useProtecaoDeRotas() {
  const { vidraceiro, carregando } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    const naAreaPublica = segments[0] === "(auth)";

    if (!vidraceiro && !naAreaPublica) {
      router.replace("/(auth)/login");
    } else if (vidraceiro && naAreaPublica) {
      router.replace("/");
    }
  }, [vidraceiro, carregando, segments]);
}
