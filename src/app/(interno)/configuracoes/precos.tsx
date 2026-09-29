// src/app/(interno)/configuracoes/precos.tsx  ->  rota /configuracoes/precos
//
// Padrões de preço do vidraceiro. Todo projeto novo nasce com estes
// valores; em cada projeto eles podem ser ajustados em "Ajustes".

import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrecosPadrao, obterPrecosPadrao, salvarPrecosPadrao } from '@/api/precos';
import { numero } from '@/api/produtos';
import { COR } from '@/components/produtos/cores';

type Campo = { chave: keyof PrecosPadrao; rotulo: string; ajuda: string; inteiro?: boolean };

const CAMPOS: Campo[] = [
  { chave: 'margem_padrao', rotulo: 'Margem sobre o material (%)', ajuda: 'Seu lucro sobre o custo dos itens.' },
  { chave: 'mao_de_obra_m2_padrao', rotulo: 'Mão de obra por m² (R$)', ajuda: 'Multiplicada pela área de cada peça.' },
  { chave: 'mao_de_obra_minima_padrao', rotulo: 'Mão de obra mínima por peça (R$)', ajuda: 'Para peças pequenas não saírem baratas demais.' },
  { chave: 'perda_padrao', rotulo: 'Perda no corte dos perfis (%)', ajuda: 'Sobra estimada das barras. Entra no custo e na lista de compra.' },
  { chave: 'validade_padrao', rotulo: 'Validade do orçamento (dias)', ajuda: 'Aparece no PDF como "Válido até".', inteiro: true },
];

function paraTexto(v: string | number) {
  const n = numero(String(v ?? ''));
  return n ? String(n) : '';
}

export default function PrecosScreen() {
  const router = useRouter();
  const [valores, setValores] = useState<PrecosPadrao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterPrecosPadrao()
      .then((p) => {
        const texto = {} as PrecosPadrao;
        CAMPOS.forEach((c) => ((texto as any)[c.chave] = paraTexto(p[c.chave])));
        setValores(texto);
      })
      .catch((e) =>
        Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      );
  }, []);

  async function salvar() {
    if (!valores) return;
    setSalvando(true);
    try {
      const envio = {} as PrecosPadrao;
      CAMPOS.forEach((c) => ((envio as any)[c.chave] = valores[c.chave] || (c.inteiro ? '15' : '0')));
      await salvarPrecosPadrao(envio);
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Preços e margem' }} />
      {!valores ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      ) : (
        <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Todo projeto novo começa com estes valores. Em cada projeto, você pode mudá-los em
            "Ajustes", sem que apareçam na tela. O cliente nunca vê estes números, nem no PDF.
          </Text>
          {CAMPOS.map((c) => (
            <View key={c.chave} style={styles.campo}>
              <Text style={styles.rotulo}>{c.rotulo}</Text>
              <TextInput
                style={styles.input}
                value={String(valores[c.chave])}
                onChangeText={(v) =>
                  setValores((atual) => ({
                    ...atual!,
                    [c.chave]: c.inteiro ? v.replace(/\D/g, '') : v.replace(/[^0-9,.]/g, '').replace(',', '.'),
                  }))
                }
                keyboardType={c.inteiro ? 'number-pad' : 'decimal-pad'}
                placeholder="0"
                placeholderTextColor={COR.tintaSuave}
              />
              <Text style={styles.ajuda}>{c.ajuda}</Text>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [styles.botao, (pressed || salvando) && { backgroundColor: COR.bordaEscura }]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  intro: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  campo: { marginBottom: 18 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COR.tinta,
  },
  ajuda: { color: COR.tintaSuave, fontSize: 13, marginTop: 4 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
