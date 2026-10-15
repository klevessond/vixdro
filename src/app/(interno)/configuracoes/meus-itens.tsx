// src/app/(interno)/configuracoes/meus-itens.tsx  ->  rota /configuracoes/meus-itens
//
// Itens que o vidraceiro cadastrou fora do catálogo do fornecedor (vidros,
// por exemplo). Aqui ele atualiza os preços quando mudarem.

import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemCatalogo, comoEVendido, excluirMeuItem, listarMeusItens, reais } from '@/api/produtos';
import { COR } from '@/components/produtos/cores';
import { EditorItemProprio } from '@/components/produtos/EditorItemProprio';

export default function MeusItens() {
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<ItemCatalogo | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const carregar = useCallback(() => {
    listarMeusItens()
      .then(setItens)
      .catch((e) => Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.'))
      .finally(() => setCarregando(false));
  }, []);

  useFocusEffect(carregar);

  function abrir(item: ItemCatalogo | null) {
    setEditando(item);
    setFormAberto(true);
  }

  function excluir(item: ItemCatalogo) {
    Alert.alert('Excluir item', `Excluir "${item.descricao}"? Produtos e projetos que já usam o item não são afetados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirMeuItem(item.id);
            setFormAberto(false);
            carregar();
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Meus itens' }} />
      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListEmptyComponent={
            <View style={styles.vazio}>
              <Text style={styles.vazioTitulo}>Nenhum item próprio</Text>
              <Text style={styles.vazioTexto}>
                Cadastre aqui o que não está no catálogo do fornecedor, como vidros e espelhos.
                Só você vê estes itens.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => abrir(item)}
              onLongPress={() => excluir(item)}
              style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.descricao}</Text>
                <Text style={styles.detalhe}>{item.codigo} · {comoEVendido(item)}</Text>
              </View>
              <Text style={styles.preco}>{reais(item.preco)}</Text>
            </Pressable>
          )}
        />
      )}
      {itens.length > 0 && <Text style={styles.dica}>Toque para editar. Toque e segure para excluir.</Text>}
      <View style={styles.rodape}>
        <Pressable style={styles.botao} onPress={() => abrir(null)}>
          <Text style={styles.botaoTexto}>Novo item</Text>
        </Pressable>
      </View>
      <EditorItemProprio
        visivel={formAberto}
        item={editando}
        onSalvo={() => {
          setFormAberto(false);
          carregar();
        }}
        onFechar={() => setFormAberto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.superficie, paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  nome: { color: COR.tinta, fontSize: 16, fontWeight: '700' },
  detalhe: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  preco: { color: COR.tinta, fontSize: 15, fontWeight: '700' },
  vazio: { padding: 32, alignItems: 'center' },
  vazioTitulo: { color: COR.tinta, fontSize: 18, fontWeight: '700' },
  vazioTexto: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  dica: { color: COR.tintaSuave, fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  rodape: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: COR.linha, backgroundColor: COR.fundo },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
