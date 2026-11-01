// src/app/(interno)/estoque/[item].tsx  ->  rota /estoque/<id do item>
//
// Ficha de um item no estoque: saldo, custo médio, mínimo e o histórico.
// Ações: contagem (inventário), entrada de compra e perda/quebra.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ItemEstoque, Movimento, definirMinimo, movimentar, obterItemEstoque } from '@/api/estoque';
import { numero, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

type Acao = 'inventario' | 'compra' | 'perda';

const ACOES: { valor: Acao; rotulo: string; icone: any; ajuda: string }[] = [
  { valor: 'inventario', rotulo: 'Contagem', icone: 'clipboard-check-outline', ajuda: 'Informe quanto você TEM agora: o saldo passa a ser esse.' },
  { valor: 'compra', rotulo: 'Entrada', icone: 'tray-arrow-down', ajuda: 'Material que chegou e não veio de um pedido do projeto.' },
  { valor: 'perda', rotulo: 'Perda', icone: 'alert-octagon-outline', ajuda: 'Quebra, defeito ou material inutilizado: sai do estoque.' },
];

export default function TelaItemEstoque() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Item do estoque' }} />
      <SomentePro recurso="O estoque" descricao="Saldo dos materiais, pedidos recebidos e baixa automática nas obras.">
        <Ficha />
      </SomentePro>
    </View>
  );
}

