// src/app/(interno)/estoque/index.tsx  ->  rota /estoque
//
// Estoque de materiais (plano Pro): saldo de cada item, valor do estoque e
// os itens abaixo do mínimo. Toque num item para ver o histórico e ajustar.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ItemEstoque, listarEstoque } from '@/api/estoque';
import { TIPOS_ITEM, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { SeletorItem } from '@/components/produtos/SeletorItem';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

export default function TelaEstoque() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Estoque' }} />
      <SomentePro recurso="O estoque" descricao="Saldo dos materiais, pedidos recebidos e baixa automática conforme as peças ficam prontas.">
        <Estoque />
      </SomentePro>
    </View>
  );
}

function Estoque() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [valor, setValor] = useState('0');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [abaixo, setAbaixo] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);

  const carregar = useCallback(() => {
    listarEstoque({ busca: busca.trim(), tipo, abaixo })
      .then((r) => {
        setItens(r.itens);
        setValor(r.valor_total);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, tipo, abaixo]);

  useFocusEffect(carregar);
  useEffect(() => {
    const t = setTimeout(carregar, 350);
    return () => clearTimeout(t);
  }, [busca, tipo, abaixo]);

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <View style={styles.total}>
        <Text style={styles.totalRotulo}>Valor do estoque</Text>
        <Text style={styles.totalValor}>{reais(valor)}</Text>
        <Text style={styles.totalNota}>Pelo custo médio das entradas.</Text>
      </View>

      <View style={styles.topo}>
        <View style={styles.busca}>
          <MaterialCommunityIcons name="magnify" size={20} color={cor.textoSuave} />
          <TextInput style={styles.buscaInput} value={busca} onChangeText={setBusca} placeholder="Código ou descrição" placeholderTextColor="#93A3A5" />
        </View>
        <Pressable style={styles.novo} onPress={() => setEscolhendo(true)}>
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.novoTexto}>Item</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setAbaixo((v) => !v)} style={[styles.chip, abaixo && styles.chipAlerta]}>
          <Text style={[styles.chipTexto, abaixo && { color: '#FFFFFF' }]}>Abaixo do mínimo</Text>
        </Pressable>
        {TIPOS_ITEM.map((t) => (
          <Pressable key={t.valor || 'todos'} onPress={() => setTipo(t.valor)} style={[styles.chip, tipo === t.valor && styles.chipAtivo]}>
            <Text style={[styles.chipTexto, tipo === t.valor && { color: '#FFFFFF' }]}>{t.rotulo}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {carregando ? (
        <ActivityIndicator color={cor.marca} />
      ) : itens.length === 0 ? (
        <View style={styles.vazio}>
          <MaterialCommunityIcons name="package-variant" size={42} color={cor.textoSuave} />
          <Text style={styles.vazioTitulo}>{busca || tipo || abaixo ? 'Nada encontrado' : 'Estoque vazio'}</Text>
          <Text style={styles.vazioTexto}>
            Toque em "+ Item", escolha um material e informe quanto você tem (contagem). Os pedidos recebidos e as peças
            concluídas atualizam o saldo sozinhos.
          </Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {itens.map((x, i) => (
            <Pressable key={x.item} onPress={() => router.push(`/estoque/${x.item}`)} style={({ pressed }) => [styles.item, i > 0 && styles.divisor, pressed && { backgroundColor: cor.marcaClara }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.descricao} numberOfLines={2}>{x.descricao}</Text>
                <Text style={styles.detalhe}>{x.proprio ? 'Item próprio' : x.codigo}{x.minimo ? ` · mínimo ${x.minimo.replace('.', ',')} ${x.unidade}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.saldo, x.abaixo_minimo && { color: cor.alerta }, Number(x.saldo) < 0 && { color: cor.erro }]}>{x.saldo_texto}</Text>
                {x.abaixo_minimo && <Text style={styles.alerta}>abaixo do mínimo</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <SeletorItem
        visivel={escolhendo}
        onSelecionar={(item) => {
          setEscolhendo(false);
          router.push(`/estoque/${item.id}`);
        }}
        onFechar={() => setEscolhendo(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  total: { backgroundColor: cor.marca, borderRadius: raio.cartao, padding: espaco.lg },
  totalRotulo: { color: cor.textoSobreMarcaSuave, fontSize: 13, fontWeight: '700' },
  totalValor: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  totalNota: { color: cor.textoSobreMarcaSuave, fontSize: 12 },
  topo: { flexDirection: 'row', gap: espaco.sm },
  busca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cor.cartao, borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12 },
  buscaInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: cor.texto },
  novo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cor.marca, borderRadius: raio.botao, paddingHorizontal: 14 },
  novoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipAlerta: { backgroundColor: cor.alerta, borderColor: cor.alerta },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  lista: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: espaco.lg },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  descricao: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  detalhe: { color: cor.textoSuave, fontSize: 12, marginTop: 2 },
  saldo: { color: cor.texto, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  alerta: { color: cor.alerta, fontSize: 11, fontWeight: '700' },
  vazio: { alignItems: 'center', padding: espaco.xxl, gap: 6 },
  vazioTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  vazioTexto: { color: cor.textoSuave, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
