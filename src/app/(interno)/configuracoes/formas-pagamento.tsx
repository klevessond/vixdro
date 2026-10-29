// src/app/(interno)/configuracoes/formas-pagamento.tsx  ->  rota /configuracoes/formas-pagamento
//
// Formas de pagamento oferecidas ao cliente (plano gratuito). Aparecem no PDF
// do orçamento com os valores calculados, e o projeto guarda a combinada.

import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Condicao, TIPOS_CONDICAO, TipoCondicao, excluirCondicao, listarCondicoes, salvarCondicao, textoCondicao } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

const EXEMPLO = 1000;

export default function FormasPagamento() {
  const [lista, setLista] = useState<Condicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Condicao | null>(null);

  const carregar = useCallback(() => {
    listarCondicoes()
      .then(setLista)
      .catch((e) => Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.'))
      .finally(() => setCarregando(false));
  }, []);
  useFocusEffect(carregar);

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Stack.Screen options={{ headerShown: true, title: 'Formas de pagamento' }} />
      <Text style={styles.intro}>
        Aparecem no PDF do orçamento, com os valores já calculados. O cliente vê, por exemplo, quanto economiza à vista.
      </Text>
      {carregando ? (
        <ActivityIndicator color={cor.marca} />
      ) : (
        <View style={styles.lista}>
          {lista.map((c, i) => (
            <Pressable key={c.id} onPress={() => setEditando(c)} style={({ pressed }) => [styles.item, i > 0 && styles.divisor, pressed && { backgroundColor: cor.marcaClara }]}>
              <Text style={styles.nome}>{c.nome}</Text>
              <Text style={styles.exemplo}>Em {reais(EXEMPLO)}: {textoCondicao(c, EXEMPLO)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        style={styles.nova}
        onPress={() => setEditando({ nome: '', tipo: 'parcelado', desconto_percentual: '0', acrescimo_percentual: '0', max_parcelas: 2, entrada_percentual: '0' })}
      >
        <Text style={styles.novaTexto}>+ Nova forma de pagamento</Text>
      </Pressable>

      {!!editando && (
        <Editor
          condicao={editando}
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

function Editor({ condicao, onSalvo, onFechar }: { condicao: Condicao; onSalvo: () => void; onFechar: () => void }) {
  const txt = (v: string | number) => String(numero(String(v))).replace('.', ',');
  const [c, setC] = useState<Condicao>({
    ...condicao,
    desconto_percentual: txt(condicao.desconto_percentual),
    acrescimo_percentual: txt(condicao.acrescimo_percentual),
    entrada_percentual: txt(condicao.entrada_percentual),
  });
  const [salvando, setSalvando] = useState(false);
  const mudar = (p: Partial<Condicao>) => setC((x) => ({ ...x, ...p }));
  const pct = (v: string) => v.replace(/[^0-9,.]/g, '');
  const paraConta = { ...c, desconto_percentual: c.desconto_percentual.replace(',', '.'), acrescimo_percentual: c.acrescimo_percentual.replace(',', '.'), entrada_percentual: c.entrada_percentual.replace(',', '.') };

  async function salvar() {
    if (!c.nome.trim()) return Alert.alert('Falta o nome', 'Ex: À vista no Pix, Cartão em até 10x.');
    setSalvando(true);
    try {
      await salvarCondicao(paraConta);
      onSalvo();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    Alert.alert('Excluir forma de pagamento', 'Ela deixa de aparecer nos próximos orçamentos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await excluirCondicao(c.id!); onSalvo(); } catch (e: any) { Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.'); }
      } },
    ]);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: espaco.xl, gap: 6 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo}>{c.id ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}</Text>
          <Text style={styles.rotulo}>Nome (como aparece no orçamento)</Text>
          <TextInput style={styles.input} value={c.nome} onChangeText={(nome) => mudar({ nome })} placeholder="Ex: Cartão em até 10x" placeholderTextColor="#93A3A5" />

          <Text style={styles.rotulo}>Tipo</Text>
          <View style={styles.chips}>
            {TIPOS_CONDICAO.map((t) => (
              <Pressable key={t.valor} onPress={() => mudar({ tipo: t.valor as TipoCondicao })} style={[styles.chip, c.tipo === t.valor && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, c.tipo === t.valor && { color: '#FFFFFF' }]}>{t.rotulo}</Text>
              </Pressable>
            ))}
          </View>

          {c.tipo === 'avista' ? (
            <>
              <Text style={styles.rotulo}>Desconto à vista (%)</Text>
              <TextInput style={[styles.input, styles.curto]} value={c.desconto_percentual} onChangeText={(v) => mudar({ desconto_percentual: pct(v) })} keyboardType="decimal-pad" />
            </>
          ) : (
            <>
              {c.tipo === 'entrada' && (
                <>
                  <Text style={styles.rotulo}>Entrada (% do total)</Text>
                  <TextInput style={[styles.input, styles.curto]} value={c.entrada_percentual} onChangeText={(v) => mudar({ entrada_percentual: pct(v) })} keyboardType="decimal-pad" />
                </>
              )}
              <Text style={styles.rotulo}>{c.tipo === 'entrada' ? 'Restante em até quantas parcelas' : 'Até quantas parcelas'}</Text>
              <TextInput
                style={[styles.input, styles.curto]}
                value={String(c.max_parcelas || '')}
                onChangeText={(v) => mudar({ max_parcelas: Math.min(60, parseInt(v.replace(/\D/g, ''), 10) || 0) })}
                keyboardType="number-pad"
              />
              <Text style={styles.rotulo}>Acréscimo (%), por exemplo a taxa do cartão</Text>
              <TextInput style={[styles.input, styles.curto]} value={c.acrescimo_percentual} onChangeText={(v) => mudar({ acrescimo_percentual: pct(v) })} keyboardType="decimal-pad" />
            </>
          )}

          <View style={styles.previa}>
            <Text style={styles.previaTexto}>Em um orçamento de {reais(EXEMPLO)}: {textoCondicao({ ...paraConta, max_parcelas: c.max_parcelas || 1 }, EXEMPLO)}</Text>
          </View>

          <View style={styles.acoes}>
            <Pressable style={styles.cancelar} onPress={onFechar}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
            </Pressable>
          </View>
          {!!c.id && (
            <Pressable style={{ alignItems: 'center', paddingTop: 14 }} onPress={excluir}>
              <Text style={{ color: cor.erro, fontSize: 15, fontWeight: '600' }}>Excluir</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center' },
  intro: { color: cor.textoSuave, fontSize: 14, lineHeight: 20 },
  lista: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  item: { padding: espaco.lg },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  nome: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  exemplo: { color: cor.textoSuave, fontSize: 13, marginTop: 2 },
  nova: { borderWidth: 1, borderColor: cor.borda, borderStyle: 'dashed', borderRadius: raio.campo, paddingVertical: 12, alignItems: 'center', backgroundColor: cor.cartao },
  novaTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  titulo: { color: cor.texto, fontSize: 20, fontWeight: '800', marginBottom: espaco.sm },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.cartao },
  curto: { width: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  previa: { backgroundColor: cor.marcaClara, borderRadius: raio.campo, padding: espaco.md, marginTop: espaco.md },
  previaTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 10, marginTop: espaco.lg },
  cancelar: { borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  cancelarTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  botao: { flex: 1, backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
