// src/components/plano/SomentePro.tsx
//
// Embrulha uma tela ou seção paga: mostra o conteúdo para quem tem o Pro e,
// para os demais, o aviso do plano. Ex:
//
//   <SomentePro recurso="Financeiro" descricao="Contas a receber, parcelas e fluxo de caixa.">
//     <TelaFinanceiro />
//   </SomentePro>
//
// A proteção de verdade fica no servidor (RequerPro). Isto aqui é a cara dela no app.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePlano } from '@/hooks/usePlano';
import { cor, espaco, raio, sombra } from '@/ui/tema';

type Props = { recurso: string; descricao: string; children: ReactNode };

export function SomentePro({ recurso, descricao, children }: Props) {
  const { pro, carregando } = usePlano();
  if (carregando) return <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />;
  if (pro) return <>{children}</>;
  return <AvisoPro recurso={recurso} descricao={descricao} />;
}

export function AvisoPro({ recurso, descricao }: { recurso: string; descricao: string }) {
  const router = useRouter();
  return (
    <View style={styles.cartao}>
      <View style={styles.selo}>
        <MaterialCommunityIcons name="crown-outline" size={30} color={cor.marca} />
      </View>
      <Text style={styles.titulo}>{recurso} faz parte do plano Pro</Text>
      <Text style={styles.texto}>{descricao}</Text>
      <Pressable
        style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaEscura }]}
        onPress={() => router.push('/configuracoes/plano')}
      >
        <Text style={styles.botaoTexto}>Conhecer o plano Pro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    margin: espaco.lg, padding: espaco.xl, alignItems: 'center', gap: espaco.sm, backgroundColor: cor.cartao,
    borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, maxWidth: 520, alignSelf: 'center', ...sombra,
  },
  selo: { width: 64, height: 64, borderRadius: 32, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: cor.texto, fontSize: 19, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  texto: { color: cor.textoSuave, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingHorizontal: 20, paddingVertical: 13, marginTop: espaco.sm },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
