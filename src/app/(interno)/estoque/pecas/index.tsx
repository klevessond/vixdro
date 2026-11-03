// src/app/(interno)/estoque/pecas/index.tsx  ->  rota /estoque/pecas
//
// Peças prontas (plano Pro): o que foi produzido para o estoque, e a
// produção, que tira os materiais pelas regras do produto.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PecaPronta, SimulacaoProducao, listarPecasProntas, produzirPecas, simularProducao } from '@/api/estoque';
import { Produto, listarProdutos, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

const metros = (mm: number) => (mm / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const paraMm = (texto: string) => Math.round((parseFloat(texto.replace(',', '.')) || 0) * 1000);

export default function TelaPecasProntas() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Peças prontas' }} />
      <SomentePro recurso="O estoque" descricao="Produza peças para o estoque e use-as nos projetos.">
        <Pecas />
      </SomentePro>
    </View>
  );
}

function Pecas() {
  const router = useRouter();
  const [pecas, setPecas] = useState<PecaPronta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produzindo, setProduzindo] = useState(false);

  const carregar = useCallback(() => {
    listarPecasProntas()
      .then(setPecas)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);
  useFocusEffect(carregar);

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Pressable style={styles.produzir} onPress={() => setProduzindo(true)}>
        <MaterialCommunityIcons name="hammer-wrench" size={20} color="#FFFFFF" />
        <Text style={styles.produzirTexto}>Registrar produção</Text>
      </Pressable>
      <Text style={styles.nota}>
        Ao produzir, os materiais saem do estoque pelas regras do produto, e as peças entram aqui. Nos projetos, ao montar
        uma peça do mesmo produto e medidas, o app oferece usar as prontas.
      </Text>

      {carregando ? (
        <ActivityIndicator color={cor.marca} />
      ) : pecas.length === 0 ? (
        <View style={styles.vazio}>
          <MaterialCommunityIcons name="window-closed-variant" size={42} color={cor.textoSuave} />
          <Text style={styles.vazioTexto}>Nenhuma peça pronta ainda.</Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {pecas.map((p, i) => (
            <Pressable key={p.id} onPress={() => router.push(`/estoque/pecas/${p.id}`)} style={({ pressed }) => [styles.item, i > 0 && styles.divisor, pressed && { backgroundColor: cor.marcaClara }]}>
              <View style={styles.foto}>
                {p.miniatura_url ? (
                  <Image source={{ uri: p.miniatura_url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <MaterialCommunityIcons name="window-closed-variant" size={26} color={cor.marca} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{p.nome}</Text>
                <Text style={styles.detalhe}>
                  {metros(p.largura_mm)} × {metros(p.altura_mm)} m{p.observacao ? ` · ${p.observacao}` : ''} · custo {reais(p.custo_unitario)}
                </Text>
              </View>
              <Text style={[styles.saldo, p.saldo <= 0 && { color: cor.textoSuave }]}>{p.saldo} un</Text>
            </Pressable>
          ))}
        </View>
      )}

      {produzindo && (
        <Producao
          onFeito={() => {
            setProduzindo(false);
            carregar();
          }}
          onFechar={() => setProduzindo(false)}
        />
      )}
    </ScrollView>
  );
}

function Producao({ onFeito, onFechar }: { onFeito: () => void; onFechar: () => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [obs, setObs] = useState('');
  const [sim, setSim] = useState<SimulacaoProducao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarProdutos().then(setProdutos).catch(() => {});
  }, []);

  const dados = produto
    ? { produto: produto.id!, largura_mm: paraMm(largura), altura_mm: paraMm(altura), quantidade: parseInt(quantidade, 10) || 0, observacao: obs }
    : null;

  // Recalcula os materiais necessários ao mudar a escolha (espera parar de digitar).
  useEffect(() => {
    setSim(null);
    if (!dados || dados.quantidade < 1) return;
    const t = setTimeout(() => simularProducao(dados).then(setSim).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [produto?.id, largura, altura, quantidade]);

  async function confirmar() {
    if (!dados) return Alert.alert('Falta o produto', 'Escolha o produto que foi produzido.');
    if (dados.quantidade < 1) return Alert.alert('Falta a quantidade', 'Quantas peças foram produzidas?');
    const registrar = async () => {
      setSalvando(true);
      try {
        await produzirPecas(dados);
        onFeito();
      } catch (e: any) {
        Alert.alert('Não foi possível registrar', e?.message ?? 'Tente novamente.');
      } finally {
        setSalvando(false);
      }
    };
    if (sim?.falta_algum) {
      Alert.alert('Material insuficiente', 'O estoque não tem todo o material. Registrar mesmo assim (o saldo fica negativo até a contagem)?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Registrar', onPress: registrar },
      ]);
      return;
    }
    registrar();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: espaco.xl, gap: espaco.sm }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalTopo}>
            <Text style={styles.modalTitulo}>Registrar produção</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>

          <Text style={styles.rotulo}>Produto</Text>
          <View style={styles.chips}>
            {produtos.map((p) => (
              <Pressable key={p.id} onPress={() => setProduto(p)} style={[styles.chip, produto?.id === p.id && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, produto?.id === p.id && { color: '#FFFFFF' }]}>{p.nome}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.linha}>
            <View>
              <Text style={styles.rotulo}>Largura (m)</Text>
              <TextInput style={[styles.input, { width: 110 }]} value={largura} onChangeText={(v) => setLargura(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" placeholder="1,20" placeholderTextColor="#93A3A5" />
            </View>
            <View>
              <Text style={styles.rotulo}>Altura (m)</Text>
              <TextInput style={[styles.input, { width: 110 }]} value={altura} onChangeText={(v) => setAltura(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" placeholder="1,00" placeholderTextColor="#93A3A5" />
            </View>
            <View>
              <Text style={styles.rotulo}>Quantidade</Text>
              <TextInput style={[styles.input, { width: 90 }]} value={quantidade} onChangeText={(v) => setQuantidade(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
            </View>
          </View>
          <Text style={styles.rotulo}>Observação (opcional)</Text>
          <TextInput style={styles.input} value={obs} onChangeText={setObs} placeholder="Ex: branca, abre para a esquerda" placeholderTextColor="#93A3A5" />
          <Text style={styles.nota}>Peças do mesmo produto, medidas e observação ficam juntas no estoque.</Text>

          {sim && (
            <View style={styles.sim}>
              <Text style={styles.simTitulo}>Materiais que saem do estoque</Text>
              {sim.materiais.map((m) => (
                <View key={m.item} style={styles.simLinha}>
                  <Text style={[styles.simTexto, { flex: 1 }]} numberOfLines={1}>{m.descricao}</Text>
                  <Text style={[styles.simTexto, m.falta && { color: cor.erro, fontWeight: '700' }]}>
                    {m.precisa}{m.falta ? ` (tem ${m.tem})` : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.simCusto}>Custo do material: {reais(sim.custo_unitario)} por peça · {reais(sim.custo_total)} no total</Text>
            </View>
          )}

          <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={confirmar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Registrar produção</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  produzir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13 },
  produzirTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 12, lineHeight: 17 },
  vazio: { alignItems: 'center', padding: espaco.xxl, gap: 6 },
  vazioTexto: { color: cor.textoSuave, fontSize: 15 },
  lista: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: espaco.lg },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  foto: { width: 52, height: 52, borderRadius: 10, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nome: { color: cor.texto, fontSize: 15, fontWeight: '800' },
  detalhe: { color: cor.textoSuave, fontSize: 12, marginTop: 2 },
  saldo: { color: cor.texto, fontSize: 17, fontWeight: '800' },
  modalTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitulo: { color: cor.texto, fontSize: 20, fontWeight: '800' },
  link: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.cartao },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  sim: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, padding: espaco.md, gap: 4, marginTop: espaco.sm },
  simTitulo: { color: cor.texto, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  simLinha: { flexDirection: 'row', gap: 8 },
  simTexto: { color: cor.texto, fontSize: 13 },
  simCusto: { color: cor.marca, fontSize: 13, fontWeight: '700', marginTop: 4 },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 14, alignItems: 'center', marginTop: espaco.lg },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
