// src/sync/useSincronizacaoAutomatica.ts
//
// Hook para ser chamado uma vez, perto da raiz do app (ex: no _layout.tsx
// principal). Ele observa o estado da conexão e dispara sincronizar()
// automaticamente sempre que o celular sai de "sem internet" para "com internet".

import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { sincronizar } from "./syncService";

export function useSincronizacaoAutomatica() {
  const estavaConectado = useRef<boolean | null>(null);

  useEffect(() => {
    // Tenta sincronizar uma vez já na abertura do app, caso existam
    // itens pendentes de uma sessão anterior.
    sincronizar().catch((erro) => console.warn("Falha ao sincronizar:", erro));

    const cancelarInscricao = NetInfo.addEventListener((estado) => {
      const conectadoAgora = Boolean(estado.isConnected && estado.isInternetReachable !== false);

      // Só dispara no momento da TRANSIÇÃO offline -> online, não a
      // cada evento de rede (o listener dispara com frequência).
      if (conectadoAgora && estavaConectado.current === false) {
        sincronizar().catch((erro) => console.warn("Falha ao sincronizar:", erro));
      }

      estavaConectado.current = conectadoAgora;
    });

    return () => cancelarInscricao();
  }, []);
}