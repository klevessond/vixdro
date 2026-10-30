// src/components/navegacao/BotaoVoltar.tsx
//
// O botão de voltar de TODAS as telas com cabeçalho (configurado uma vez, no
// _layout principal). Telas novas ganham o botão sem precisar fazer nada.
//
// Volta para a tela anterior quando existe; sem histórico (no site, depois de
// recarregar a página ou abrir um link direto), sobe um nível no menu:
//   /financeiro/123  ->  /financeiro  ->  /  (tela inicial)

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { cor } from '@/ui/tema';

// Telas cujo "nível de cima" não é simplesmente o caminho sem o último pedaço.
const PAI_DE: Record<string, string> = {
  '/configuracoes/formas-pagamento': '/configuracoes/precos',
  '/projetos/parados': '/', // aberta pelo aviso da tela inicial
};

// Pedaços de caminho que não são telas (só agrupam): sobe direto para o início.
const SEM_TELA = new Set(['/configuracoes']);

export function rotaPai(caminho: string): string {
  if (PAI_DE[caminho]) return PAI_DE[caminho];
  const partes = caminho.split('/').filter(Boolean);
  partes.pop();
  const pai = '/' + partes.join('/');
  return pai === '/' || SEM_TELA.has(pai) ? '/' : pai;
}

export function BotaoVoltar() {
  const router = useRouter();
  const caminho = usePathname();

  function voltar() {
    if (router.canGoBack()) router.back();
    else router.replace(rotaPai(caminho) as any);
  }

  return (
    <Pressable
      onPress={voltar}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaClara }]}
    >
      <MaterialCommunityIcons name="arrow-left" size={20} color={cor.marca} />
      <Text style={styles.texto}>Voltar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: cor.marca,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 10,
  },
  texto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
});
