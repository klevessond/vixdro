// src/app/(interno)/produtos/index.tsx  ->  rota /produtos
//
// Os modelos do vidraceiro em cartões, com o custo dos itens. Como o custo
// de uma janela depende do tamanho, ele aparece numa medida de referência
// (1,00 x 1,00 m); produtos só de quantidades fixas mostram o custo exato.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIAS, Categoria, Produto, listarProdutos, reais } from '@/api/produtos';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

const ROTULO = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.rotulo]));

const ICONE: Record<Categoria, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  janela: 'window-closed-variant',
  porta: 'door',
  portao: 'gate',
  box: 'shower',
  outro: 'shape-outline',
};

export default function ListaProdutos() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || (ROTULO[p.categoria] ?? '').toLowerCase().includes(termo)
    );
  }, [produtos, busca]);

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Produtos' }} />

      <View style={styles.topo}>
        <View style={styles.busca}>
          <MaterialCommunityIcons name="magnify" size={20} color={cor.textoSuave} />
          <TextInput
            style={styles.buscaInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar produto"
            placeholderTextColor="#93A3A5"
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.novo, pressed && { backgroundColor: cor.marcaEscura }]}
          onPress={() => router.push('/produtos/novo')}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={20} color={cor.textoSobreMarca} />
          <Text style={styles.novoTexto}>Novo</Text>
        </Pressable>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(p) => p.id!}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={erro ? <Text style={styles.erro}>{erro}</Text> : null}
          ListEmptyComponent={
            !erro ? (
              <View style={styles.vazio}>
                <MaterialCommunityIcons name="window-closed-variant" size={42} color={cor.textoSuave} />
                <Text style={styles.vazioTitulo}>{busca.trim() ? 'Nada encontrado' : 'Nenhum produto ainda'}</Text>
                <Text style={styles.vazioTexto}>
                  {busca.trim()
                    ? `Nenhum produto com "${busca.trim()}".`
                    : 'Monte seus modelos uma vez, como uma janela veneziana de 2 folhas, e use em todos os projetos.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: p }) => {
            const n = p.componentes.length;
            return (
              <Pressable
                onPress={() => router.push(`/produtos/${p.id}`)}
                style={({ pressed }) => [styles.cartao, pressed && { borderColor: cor.marca }]}
              >
                <View style={styles.icone}>
                  <MaterialCommunityIcons name={ICONE[p.categoria] ?? 'shape-outline'} size={30} color={cor.marca} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome} numberOfLines={2}>{p.nome}</Text>
                  <Text style={styles.detalhe}>
                    {ROTULO[p.categoria]} · {n} {n === 1 ? 'item' : 'itens'}
                  </Text>
                  {p.padrao && (
                    <View style={styles.etiqueta}>
                      <MaterialCommunityIcons name="star-four-points-outline" size={12} color={cor.marca} />
                      <Text style={styles.etiquetaTexto}>Modelo pronto</Text>
                    </View>
                  )}
                </View>
                {p.custo_referencia !== undefined && (
                  <View style={styles.custo}>
                    <Text style={styles.custoValor}>{reais(p.custo_referencia)}</Text>
                    <Text style={styles.custoRotulo}>{p.custo_depende_medida ? 'custo em 1 × 1 m' : 'custo'}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: {
    flexDirection: 'row', gap: espaco.sm, padding: espaco.lg, paddingBottom: espaco.sm,
    width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center',
  },
  busca: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cor.cartao,
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12,
  },
  buscaInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: cor.texto },
  novo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cor.marca,
    borderRadius: raio.botao, paddingHorizontal: 14,
  },
  novoTexto: { color: cor.textoSobreMarca, fontSize: 15, fontWeight: '700' },
  lista: { padding: espaco.lg, paddingTop: espaco.sm, gap: espaco.md, flexGrow: 1, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center' },
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: cor.cartao,
    borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, padding: espaco.lg, ...sombra,
  },
  icone: {
    width: 54, height: 54, borderRadius: raio.icone, backgroundColor: cor.marcaClara,
    alignItems: 'center', justifyContent: 'center',
  },
  nome: { color: cor.texto, fontSize: 17, fontWeight: '800' },
  detalhe: { color: cor.textoSuave, fontSize: 13, marginTop: 3 },
  custo: { alignItems: 'flex-end' },
  etiqueta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: cor.marcaClara, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  etiquetaTexto: { color: cor.marca, fontSize: 12, fontWeight: '700' },
  custoValor: { color: cor.texto, fontSize: 17, fontWeight: '800' },
  custoRotulo: { color: cor.textoSuave, fontSize: 12, marginTop: 2 },
  erro: { color: cor.erro, fontSize: 14, marginBottom: espaco.sm },
  vazio: { padding: espaco.xxl, alignItems: 'center', gap: 6 },
  vazioTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  vazioTexto: { color: cor.textoSuave, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
