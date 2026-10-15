// src/components/produtos/EditorItemProprio.tsx
//
// Cadastro de um item que não está no catálogo do fornecedor (vidros,
// por exemplo). Só o vidraceiro que cadastrou enxerga o item, e ele não
// entra no pedido ao fornecedor: é comprado em outro lugar.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ItemCatalogo, NovoItemProprio, salvarMeuItem } from '@/api/produtos';

import { COR } from './cores';

type Tipo = 'm2' | 'metro' | 'barra' | 'unidade';

const TIPOS: { valor: Tipo; rotulo: string; exemplo: string }[] = [
  { valor: 'm2', rotulo: 'Por m²', exemplo: 'Vidros, espelhos' },
  { valor: 'metro', rotulo: 'Por metro', exemplo: 'Borracha, escova vendida a metro' },
  { valor: 'barra', rotulo: 'Por barra', exemplo: 'Perfil de outro fornecedor' },
  { valor: 'unidade', rotulo: 'Por unidade', exemplo: 'Puxador, fechadura, silicone' },
];

function tipoDoItem(i: ItemCatalogo): Tipo {
  if (i.unidade === 'M2') return 'm2';
  if (i.unidade === 'M') return 'metro';
  return i.comprimento_mm ? 'barra' : 'unidade';
}

type Props = {
  visivel: boolean;
  item?: ItemCatalogo | null; // preenchido = edição
  nomeInicial?: string;
  onSalvo: (item: ItemCatalogo) => void;
  onFechar: () => void;
};

export function EditorItemProprio({ visivel, item, nomeInicial = '', onSalvo, onFechar }: Props) {
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<Tipo>('m2');
  const [comprimento, setComprimento] = useState('6');
  const [preco, setPreco] = useState('');
  const [codigo, setCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    setErro(null);
    if (item) {
      setDescricao(item.descricao);
      setTipo(tipoDoItem(item));
      setComprimento(item.comprimento_mm ? String(item.comprimento_mm / 1000).replace('.', ',') : '6');
      setPreco(String(item.preco).replace('.', ','));
      setCodigo(item.codigo);
    } else {
      setDescricao(nomeInicial);
      setTipo('m2');
      setComprimento('6');
      setPreco('');
      setCodigo('');
    }
  }, [visivel, item]);

  async function salvar() {
    const valor = parseFloat(preco.replace(',', '.'));
    const metros = parseFloat(comprimento.replace(',', '.'));
    if (!descricao.trim()) return setErro('Dê um nome ao item. Ex: Vidro temperado 8 mm incolor.');
    if (!Number.isFinite(valor) || valor < 0) return setErro('Informe o preço.');
    if (tipo === 'barra' && !(metros > 0)) return setErro('Informe o comprimento da barra, em metros.');

    const dados: NovoItemProprio = {
      id: item?.id,
      codigo: codigo.trim(),
      descricao: descricao.trim(),
      unidade: tipo === 'm2' ? 'M2' : tipo === 'metro' ? 'M' : 'UN',
      comprimento_mm: tipo === 'barra' ? Math.round(metros * 1000) : null,
      preco: String(valor),
    };
    setSalvando(true);
    setErro(null);
    try {
      onSalvo(await salvarMeuItem(dados));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const rotuloPreco =
    tipo === 'm2' ? 'Preço do m² (R$)' : tipo === 'metro' ? 'Preço do metro (R$)' : tipo === 'barra' ? 'Preço da barra (R$)' : 'Preço da unidade (R$)';

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <View style={styles.topo}>
            <Text style={styles.titulo}>{item ? 'Editar item' : 'Novo item próprio'}</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>
          <Text style={styles.ajuda}>
            Para o que não está no catálogo do fornecedor. Só você vê este item, e ele não vai
            no pedido ao fornecedor.
          </Text>

          <Text style={styles.rotulo}>Nome</Text>
          <TextInput
            style={styles.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Vidro temperado 8 mm incolor"
            placeholderTextColor={COR.tintaSuave}
            autoFocus={!item}
          />

          <Text style={styles.rotulo}>Como você compra este item?</Text>
          {TIPOS.map((t) => (
            <Pressable
              key={t.valor}
              onPress={() => setTipo(t.valor)}
              style={[styles.opcao, tipo === t.valor && styles.opcaoAtiva]}
            >
              <Text style={[styles.opcaoTitulo, tipo === t.valor && { color: COR.borda }]}>{t.rotulo}</Text>
              <Text style={styles.opcaoExemplo}>{t.exemplo}</Text>
            </Pressable>
          ))}

          {tipo === 'barra' && (
            <>
              <Text style={[styles.rotulo, { marginTop: 8 }]}>Comprimento da barra (metros)</Text>
              <TextInput
                style={styles.input}
                value={comprimento}
                onChangeText={(v) => setComprimento(v.replace(/[^0-9,.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="6"
                placeholderTextColor={COR.tintaSuave}
              />
            </>
          )}

          <Text style={[styles.rotulo, { marginTop: 8 }]}>{rotuloPreco}</Text>
          <TextInput
            style={styles.input}
            value={preco}
            onChangeText={(v) => setPreco(v.replace(/[^0-9,.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={COR.tintaSuave}
          />

          <Text style={styles.rotulo}>Código (opcional)</Text>
          <TextInput
            style={styles.input}
            value={codigo}
            onChangeText={setCodigo}
            placeholder="Deixe vazio para gerar automaticamente"
            placeholderTextColor={COR.tintaSuave}
            autoCapitalize="characters"
          />

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Pressable style={styles.botao} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar item</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  link: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  ajuda: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COR.tinta, marginBottom: 14,
  },
  opcao: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 8,
    padding: 12, marginBottom: 8,
  },
  opcaoAtiva: { borderColor: COR.borda, borderWidth: 2 },
  opcaoTitulo: { color: COR.tinta, fontSize: 15, fontWeight: '700' },
  opcaoExemplo: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  erro: { color: COR.erro, fontSize: 14, marginBottom: 10 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
