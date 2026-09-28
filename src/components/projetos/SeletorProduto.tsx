// src/components/projetos/SeletorProduto.tsx
//
// Escolhe o modelo (produto) que vai virar uma peça do projeto.

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIAS, Produto, listarProdutos } from '@/api/produtos';
import { COR } from '@/components/produtos/cores';

const ROTULO = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.rotulo]));

type Props = { visivel: boolean; onSelecionar: (p: Produto) => void; onFechar: () => void };

export function SeletorProduto({ visivel, onSelecionar, onFechar }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    setCarregando(true);
    setErro(null);
    listarProdutos()
      .then(setProdutos)
      .catch((e) => setErro(e?.message ?? 'Sem conexão com o servidor.'))
      .finally(() => setCarregando(false));
  }, [visivel]);

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={styles.tela}>
        <View style={styles.topo}>
          <Text style={styles.titulo}>Qual produto?</Text>
          <Pressable onPress={onFechar} hitSlop={10}>
            <Text style={styles.link}>Fechar</Text>
          </Pressable>
        </View>
        {carregando && <ActivityIndicator style={{ marginTop: 24 }} color={COR.borda} />}
        {erro && <Text style={styles.erro}>{erro}</Text>}
        <FlatList
          data={produtos}
          keyExtractor={(p) => p.id!}
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListEmptyComponent={
            !carregando && !erro ? (
              <Text style={styles.vazio}>Nenhum produto montado ainda. Crie seus modelos em Produtos, na tela inicial.</Text>
            ) : null
          }
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => onSelecionar(p)}
              style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
            >
              <Text style={styles.nome}>{p.nome}</Text>
              <Text style={styles.detalhe}>
                {ROTULO[p.categoria]} · {p.componentes.length} {p.componentes.length === 1 ? 'item' : 'itens'}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, paddingTop: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  link: { color: COR.borda, fontSize: 16, fontWeight: '600' },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: { paddingHorizontal: 20, paddingVertical: 14 },
  nome: { color: COR.tinta, fontSize: 16, fontWeight: '600' },
  detalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  erro: { color: COR.erro, fontSize: 14, margin: 20 },
  vazio: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, textAlign: 'center', margin: 32 },
});
