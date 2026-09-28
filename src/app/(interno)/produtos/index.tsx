// src/app/(interno)/produtos/index.tsx  ->  rota /produtos

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIAS, Produto, listarProdutos } from '@/api/produtos';
import { COR } from '@/components/produtos/cores';

const ROTULO = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.rotulo]));

export default function ListaProdutos() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega sempre que a tela volta a aparecer (ex: depois de salvar um produto).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setErro(null);
      listarProdutos()
        .then((lista) => ativo && setProdutos(lista))
        .catch((e) => ativo && setErro(e?.message ?? 'Sem conexão com o servidor.'))
        .finally(() => ativo && setCarregando(false));
      return () => {
        ativo = false;
      };
    }, [])
  );

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Produtos' }} />

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      ) : (
        <FlatList
          data={produtos}
          keyExtractor={(p) => p.id!}
          contentContainerStyle={styles.lista}
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListHeaderComponent={erro ? <Text style={styles.erro}>{erro}</Text> : null}
          ListEmptyComponent={
            !erro ? (
              <View style={styles.vazio}>
                <Text style={styles.vazioTitulo}>Nenhum produto ainda</Text>
                <Text style={styles.vazioTexto}>
                  Monte seus modelos uma vez, como uma janela veneziana de 2 folhas, e use em
                  todos os projetos. O custo é calculado pelos itens e pelas medidas.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => router.push(`/produtos/${p.id}`)}
              style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{p.nome}</Text>
                <Text style={styles.detalhe}>
                  {ROTULO[p.categoria]} · {p.componentes.length}{' '}
                  {p.componentes.length === 1 ? 'item' : 'itens'}
                </Text>
              </View>
              <Text style={styles.seta}>›</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.rodape}>
        <Pressable
          style={({ pressed }) => [styles.botao, pressed && { backgroundColor: COR.bordaEscura }]}
          onPress={() => router.push('/produtos/novo')}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Novo produto</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  lista: { paddingVertical: 8, flexGrow: 1 },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COR.superficie,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nome: { color: COR.tinta, fontSize: 17, fontWeight: '700' },
  detalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  seta: { color: COR.borda, fontSize: 28, fontWeight: '300' },
  erro: { color: COR.erro, fontSize: 14, padding: 20 },
  vazio: { padding: 32, alignItems: 'center' },
  vazioTitulo: { color: COR.tinta, fontSize: 18, fontWeight: '700' },
  vazioTexto: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  rodape: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: COR.linha, backgroundColor: COR.fundo },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
