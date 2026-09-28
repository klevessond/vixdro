// src/app/(interno)/produtos/[id].tsx  ->  rotas /produtos/novo e /produtos/<id>
//
// Montagem do produto: nome, categoria, itens do catálogo com a regra de
// consumo de cada um, e um teste com medidas reais para conferir o custo.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

import {
  CATEGORIAS,
  Componente,
  ItemCatalogo,
  Produto,
  Simulacao,
  arquivarProduto,
  modoDoItem,
  numero,
  obterProduto,
  reais,
  resumoRegra,
  salvarProduto,
  simular,
} from '@/api/produtos';
import { EditorRegra } from '@/components/produtos/EditorRegra';
import { SeletorItem } from '@/components/produtos/SeletorItem';
import { COR } from '@/components/produtos/cores';

const VAZIO: Produto = { nome: '', categoria: 'janela', descricao: '', componentes: [] };

// No iOS, um modal só abre depois que o anterior terminou de fechar.
const ESPERA_MODAL = Platform.OS === 'ios' ? 450 : 0;

type Edicao = { indice: number | null; componente: Componente };

export default function EditorProduto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const novo = id === 'novo';

  const [produto, setProduto] = useState<Produto>(VAZIO);
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  const [largura, setLargura] = useState('1200');
  const [altura, setAltura] = useState('1000');
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (novo || !id) return;
    obterProduto(id)
      .then(setProduto)
      .catch((e) => Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]))
      .finally(() => setCarregando(false));
  }, [id, novo]);

  function alterar(parcial: Partial<Produto>) {
    setProduto((p) => ({ ...p, ...parcial }));
    if (parcial.componentes) setSimulacao(null); // o cálculo antigo deixou de valer
  }

  function itemEscolhido(item: ItemCatalogo) {
    setSeletorAberto(false);
    const componente: Componente = {
      item: item.id,
      item_detalhe: item,
      coef_largura: '0',
      coef_altura: '0',
      coef_area: modoDoItem(item) === 'area' ? '1' : '0',
      ajuste: modoDoItem(item) === 'unidade' ? '1' : '0',
      observacao: '',
    };
    setTimeout(() => setEdicao({ indice: null, componente }), ESPERA_MODAL);
  }

  function regraConfirmada(c: Componente) {
    const lista = [...produto.componentes];
    if (edicao?.indice === null || edicao?.indice === undefined) lista.push(c);
    else lista[edicao.indice] = c;
    alterar({ componentes: lista });
    setEdicao(null);
  }

  function removerComponente() {
    if (edicao?.indice === null || edicao?.indice === undefined) return;
    alterar({ componentes: produto.componentes.filter((_, i) => i !== edicao.indice) });
    setEdicao(null);
  }

  async function calcular() {
    const L = Math.round(numero(largura));
    const A = Math.round(numero(altura));
    if (!L || !A) {
      Alert.alert('Medidas', 'Informe a largura e a altura em milímetros.');
      return;
    }
    setCalculando(true);
    try {
      setSimulacao(await simular(L, A, produto.componentes));
    } catch (e: any) {
      Alert.alert('Não foi possível calcular', e?.message ?? 'Tente novamente.');
    } finally {
      setCalculando(false);
    }
  }

  async function salvar() {
    if (!produto.nome.trim()) {
      Alert.alert('Falta o nome', 'Dê um nome ao produto, ex: Janela veneziana 2 folhas.');
      return;
    }
    if (!produto.componentes.length) {
      Alert.alert('Nenhum item', 'Adicione pelo menos um item ao produto.');
      return;
    }
    setSalvando(true);
    try {
      await salvarProduto(produto);
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    Alert.alert('Excluir produto', `Excluir "${produto.nome}"? Projetos já feitos não são afetados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await arquivarProduto(produto.id!);
            router.back();
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <View style={styles.tela}>
        <Stack.Screen options={{ headerShown: true, title: 'Produto' }} />
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: novo ? 'Novo produto' : 'Editar produto' }} />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={styles.rotulo}>Nome</Text>
        <TextInput
          style={styles.input}
          value={produto.nome}
          onChangeText={(nome) => alterar({ nome })}
          placeholder="Ex: Janela veneziana 2 folhas"
          placeholderTextColor={COR.tintaSuave}
        />

        <Text style={styles.rotulo}>Categoria</Text>
        <View style={styles.chips}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c.valor}
              onPress={() => alterar({ categoria: c.valor })}
              style={[styles.chip, produto.categoria === c.valor && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, produto.categoria === c.valor && styles.chipTextoAtivo]}>
                {c.rotulo}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.secao}>Itens</Text>
        <Text style={styles.ajuda}>L é a largura e A é a altura do vão. Toque num item para mudar a regra.</Text>
        <View style={styles.caixa}>
          {produto.componentes.map((c, i) => (
            <View key={`${c.item}-${i}`}>
              {i > 0 && <View style={styles.divisor} />}
              <Pressable
                onPress={() => setEdicao({ indice: i, componente: c })}
                style={({ pressed }) => [styles.componente, pressed && { backgroundColor: COR.bordaClara }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.componenteNome}>{c.item_detalhe.descricao}</Text>
                  <Text style={styles.componenteDetalhe}>
                    {c.item_detalhe.codigo}
                    {c.observacao ? ` · ${c.observacao}` : ''}
                    {!c.item_detalhe.ativo ? ' · saiu de linha' : ''}
                  </Text>
                </View>
                <Text style={styles.regra}>{resumoRegra(c)}</Text>
              </Pressable>
            </View>
          ))}
          {produto.componentes.length > 0 && <View style={styles.divisor} />}
          <Pressable
            onPress={() => setSeletorAberto(true)}
            style={({ pressed }) => [styles.adicionar, pressed && { backgroundColor: COR.bordaClara }]}
            accessibilityRole="button"
          >
            <Text style={styles.adicionarTexto}>+ Adicionar item do catálogo</Text>
          </Pressable>
        </View>

        {produto.componentes.length > 0 && (
          <>
            <Text style={styles.secao}>Testar com medidas</Text>
            <View style={styles.medidas}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rotulo}>Largura (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={largura}
                  onChangeText={(v) => setLargura(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rotulo}>Altura (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={altura}
                  onChangeText={(v) => setAltura(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <Pressable style={styles.botaoContorno} onPress={calcular} disabled={calculando}>
              {calculando ? (
                <ActivityIndicator color={COR.borda} />
              ) : (
                <Text style={styles.botaoContornoTexto}>Calcular custo</Text>
              )}
            </Pressable>

            {simulacao && (
              <View style={styles.resultado}>
                {simulacao.linhas.map((l, i) => (
                  <View key={i} style={styles.resultadoLinha}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultadoItem} numberOfLines={1}>{l.descricao}</Text>
                      <Text style={styles.resultadoConsumo}>
                        {numero(l.consumo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {l.unidade_consumo}
                        {l.pecas !== null &&
                          ` · ${numero(l.pecas).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} peça`}
                      </Text>
                    </View>
                    <Text style={styles.resultadoCusto}>{reais(l.custo)}</Text>
                  </View>
                ))}
                <View style={styles.total}>
                  <Text style={styles.totalRotulo}>Material</Text>
                  <Text style={styles.totalValor}>{reais(simulacao.custo_total)}</Text>
                </View>
                <Text style={styles.nota}>
                  Custo proporcional das barras. A compra em barras inteiras é calculada no projeto,
                  somando todas as peças.
                </Text>
              </View>
            )}
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.botao, (pressed || salvando) && { backgroundColor: COR.bordaEscura }]}
          onPress={salvar}
          disabled={salvando}
          accessibilityRole="button"
        >
          {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar produto</Text>}
        </Pressable>
        {!novo && (
          <Pressable style={styles.excluir} onPress={excluir} accessibilityRole="button">
            <Text style={styles.excluirTexto}>Excluir produto</Text>
          </Pressable>
        )}
      </ScrollView>

      <SeletorItem visivel={seletorAberto} onSelecionar={itemEscolhido} onFechar={() => setSeletorAberto(false)} />
      <EditorRegra
        componente={edicao?.componente ?? null}
        onSalvar={regraConfirmada}
        onRemover={edicao?.indice !== null ? removerComponente : undefined}
        onFechar={() => setEdicao(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COR.superficie,
    borderWidth: 1,
    borderColor: COR.linha,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COR.tinta,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: COR.linha, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: COR.superficie },
  chipAtivo: { backgroundColor: COR.borda, borderColor: COR.borda },
  chipTexto: { color: COR.tinta, fontSize: 14 },
  chipTextoAtivo: { color: '#FFFFFF', fontWeight: '600' },
  secao: { color: COR.tinta, fontSize: 17, fontWeight: '700', marginTop: 24 },
  ajuda: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 10 },
  caixa: { backgroundColor: COR.superficie, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, overflow: 'hidden' },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 16 },
  componente: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  componenteNome: { color: COR.tinta, fontSize: 15, fontWeight: '600' },
  componenteDetalhe: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  regra: { color: COR.borda, fontSize: 14, fontWeight: '700', maxWidth: '45%', textAlign: 'right' },
  adicionar: { padding: 16, alignItems: 'center' },
  adicionarTexto: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  medidas: { flexDirection: 'row', gap: 12, marginTop: 8 },
  botaoContorno: {
    borderWidth: 1.5,
    borderColor: COR.borda,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botaoContornoTexto: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  resultado: { backgroundColor: COR.superficie, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, padding: 14, marginTop: 12 },
  resultadoLinha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 },
  resultadoItem: { color: COR.tinta, fontSize: 14 },
  resultadoConsumo: { color: COR.tintaSuave, fontSize: 13 },
  resultadoCusto: { color: COR.tinta, fontSize: 14, fontWeight: '600' },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COR.linha, marginTop: 8, paddingTop: 10 },
  totalRotulo: { color: COR.tinta, fontSize: 16, fontWeight: '700' },
  totalValor: { color: COR.tinta, fontSize: 18, fontWeight: '800' },
  nota: { color: COR.tintaSuave, fontSize: 12, lineHeight: 17, marginTop: 8 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  excluir: { alignItems: 'center', paddingVertical: 16 },
  excluirTexto: { color: COR.erro, fontSize: 15, fontWeight: '600' },
});