function Ficha() {
  const { item } = useLocalSearchParams<{ item: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<(ItemEstoque & { movimentos: Movimento[] }) | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [minimo, setMinimo] = useState('');

  const carregar = useCallback(() => {
    obterItemEstoque(Number(item))
      .then((d) => {
        setDados(d);
        setMinimo(d.minimo ? d.minimo.replace('.', ',') : '');
      })
      .catch((e) => Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.'));
  }, [item]);
  useFocusEffect(carregar);

  if (!dados) return <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />;

  async function salvarMinimo() {
    try {
      await definirMinimo(dados!.item, minimo, 'estoque');
      carregar();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <View style={styles.cartao}>
        <Text style={styles.descricao}>{dados.descricao}</Text>
        <Text style={styles.codigo}>{dados.proprio ? 'Item próprio' : dados.codigo}</Text>
        <Text style={[styles.saldo, dados.abaixo_minimo && { color: cor.alerta }, numero(dados.saldo) < 0 && { color: cor.erro }]}>{dados.saldo_texto}</Text>
        {dados.abaixo_minimo && <Text style={styles.alerta}>Abaixo do mínimo</Text>}
        <Text style={styles.info}>
          Custo médio {reais(dados.custo_medio)} por {dados.unidade} · valor {reais(dados.valor)}
        </Text>
      </View>

      <View style={styles.acoes}>
        {ACOES.map((a) => (
          <Pressable key={a.valor} style={({ pressed }) => [styles.acao, pressed && { backgroundColor: cor.marcaClara }]} onPress={() => setAcao(a.valor)}>
            <MaterialCommunityIcons name={a.icone} size={22} color={a.valor === 'perda' ? cor.erro : cor.marca} />
            <Text style={styles.acaoTexto}>{a.rotulo}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.cartao}>
        <Text style={styles.rotulo}>Estoque mínimo ({dados.unidade})</Text>
        <View style={styles.linha}>
          <TextInput style={[styles.input, { width: 120 }]} value={minimo} onChangeText={(v) => setMinimo(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#93A3A5" />
          <Pressable style={styles.salvar} onPress={salvarMinimo}>
            <Text style={styles.salvarTexto}>Salvar</Text>
          </Pressable>
        </View>
        <Text style={styles.nota}>Abaixo disso, o item aparece em destaque e a tela inicial avisa.</Text>
      </View>

      <Text style={styles.secao}>Histórico</Text>
      {dados.movimentos.length === 0 ? (
        <Text style={styles.nota}>Nenhuma movimentação ainda. Comece pela contagem do que você tem.</Text>
      ) : (
        <View style={[styles.cartao, { padding: 0 }]}>
          {dados.movimentos.map((m, i) => {
            const entrou = numero(m.quantidade) > 0;
            return (
              <Pressable
                key={m.id}
                disabled={!m.projeto}
                onPress={() => m.projeto && router.push(`/projetos/${m.projeto}`)}
                style={[styles.mov, i > 0 && styles.divisor]}
              >
                <MaterialCommunityIcons name={entrou ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline'} size={22} color={entrou ? '#1E6B3A' : cor.erro} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.movTitulo}>{m.motivo_texto}{m.projeto_numero ? ` · Orçamento nº ${m.projeto_numero}` : ''}</Text>
                  <Text style={styles.movDetalhe} numberOfLines={2}>
                    {new Date(m.criado_em).toLocaleDateString('pt-BR')}{m.observacao ? ` · ${m.observacao}` : ''}
                  </Text>
                </View>
                <Text style={[styles.movQtd, { color: entrou ? '#1E6B3A' : cor.erro }]}>{entrou ? '+' : '−'} {m.texto}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {acao && (
        <Movimentar
          acao={acao}
          item={dados}
          onFeito={() => {
            setAcao(null);
            carregar();
          }}
          onFechar={() => setAcao(null)}
        />
      )}
    </ScrollView>
  );
}

function Movimentar({ acao, item, onFeito, onFechar }: { acao: Acao; item: ItemEstoque; onFeito: () => void; onFechar: () => void }) {
  const barra = !!item.comprimento_mm && item.unidade === 'm'; // perfil: dá para informar em barras
  const [unidade, setUnidade] = useState<'compra' | 'estoque'>(barra ? 'compra' : 'estoque');
  const [quantidade, setQuantidade] = useState('');
  const [custo, setCusto] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const info = ACOES.find((a) => a.valor === acao)!;
  const nomeUnidade = unidade === 'compra' && barra ? 'barras' : item.unidade;

  async function salvar() {
    if (!quantidade.trim()) return Alert.alert('Falta a quantidade', 'Informe a quantidade.');
    setSalvando(true);
    try {
      await movimentar({ item: item.item, motivo: acao, quantidade, unidade, custo_unitario: custo || undefined, observacao: obs });
      onFeito();
    } catch (e: any) {
      Alert.alert('Não foi possível registrar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.caixa}>
          <Text style={styles.caixaTitulo}>{info.rotulo}</Text>
          <Text style={styles.nota}>{info.ajuda}</Text>
          {barra && (
            <View style={[styles.linha, { marginTop: espaco.sm }]}>
              {(['compra', 'estoque'] as const).map((u) => (
                <Pressable key={u} onPress={() => setUnidade(u)} style={[styles.chip, unidade === u && styles.chipAtivo]}>
                  <Text style={[styles.chipTexto, unidade === u && { color: '#FFFFFF' }]}>{u === 'compra' ? 'Em barras' : 'Em metros'}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.rotulo}>{acao === 'inventario' ? `Quantidade contada (${nomeUnidade})` : `Quantidade (${nomeUnidade})`}</Text>
          <TextInput style={[styles.input, { width: 140 }]} value={quantidade} onChangeText={(v) => setQuantidade(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" autoFocus />
          {acao === 'compra' && (
            <>
              <Text style={styles.rotulo}>Preço pago por {unidade === 'compra' && barra ? 'barra' : item.unidade} (opcional)</Text>
              <TextInput style={[styles.input, { width: 140 }]} value={custo} onChangeText={(v) => setCusto(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" placeholder="custo médio" placeholderTextColor="#93A3A5" />
            </>
          )}
          <Text style={styles.rotulo}>Observação (opcional)</Text>
          <TextInput style={styles.input} value={obs} onChangeText={setObs} placeholder={acao === 'perda' ? 'Ex: vidro trincou no transporte' : ''} placeholderTextColor="#93A3A5" />
          <View style={[styles.linha, { marginTop: espaco.lg }]}>
            <Pressable style={styles.cancelar} onPress={onFechar}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.salvar, { flex: 1 }, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.salvarTexto}>Registrar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  cartao: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, padding: espaco.lg, ...sombra },
  descricao: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  codigo: { color: cor.textoSuave, fontSize: 13, marginTop: 2 },
  saldo: { color: cor.texto, fontSize: 26, fontWeight: '800', marginTop: espaco.md },
  alerta: { color: cor.alerta, fontSize: 13, fontWeight: '700' },
  info: { color: cor.textoSuave, fontSize: 13, marginTop: 6 },
  acoes: { flexDirection: 'row', gap: espaco.sm },
  acao: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: cor.cartao, borderWidth: 1, borderColor: cor.borda, borderRadius: raio.cartao, paddingVertical: espaco.md },
  acaoTexto: { color: cor.texto, fontSize: 14, fontWeight: '700' },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm, marginBottom: 6 },
  linha: { flexDirection: 'row', gap: espaco.sm, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.fundo },
  salvar: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center' },
  salvarTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 12, marginTop: 4 },
  secao: { color: cor.texto, fontSize: 17, fontWeight: '800', marginTop: espaco.sm },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: espaco.md },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  movTitulo: { color: cor.texto, fontSize: 14, fontWeight: '700' },
  movDetalhe: { color: cor.textoSuave, fontSize: 12 },
  movQtd: { fontSize: 13, fontWeight: '800', textAlign: 'right', maxWidth: 140 },
  fundo: { flex: 1, backgroundColor: 'rgba(22,41,43,0.45)', justifyContent: 'center', padding: espaco.lg },
  caixa: { backgroundColor: cor.cartao, borderRadius: raio.cartao, padding: espaco.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  caixaTitulo: { color: cor.texto, fontSize: 19, fontWeight: '800' },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  cancelar: { borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center' },
  cancelarTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
});
