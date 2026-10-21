// src/hooks/usePlano.ts
//
// Plano da conta, atualizado sempre que a tela volta a aparecer (a equipe
// pode liberar o Pro a qualquer momento pelo admin).

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Plano, obterPlano } from '@/api/plano';

export function usePlano() {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      obterPlano()
        .then(setPlano)
        .catch(() => {})
        .finally(() => setCarregando(false));
    }, [])
  );

  return { plano, carregando, pro: !!plano?.pro };
}
