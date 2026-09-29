// src/components/projetos/AjustesOrcamento.tsx
//
// Janela discreta com a margem, a mão de obra e a perda DESTE orçamento.
// Fica fora da tela do projeto para o cliente não ver quando o orçamento
// é montado na frente dele.

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { COR } from '@/components/produtos/cores';

export type ValoresAjuste = {
  margem_percentual: string;
  mao_de_obra_m2: string;
  mao_de_obra_minima: string;
  perda_percentual: string;
};

type Props = {
  visivel: boolean;
  valores: ValoresAjuste;
  onSalvar: (v: ValoresAjuste) => void;
  onFechar: () => void;
};

const CAMPOS: { chave: keyof ValoresAjuste; rotulo: string }[] = [
  { chave: 'margem_percentual', rotulo: 'Margem sobre o material (%)' },
  { chave: 'mao_de_obra_m2', rotulo: 'Mão de obra por m² (R$)' },
  { chave: 'mao_de_obra_minima', rotulo: 'Mínimo por peça (R$)' },
  { chave: 'perda_percentual', rotulo: 'Perda no corte (%)' },
];

export function AjustesOrcamento({ visivel, valores, onSalvar, onFechar }: Props) {
  const [v, setV] = useState(valores);

  useEffect(() => {
    if (visivel) setV(valores);
  }, [visivel]);

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.topo}>
          <Text style={styles.titulo}>Ajustes</Text>
          <Pressable onPress={onFechar} hitSlop={10}>
            <Text style={styles.link}>Cancelar</Text>
          </Pressable>
        </View>
        <Text style={styles.ajuda}>
          Valem só para este orçamento. Os valores padrão ficam em "Preços e margem", na tela inicial.
        </Text>
        {CAMPOS.map((c) => (
          <View key={c.chave} style={{ marginBottom: 14 }}>
            <Text style={styles.rotulo}>{c.rotulo}</Text>
            <TextInput
              style={styles.input}
              value={v[c.chave]}
              onChangeText={(t) => setV((a) => ({ ...a, [c.chave]: t.replace(/[^0-9,.]/g, '').replace(',', '.') }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COR.tintaSuave}
            />
          </View>
        ))}
        <Pressable style={styles.botao} onPress={() => onSalvar(v)}>
          <Text style={styles.botaoTexto}>Aplicar</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  link: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  ajuda: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COR.tinta,
  },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
