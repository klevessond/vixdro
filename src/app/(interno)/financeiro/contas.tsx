// src/app/(interno)/financeiro/contas.tsx  ->  rota /financeiro/contas
//
// Contas de caixa (Pro): onde o dinheiro entra e sai. Caixa (dinheiro), Banco
// (Pix, transferência) e Cartão vêm prontas; dá para renomear, criar outras e
// informar o saldo inicial.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Conta, TIPOS_CONTA, TipoConta, excluirConta, listarContas, salvarConta } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

export default function TelaContas() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Contas de caixa' }} />
      <SomentePro recurso="O financeiro" descricao="Contas de caixa, recebimentos e pagamentos, com o saldo de cada conta.">
        <Contas />
      </SomentePro>
    </View>
  );
}

function Contas() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Conta | null>(null);

  const carregar = useCallback(() => {
    listarContas()
      .then(setContas)
      .catch((e) => Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.'))
      .finally(() => setCarregando(false));
  }, []);
  useFocusEffect(carregar);

  const icone = (t: TipoConta) => (TIPOS_CONTA.find((x) => x.valor === t)?.icone ?? 'wallet-outline') as any;
  const total = contas.reduce((t, c) => t + numero(c.saldo ?? '0'), 0);

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      {carregando ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={cor.marca} />
      ) : (
        <>
          <View style={styles.total}>
            <Text style={styles.totalRotulo}>Saldo de todas as contas</Text>
            <Text style={[styles.totalValor, total < 0 && { color: cor.erro }]}>{reais(total)}</Text>
          </View>
          <View style={styles.lista}>
            {contas.map((c, i) => (
              <Pressable key={c.id} onPress={() => setEditando(c)} style={({ pressed }) => [styles.item, i > 0 && styles.divisor, pressed && { backgroundColor: cor.marcaClara }]}>
                <View style={styles.icone}>
                  <MaterialCommunityIcons name={icone(c.tipo)} size={22} color={cor.marca} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{c.nome}</Text>
                  <Text style={styles.tipo}>{TIPOS_CONTA.find((x) => x.valor === c.tipo)?.rotulo}</Text>
                </View>
                <Text style={[styles.saldo, numero(c.saldo ?? '0') < 0 && { color: cor.erro }]}>{reais(c.saldo ?? '0')}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.nova} onPress={() => setEditando({ nome: '', tipo: 'banco', saldo_inicial: '0' })}>
            <Text style={styles.novaTexto}>+ Nova conta</Text>
          </Pressable>
          <Text style={styles.nota}>
            O saldo é o saldo inicial, mais o que foi recebido, menos o que foi pago em cada conta. Toque numa conta para
            renomear ou ajustar o saldo inicial.
          </Text>
        </>
      )}

      {!!editando && (
        <EditorConta
          conta={editando}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}
    </ScrollView>
  );
}

function EditorConta({ conta, onSalvo, onFechar }: { conta: Conta; onSalvo: () => void; onFechar: () => void }) {
  const [nome, setNome] = useState(conta.nome);
  const [tipo, setTipo] = useState<TipoConta>(conta.tipo);
  const [saldo, setSaldo] = useState(String(numero(conta.saldo_inicial)).replace('.', ','));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return Alert.alert('Falta o nome', 'Ex: Caixa da loja, Banco do Brasil, Maquininha.');
    setSalvando(true);
    try {
      await salvarConta({ id: conta.id, nome, tipo, saldo_inicial: saldo });
      onSalvo();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    Alert.alert('Excluir conta', 'A conta some das listas, mas os lançamentos dela continuam guardados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await excluirConta(conta.id!); onSalvo(); } catch (e: any) { Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.'); }
      } },
    ]);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.caixa}>
          <Text style={styles.caixaTitulo}>{conta.id ? 'Editar conta' : 'Nova conta'}</Text>
          <Text style={styles.rotulo}>Nome</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Banco do Brasil" placeholderTextColor="#93A3A5" />
          <Text style={styles.rotulo}>Tipo</Text>
          <View style={styles.chips}>
            {TIPOS_CONTA.map((t) => (
              <Pressable key={t.valor} onPress={() => setTipo(t.valor)} style={[styles.chip, tipo === t.valor && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, tipo === t.valor && { color: '#FFFFFF' }]}>{t.rotulo}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.rotulo}>Saldo inicial (R$)</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={saldo} onChangeText={(v) => setSaldo(v.replace(/[^0-9,.-]/g, ''))} keyboardType="numbers-and-punctuation" />
          <View style={styles.acoes}>
            <Pressable style={styles.cancelar} onPress={onFechar}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
            </Pressable>
          </View>
          {!!conta.id && (
            <Pressable style={{ alignItems: 'center', paddingTop: 14 }} onPress={excluir}>
              <Text style={{ color: cor.erro, fontSize: 15, fontWeight: '600' }}>Excluir conta</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center' },
  total: { backgroundColor: cor.marca, borderRadius: raio.cartao, padding: espaco.lg },
  totalRotulo: { color: cor.textoSobreMarcaSuave, fontSize: 13, fontWeight: '700' },
  totalValor: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  lista: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: espaco.lg },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  icone: { width: 40, height: 40, borderRadius: 10, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center' },
  nome: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  tipo: { color: cor.textoSuave, fontSize: 13 },
  saldo: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  nova: { borderWidth: 1, borderColor: cor.borda, borderStyle: 'dashed', borderRadius: raio.campo, paddingVertical: 12, alignItems: 'center', backgroundColor: cor.cartao },
  novaTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 13, lineHeight: 18 },
  fundo: { flex: 1, backgroundColor: 'rgba(22,41,43,0.45)', justifyContent: 'center', padding: espaco.lg },
  caixa: { backgroundColor: cor.cartao, borderRadius: raio.cartao, padding: espaco.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  caixaTitulo: { color: cor.texto, fontSize: 19, fontWeight: '800', marginBottom: espaco.sm },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: espaco.sm },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.fundo },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  acoes: { flexDirection: 'row', gap: 10, marginTop: espaco.xl },
  cancelar: { borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  cancelarTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  botao: { flex: 1, backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
