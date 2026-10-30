// src/components/financeiro/ConfirmarPagamento.tsx
//
// Ao marcar um lançamento como recebido/pago: forma, conta de caixa e data.
// A conta já vem sugerida pela forma (Pix -> Banco; dinheiro -> Caixa).

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Conta, FORMAS, FormaPagamento, Lancamento, listarContas, marcarPago, tipoContaDaForma } from '@/api/financeiro';
import { reais } from '@/api/produtos';
import { cor, espaco, raio } from '@/ui/tema';
import { hojeISO, isoParaTexto, mascaraData, textoParaISO } from '@/util/datas';

type Props = {
  lancamento: Lancamento | null; // null = fechado
  onConfirmado: (l: Lancamento) => void;
  onFechar: () => void;
};

export function ConfirmarPagamento({ lancamento, onConfirmado, onFechar }: Props) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [conta, setConta] = useState<string | null>(null);
  const [data, setData] = useState(isoParaTexto(hojeISO()));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!lancamento) return;
    setForma(lancamento.forma || '');
    setConta(null);
    setData(isoParaTexto(hojeISO()));
    listarContas()
      .then((lista) => {
        setContas(lista);
        // Forma já conhecida: a conta correspondente já vem marcada.
        const tipo = tipoContaDaForma(lancamento.forma || '');
        const sugerida = tipo ? lista.find((c) => c.tipo === tipo) : undefined;
        if (sugerida) setConta(sugerida.id!);
      })
      .catch(() => setContas([]));
  }, [lancamento?.id]);

  function escolherForma(f: FormaPagamento) {
    const nova = forma === f ? '' : f;
    setForma(nova);
    const tipo = tipoContaDaForma(nova);
    const sugerida = tipo ? contas.find((c) => c.tipo === tipo) : undefined;
    if (sugerida) setConta(sugerida.id!);
  }

  async function confirmar() {
    if (!lancamento) return;
    const pagoEm = textoParaISO(data);
    if (!pagoEm) return Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa.');
    setSalvando(true);
    try {
      onConfirmado(await marcarPago(lancamento.id!, true, { forma, conta, pago_em: pagoEm }));
    } catch (e: any) {
      Alert.alert('Não foi possível confirmar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const receber = lancamento?.tipo === 'receber';

  return (
    <Modal visible={!!lancamento} transparent animationType="fade" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.caixa}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.titulo}>{receber ? 'Confirmar recebimento' : 'Confirmar pagamento'}</Text>
            {!!lancamento && (
              <Text style={styles.descricao} numberOfLines={2}>
                {lancamento.descricao} · <Text style={{ fontWeight: '800' }}>{reais(lancamento.valor)}</Text>
              </Text>
            )}

            <Text style={styles.rotulo}>Forma</Text>
            <View style={styles.chips}>
              {FORMAS.map((f) => (
                <Pressable key={f.valor} onPress={() => escolherForma(f.valor)} style={[styles.chip, forma === f.valor && styles.chipAtivo]}>
                  <Text style={[styles.chipTexto, forma === f.valor && { color: '#FFFFFF' }]}>{f.rotulo}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.rotulo}>{receber ? 'Entrou na conta' : 'Saiu da conta'}</Text>
            <View style={styles.chips}>
              {contas.map((c) => (
                <Pressable key={c.id} onPress={() => setConta(conta === c.id ? null : c.id!)} style={[styles.chip, conta === c.id && styles.chipAtivo]}>
                  <Text style={[styles.chipTexto, conta === c.id && { color: '#FFFFFF' }]}>{c.nome}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.nota}>
              Ao escolher a forma, a conta é marcada sozinha: dinheiro → Caixa · Pix, transferência ou boleto → Banco ·
              cartão → Cartão. Dá para trocar.
            </Text>

            <Text style={styles.rotulo}>Data</Text>
            <TextInput
              style={styles.input}
              value={data}
              onChangeText={(v) => setData(mascaraData(v))}
              keyboardType="number-pad"
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#93A3A5"
            />

            <View style={styles.acoes}>
              <Pressable style={styles.cancelar} onPress={onFechar}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={confirmar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>{receber ? 'Recebido' : 'Pago'}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(22,41,43,0.45)', justifyContent: 'center', padding: espaco.lg },
  caixa: { backgroundColor: cor.cartao, borderRadius: raio.cartao, padding: espaco.xl, maxHeight: '90%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  titulo: { color: cor.texto, fontSize: 19, fontWeight: '800' },
  descricao: { color: cor.textoSuave, fontSize: 14, marginTop: 4, marginBottom: espaco.md },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  nota: { color: cor.textoSuave, fontSize: 12, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: cor.texto, backgroundColor: cor.fundo, width: 160,
  },
  acoes: { flexDirection: 'row', gap: 10, marginTop: espaco.xl },
  cancelar: { borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  cancelarTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  botao: { flex: 1, backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
