// src/components/produtos/EditorRegra.tsx
//
// Define quanto de um item o produto consome, em função da largura (L)
// e da altura (A). Mostra um exemplo ao vivo para o vidraceiro conferir.

import { useEffect, useState } from 'react';
import {
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

import { Componente, comoEVendido, modoDoItem, numero, reais } from '@/api/produtos';

import { COR } from './cores';

type Props = {
  componente: Componente | null;
  onSalvar: (c: Componente) => void;
  onRemover?: () => void;
  onFechar: () => void;
};

const MEDIDA_EXEMPLO = 1000; // mm
const DISCRETAS = new Set(['UN', 'PC', 'PÇ', 'PAR', 'CX', 'JG', 'KIT', 'CJ']);

function texto(n: number): string {
  return n === 0 ? '' : String(n).replace('.', ',');
}

export function EditorRegra({ componente, onSalvar, onRemover, onFechar }: Props) {
  const [coefL, setCoefL] = useState('');
  const [coefA, setCoefA] = useState('');
  const [coefArea, setCoefArea] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const item = componente?.item_detalhe;
  const modo = item ? modoDoItem(item) : 'unidade';
  // Para perfis e itens por metro, o ajuste é digitado em mm (mais natural
  // para o vidraceiro) e guardado em metros.
  const ajusteEmMm = modo === 'peca_comprimento' || modo === 'metro';

  useEffect(() => {
    if (!componente) return;
    setCoefL(texto(numero(componente.coef_largura)));
    setCoefA(texto(numero(componente.coef_altura)));
    setCoefArea(texto(numero(componente.coef_area)));
    const aj = numero(componente.ajuste);
    setAjuste(texto(ajusteEmMm ? Math.round(aj * 1000) : aj));
    setObservacao(componente.observacao);
    setErro(null);
  }, [componente, ajusteEmMm]);

  if (!componente || !item) return null;

  const ajusteReal = ajusteEmMm ? numero(ajuste) / 1000 : numero(ajuste);
  const L = MEDIDA_EXEMPLO / 1000;
  const A = MEDIDA_EXEMPLO / 1000;
  let consumo = Math.max(0, numero(coefL) * L + numero(coefA) * A + numero(coefArea) * L * A + ajusteReal);
  // Mesma regra do servidor: só arredonda para cima o que é vendido em peças inteiras.
  if (modo === 'unidade' && DISCRETAS.has(item.unidade)) consumo = Math.ceil(consumo - 1e-9);
  const pecas = modo === 'peca_comprimento' ? consumo / ((item.comprimento_mm ?? 1) / 1000) : null;
  const custo = (pecas ?? consumo) * numero(item.preco);
  const unidadeConsumo = modo === 'area' ? 'm²' : modo === 'unidade' ? 'un' : 'm';

  function salvar() {
    if ([coefL, coefA, coefArea, ajuste].every((v) => numero(v) === 0)) {
      setErro('Preencha pelo menos um campo da regra.');
      return;
    }
    onSalvar({
      ...componente!,
      coef_largura: String(numero(coefL)),
      coef_altura: String(numero(coefA)),
      coef_area: String(numero(coefArea)),
      ajuste: String(Number(ajusteReal.toFixed(4))),
      observacao: observacao.trim(),
    });
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={styles.codigo}>{item.codigo}</Text>
          <Text style={styles.titulo}>{item.descricao}</Text>
          <Text style={styles.sub}>
            {reais(item.preco)} {comoEVendido(item)}
          </Text>

          <Text style={styles.secao}>Quanto este produto consome</Text>
          <Text style={styles.ajuda}>
            {modo === 'unidade'
              ? 'Para acessórios, normalmente basta a quantidade fixa (ex: 4 roldanas).'
              : modo === 'area'
                ? 'Para vidros, use "vezes a área": 1 significa uma chapa do tamanho do vão.'
                : 'Em metros. Ex: um batente usa 2 vezes a largura e 2 vezes a altura.'}
          </Text>

          <View style={styles.linha}>
            <CampoNumero rotulo="Vezes a largura" valor={coefL} onMudar={setCoefL} />
            <CampoNumero rotulo="Vezes a altura" valor={coefA} onMudar={setCoefA} />
          </View>
          {(modo === 'area' || numero(coefArea) !== 0) && (
            <CampoNumero rotulo="Vezes a área (L × A)" valor={coefArea} onMudar={setCoefArea} />
          )}
          <CampoNumero
            rotulo={
              modo === 'unidade'
                ? 'Quantidade fixa'
                : ajusteEmMm
                  ? 'Ajuste em mm (negativo desconta)'
                  : 'Ajuste em m²'
            }
            valor={ajuste}
            onMudar={setAjuste}
            permiteNegativo
          />

          <Text style={styles.rotulo}>Observação</Text>
          <TextInput
            style={styles.input}
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Opcional. Ex: folha móvel"
            placeholderTextColor={COR.tintaSuave}
            maxLength={100}
          />

          <View style={styles.exemplo}>
            <Text style={styles.exemploTitulo}>
              Numa medida de {MEDIDA_EXEMPLO} × {MEDIDA_EXEMPLO} mm
            </Text>
            <Text style={styles.exemploValor}>
              {consumo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidadeConsumo}
              {pecas !== null &&
                ` (${pecas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} de peça)`}
            </Text>
            <Text style={styles.exemploCusto}>{reais(custo)} de material</Text>
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Pressable style={styles.botao} onPress={salvar} accessibilityRole="button">
            <Text style={styles.botaoTexto}>Confirmar</Text>
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={onFechar} accessibilityRole="button">
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
          {onRemover && (
            <Pressable style={styles.botaoSecundario} onPress={onRemover} accessibilityRole="button">
              <Text style={[styles.botaoSecundarioTexto, { color: COR.erro }]}>Remover do produto</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CampoNumero({
  rotulo,
  valor,
  onMudar,
  permiteNegativo = false,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  permiteNegativo?: boolean;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        style={styles.input}
        value={valor}
        onChangeText={(v) => onMudar(v.replace(permiteNegativo ? /[^0-9,.-]/g : /[^0-9,.]/g, ''))}
        keyboardType={permiteNegativo ? 'numbers-and-punctuation' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={COR.tintaSuave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 48 },
  codigo: { color: COR.tintaSuave, fontSize: 13, fontWeight: '600' },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700', marginTop: 2 },
  sub: { color: COR.tintaSuave, fontSize: 14, marginTop: 4 },
  secao: { color: COR.tinta, fontSize: 16, fontWeight: '700', marginTop: 24 },
  ajuda: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 12 },
  linha: { flexDirection: 'row', gap: 12 },
  campo: { flex: 1, marginBottom: 12 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie,
    borderWidth: 1,
    borderColor: COR.linha,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: COR.tinta,
  },
  exemplo: {
    backgroundColor: COR.bordaClara,
    borderLeftWidth: 3,
    borderLeftColor: COR.borda,
    padding: 14,
    marginTop: 20,
  },
  exemploTitulo: { color: COR.tintaSuave, fontSize: 13 },
  exemploValor: { color: COR.tinta, fontSize: 18, fontWeight: '700', marginTop: 4 },
  exemploCusto: { color: COR.tinta, fontSize: 14, marginTop: 2 },
  erro: { color: COR.erro, fontSize: 14, marginTop: 12 },
  botao: {
    backgroundColor: COR.borda,
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  botaoSecundario: { alignItems: 'center', paddingVertical: 14 },
  botaoSecundarioTexto: { color: COR.borda, fontSize: 15, fontWeight: '600' },
});
