// src/components/projetos/EditorPeca.tsx
//
// Uma peça do projeto: nome, medidas, quantidade e os itens copiados do
// modelo. Mudar um item aqui vale só para esta peça.

import { useEffect, useState } from 'react';
import {
  Alert,
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

import {
  Componente,
  ItemCatalogo,
  consumoPorPeca,
  custoPorPeca,
  metrosParaMm,
  mmParaMetros,
  modoDoItem,
  reais,
  numero,
  resumoRegra,
  unidadeConsumo,
} from '@/api/produtos';
import { Peca } from '@/api/projetos';
import { EditorRegra } from '@/components/produtos/EditorRegra';
import { SeletorItem } from '@/components/produtos/SeletorItem';
import { COR } from '@/components/produtos/cores';

// No iOS, um modal só abre depois que o anterior terminou de fechar.
const ESPERA_MODAL = Platform.OS === 'ios' ? 450 : 0;

type Props = {
  peca: Peca | null;
  nova: boolean;
  onSalvar: (p: Peca) => void;
  onRemover: () => void;
  onFechar: () => void;
};

type EdicaoItem = { indice: number | null; componente: Componente };

export function EditorPeca({ peca, nova, onSalvar, onRemover, onFechar }: Props) {
  const [nome, setNome] = useState('');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [itens, setItens] = useState<Componente[]>([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [edicao, setEdicao] = useState<EdicaoItem | null>(null);

  useEffect(() => {
    if (!peca) return;
    setNome(peca.nome);
    // As medidas são digitadas em metros ("1,20") e guardadas em mm (1200).
    setLargura(mmParaMetros(peca.largura_mm));
    setAltura(mmParaMetros(peca.altura_mm));
    setQuantidade(String(peca.quantidade || 1));
    setItens(peca.itens);
  }, [peca]);

  if (!peca) return null;

  const L = metrosParaMm(largura);
  const A = metrosParaMm(altura);
  const Q = parseInt(quantidade, 10) || 1;

  function faltaMedida(c: Componente): boolean {
    const usaL = numero(c.coef_largura) !== 0 || numero(c.coef_area) !== 0;
    const usaA = numero(c.coef_altura) !== 0 || numero(c.coef_area) !== 0;
    return (usaL && !L) || (usaA && !A);
  }

  // Custo do consumo de UMA peça (null se falta medida em algum item).
  const custoDaPeca = itens.some(faltaMedida) ? null : itens.reduce((t, c) => t + custoPorPeca(c, L, A), 0);

  /** "8 m no total" (ou vazio, se falta a medida que o item usa). */
  function totalDoItem(c: Componente): string {
    const usaL = numero(c.coef_largura) !== 0 || numero(c.coef_area) !== 0;
    const usaA = numero(c.coef_altura) !== 0 || numero(c.coef_area) !== 0;
    if ((usaL && !L) || (usaA && !A)) return 'falta medida';
    const total = consumoPorPeca(c, L, A) * Q;
    return `${total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidadeConsumo(c.item_detalhe)}`;
  }

  function itemEscolhido(item: ItemCatalogo) {
    setSeletorAberto(false);
    const componente: Componente = {
      item: item.id,
      item_detalhe: item,
      coef_largura: '0',
      coef_altura: '0',
      // Vidro começa como "1 vez a área"; o resto, como quantidade fixa a preencher.
      coef_area: modoDoItem(item) === 'area' ? '1' : '0',
      ajuste: '0',
      observacao: '',
    };
    setTimeout(() => setEdicao({ indice: null, componente }), ESPERA_MODAL);
  }

  function regraConfirmada(c: Componente) {
    setItens((lista) => {
      const atualizada = [...lista];
      if (edicao?.indice === null || edicao?.indice === undefined) atualizada.push(c);
      else atualizada[edicao.indice] = c;
      return atualizada;
    });
    setEdicao(null);
  }

  function removerItem() {
    if (edicao?.indice === null || edicao?.indice === undefined) return;
    const i = edicao.indice;
    setItens((lista) => lista.filter((_, j) => j !== i));
    setEdicao(null);
  }

  function confirmar() {
    const L = metrosParaMm(largura);
    const A = metrosParaMm(altura);
    const Q = parseInt(quantidade, 10);
    if (!nome.trim()) return Alert.alert('Falta o nome', 'Ex: Janela da sala.');
    if (!Q || Q < 1) return Alert.alert('Quantidade', 'A quantidade precisa ser pelo menos 1.');
    if (!itens.length) return Alert.alert('Nenhum item', 'A peça precisa ter pelo menos um item.');

    // As medidas são opcionais, mas não quando algum item depende delas:
    // sem isso, o custo sairia errado sem ninguém perceber.
    const usaLargura = itens.find((c) => numero(c.coef_largura) !== 0 || numero(c.coef_area) !== 0);
    const usaAltura = itens.find((c) => numero(c.coef_altura) !== 0 || numero(c.coef_area) !== 0);
    if (usaLargura && !L) {
      return Alert.alert('Falta a largura', `O item "${usaLargura.item_detalhe.descricao}" usa a largura no cálculo.`);
    }
    if (usaAltura && !A) {
      return Alert.alert('Falta a altura', `O item "${usaAltura.item_detalhe.descricao}" usa a altura no cálculo.`);
    }
    onSalvar({ ...peca!, nome: nome.trim(), largura_mm: L, altura_mm: A, quantidade: Q, itens });
  }

  function confirmarRemocao() {
    Alert.alert('Remover peça', `Remover "${nome}" do projeto?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: onRemover },
    ]);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <View style={styles.topo}>
            <Text style={styles.titulo}>{nova ? 'Nova peça' : 'Editar peça'}</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>

          <Text style={styles.rotulo}>Nome</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Janela da sala"
            placeholderTextColor={COR.tintaSuave}
          />

          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rotulo}>Largura (m)</Text>
              <TextInput
                style={styles.input}
                value={largura}
                onChangeText={(v) => setLargura(v.replace(/[^0-9,.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="opcional"
                placeholderTextColor={COR.tintaSuave}
                autoFocus={nova && itens.length > 0}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rotulo}>Altura (m)</Text>
              <TextInput
                style={styles.input}
                value={altura}
                onChangeText={(v) => setAltura(v.replace(/[^0-9,.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="opcional"
                placeholderTextColor={COR.tintaSuave}
              />
            </View>
            <View style={{ width: 80 }}>
              <Text style={styles.rotulo}>Qtd.</Text>
              <TextInput
                style={styles.input}
                value={quantidade}
                onChangeText={(v) => setQuantidade(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.secao}>Itens desta peça</Text>
          <Text style={styles.ajuda}>
            {peca.produto
              ? 'Vieram do modelo. Mudanças aqui valem só para esta peça.'
              : 'Escolha no catálogo os itens desta peça.'}
          </Text>
          <View style={styles.caixa}>
            {itens.map((c, i) => (
              <View key={`${c.item}-${i}`}>
                {i > 0 && <View style={styles.divisor} />}
                <Pressable
                  onPress={() => setEdicao({ indice: i, componente: c })}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: COR.bordaClara }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNome}>{c.item_detalhe.descricao}</Text>
                    <Text style={styles.itemDetalhe}>
                      {c.item_detalhe.codigo}
                      {c.observacao ? ` · ${c.observacao}` : ''}
                      {!c.item_detalhe.ativo ? ' · saiu de linha' : ''}
                    </Text>
                    <Text style={styles.regra}>{resumoRegra(c)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.total}>{totalDoItem(c)}</Text>
                    {!faltaMedida(c) && <Text style={styles.custoItem}>{reais(custoPorPeca(c, L, A) * Q)}</Text>}
                  </View>
                </Pressable>
              </View>
            ))}
            {itens.length > 0 && <View style={styles.divisor} />}
            <Pressable
              onPress={() => setSeletorAberto(true)}
              style={({ pressed }) => [styles.adicionar, pressed && { backgroundColor: COR.bordaClara }]}
            >
              <Text style={styles.link}>+ Adicionar item</Text>
            </Pressable>
          </View>

          {itens.length > 0 && (
            <View style={styles.custo}>
              {custoDaPeca === null ? (
                <Text style={styles.custoTexto}>Informe as medidas para ver o custo dos itens.</Text>
              ) : (
                <>
                  <View style={styles.custoLinha}>
                    <Text style={styles.custoTexto}>Custo dos itens por peça</Text>
                    <Text style={styles.custoValor}>{reais(custoDaPeca)}</Text>
                  </View>
                  {Q > 1 && (
                    <View style={styles.custoLinha}>
                      <Text style={styles.custoTexto}>Total ({Q} peças)</Text>
                      <Text style={styles.custoTotal}>{reais(custoDaPeca * Q)}</Text>
                    </View>
                  )}
                  <Text style={styles.custoNota}>Pelo que é usado, não pelas barras compradas.</Text>
                </>
              )}
            </View>
          )}

          <Pressable style={styles.botao} onPress={confirmar}>
            <Text style={styles.botaoTexto}>{nova ? 'Adicionar ao projeto' : 'Confirmar'}</Text>
          </Pressable>
          {!nova && (
            <Pressable style={styles.remover} onPress={confirmarRemocao}>
              <Text style={styles.removerTexto}>Remover peça do projeto</Text>
            </Pressable>
          )}
        </ScrollView>

        <SeletorItem visivel={seletorAberto} onSelecionar={itemEscolhido} onFechar={() => setSeletorAberto(false)} />
        <EditorRegra
          componente={edicao?.componente ?? null}
          contexto={{ largura_mm: L, altura_mm: A, quantidade: Q }}
          onSalvar={regraConfirmada}
          onRemover={edicao && edicao.indice !== null ? removerItem : undefined}
          onFechar={() => setEdicao(null)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  link: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COR.tinta, marginBottom: 12,
  },
  linha: { flexDirection: 'row', gap: 10 },
  secao: { color: COR.tinta, fontSize: 17, fontWeight: '700', marginTop: 12 },
  ajuda: { color: COR.tintaSuave, fontSize: 14, marginTop: 4, marginBottom: 10 },
  caixa: { backgroundColor: COR.superficie, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, overflow: 'hidden' },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 14 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  itemNome: { color: COR.tinta, fontSize: 15, fontWeight: '600' },
  itemDetalhe: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  regra: { color: COR.borda, fontSize: 13, fontWeight: '600', marginTop: 3 },
  total: { color: COR.tinta, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  custoItem: { color: COR.tintaSuave, fontSize: 13, marginTop: 2 },
  custo: { backgroundColor: COR.bordaClara, borderLeftWidth: 3, borderLeftColor: COR.borda, padding: 14, marginTop: 14 },
  custoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  custoTexto: { color: COR.tinta, fontSize: 14 },
  custoValor: { color: COR.tinta, fontSize: 16, fontWeight: '700' },
  custoTotal: { color: COR.tinta, fontSize: 18, fontWeight: '800' },
  custoNota: { color: COR.tintaSuave, fontSize: 12, marginTop: 6 },
  adicionar: { padding: 16, alignItems: 'center' },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  remover: { alignItems: 'center', paddingVertical: 16 },
  removerTexto: { color: COR.erro, fontSize: 15, fontWeight: '600' },
});
