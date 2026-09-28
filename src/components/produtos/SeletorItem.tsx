// src/components/produtos/SeletorItem.tsx
//
// Busca no catálogo do fornecedor (cópia que o servidor do vixdro mantém).
// Pesquisa por código ou por parte da descrição, ex: "TG073" ou "trilho branco".

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Fornecedor,
  ItemCatalogo,
  buscarItens,
  comoEVendido,
  listarFornecedores,
  numero,
  reais,
} from '@/api/produtos';

import { COR } from './cores';

type Props = {
  visivel: boolean;
  onSelecionar: (item: ItemCatalogo) => void;
  onFechar: () => void;
};

export function SeletorItem({ visivel, onSelecionar, onFechar }: Props) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedor, setFornecedor] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaBusca = useRef(0);

  useEffect(() => {
    if (!visivel || fornecedores.length) return;
    listarFornecedores()
      .then((lista) => {
        setFornecedores(lista);
        if (lista.length) setFornecedor(lista[0].id);
      })
      .catch((e) => setErro(e.message ?? 'Sem conexão com o servidor.'));
  }, [visivel, fornecedores.length]);

  // Espera o vidraceiro parar de digitar antes de buscar.
  useEffect(() => {
    if (!visivel || fornecedor === null) return;
    const id = ++ultimaBusca.current;
    const timer = setTimeout(async () => {
      setCarregando(true);
      setErro(null);
      try {
        const resultado = await buscarItens(fornecedor, busca);
        if (id === ultimaBusca.current) setItens(resultado); // ignora respostas atrasadas
      } catch (e: any) {
        if (id === ultimaBusca.current) setErro(e?.message ?? 'Sem conexão com o servidor.');
      } finally {
        if (id === ultimaBusca.current) setCarregando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [busca, fornecedor, visivel]);

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={styles.tela}>
        <View style={styles.topo}>
          <Text style={styles.titulo}>Adicionar item</Text>
          <Pressable onPress={onFechar} hitSlop={10} accessibilityRole="button">
            <Text style={styles.fechar}>Fechar</Text>
          </Pressable>
        </View>

        {fornecedores.length > 1 && (
          <View style={styles.fornecedores}>
            {fornecedores.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFornecedor(f.id)}
                style={[styles.chip, f.id === fornecedor && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, f.id === fornecedor && styles.chipTextoAtivo]}>{f.nome}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Código ou descrição (ex: trilho branco)"
          placeholderTextColor={COR.tintaSuave}
          autoCorrect={false}
          autoFocus
          clearButtonMode="while-editing"
        />

        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && <ActivityIndicator style={{ marginTop: 16 }} color={COR.borda} />}

        <FlatList
          data={itens}
          keyExtractor={(i) => String(i.id)}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListEmptyComponent={
            !carregando && !erro ? (
              <Text style={styles.vazio}>
                {busca.trim() ? 'Nenhum item encontrado.' : 'Digite para buscar no catálogo.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const semEstoque = item.estoque !== null && numero(item.estoque) <= 0;
            return (
              <Pressable
                onPress={() => onSelecionar(item)}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: COR.bordaClara }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDescricao}>{item.descricao}</Text>
                  <Text style={styles.itemCodigo}>
                    {item.codigo} · {comoEVendido(item)}
                    {semEstoque ? ' · sem estoque' : ''}
                  </Text>
                </View>
                <Text style={styles.itemPreco}>{reais(item.preco)}</Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, paddingTop: 20 },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  fechar: { color: COR.borda, fontSize: 16, fontWeight: '600' },
  fornecedores: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: COR.linha, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipAtivo: { backgroundColor: COR.borda, borderColor: COR.borda },
  chipTexto: { color: COR.tinta, fontSize: 14 },
  chipTextoAtivo: { color: '#FFFFFF', fontWeight: '600' },
  busca: {
    marginHorizontal: 20,
    backgroundColor: COR.superficie,
    borderWidth: 1,
    borderColor: COR.linha,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COR.tinta,
    marginBottom: 8,
  },
  erro: { color: COR.erro, fontSize: 14, marginHorizontal: 20, marginTop: 8 },
  vazio: { color: COR.tintaSuave, fontSize: 15, textAlign: 'center', marginTop: 32 },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  itemDescricao: { color: COR.tinta, fontSize: 15, fontWeight: '600' },
  itemCodigo: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  itemPreco: { color: COR.tinta, fontSize: 15, fontWeight: '600' },
});
