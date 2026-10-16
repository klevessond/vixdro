// src/components/produtos/EditorRegra.tsx
//
// Quanto de um item vai em cada peça. Duas formas, do jeito que o
// vidraceiro pensa:
//   - Quantidade fixa: "2 metros por peça", "4 unidades por peça".
//   - Pela medida: "2 vezes a largura" (o consumo acompanha o tamanho).
// Embaixo, a conta com os números reais: total usado, barras a comprar e
// o custo considerado (sempre pelo que é usado, não pela barra inteira).

import { useEffect, useState } from 'react';
import {
  Image,
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
  Cobranca,
  Componente,
  comoEVendido,
  consumoPorPeca,
  ehFixa,
  modoDoItem,
  numero,
  reais,
  unidadeConsumo,
} from '@/api/produtos';

import { COR } from './cores';

/** Medidas e quantidade da peça onde o item está (para a conta real). */
export type ContextoPeca = { largura_mm: number; altura_mm: number; quantidade: number };

type Props = {
  componente: Componente | null;
  contexto?: ContextoPeca;
  onSalvar: (c: Componente) => void;
  onRemover?: () => void;
  onFechar: () => void;
};

type Forma = 'fixa' | 'medida';

function fmt(n: number, casas = 2) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

function texto(n: number): string {
  return n === 0 ? '' : String(Number(n.toFixed(4))).replace('.', ',');
}

export function EditorRegra({ componente, contexto, onSalvar, onRemover, onFechar }: Props) {
  const [forma, setForma] = useState<Forma>('fixa');
  const [fixa, setFixa] = useState('');
  const [vezesL, setVezesL] = useState('');
  const [vezesA, setVezesA] = useState('');
  const [vezesArea, setVezesArea] = useState('');
  const [ajusteMm, setAjusteMm] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cobranca, setCobranca] = useState<Cobranca>('inteira');
  const [erro, setErro] = useState<string | null>(null);

  const item = componente?.item_detalhe;
  const modo = item ? modoDoItem(item) : 'unidade';
  const linear = modo === 'peca_comprimento' || modo === 'metro';

  useEffect(() => {
    if (!componente) return;
    const f = ehFixa(componente);
    setForma(f ? 'fixa' : 'medida');
    setFixa(f ? texto(numero(componente.ajuste)) : '');
    setVezesL(texto(numero(componente.coef_largura)));
    setVezesA(texto(numero(componente.coef_altura)));
    setVezesArea(texto(numero(componente.coef_area)));
    const aj = numero(componente.ajuste);
    setAjusteMm(f ? '' : texto(linear ? Math.round(aj * 1000) : aj));
    setObservacao(componente.observacao);
    setCobranca(componente.cobranca ?? 'inteira');
    setErro(null);
  }, [componente]);

  if (!componente || !item) return null;

  const un = unidadeConsumo(item);
  const nomeUnidade = un === 'm' ? 'metros' : un === 'm²' ? 'm²' : 'unidades';

  // Monta o componente com o que está digitado agora (para a conta e para salvar).
  function montar(): Componente {
    if (forma === 'fixa') {
      return {
        ...componente!, coef_largura: '0', coef_altura: '0', coef_area: '0', ajuste: String(numero(fixa)), cobranca,
      };
    }
    const aj = linear ? numero(ajusteMm) / 1000 : numero(ajusteMm);
    return {
      ...componente!,
      coef_largura: String(numero(vezesL)),
      coef_altura: String(numero(vezesA)),
      coef_area: String(numero(vezesArea)),
      ajuste: String(Number(aj.toFixed(4))),
      cobranca,
    };
  }

  function salvar() {
    if (forma === 'fixa' && numero(fixa) <= 0) {
      setErro(`Informe quantos ${nomeUnidade} vão em cada peça.`);
      return;
    }
    if (forma === 'medida' && [vezesL, vezesA, vezesArea].every((v) => numero(v) === 0)) {
      setErro('Informe quantas vezes a largura ou a altura este item usa.');
      return;
    }
    onSalvar({ ...montar(), observacao: observacao.trim() });
  }

  // ---- A conta, com os números da peça (ou um exemplo de 1 × 1 m) ----
  const ctx = contexto ?? { largura_mm: 1000, altura_mm: 1000, quantidade: 1 };
  const atual = montar();
  const usaL = numero(atual.coef_largura) !== 0 || numero(atual.coef_area) !== 0;
  const usaA = numero(atual.coef_altura) !== 0 || numero(atual.coef_area) !== 0;
  const faltaMedida = (usaL && !ctx.largura_mm) || (usaA && !ctx.altura_mm);
  const porPeca = consumoPorPeca(atual, ctx.largura_mm, ctx.altura_mm);
  const total = porPeca * ctx.quantidade;
  const comprimentoM = (item.comprimento_mm ?? 0) / 1000;
  const barras = modo === 'peca_comprimento' && comprimentoM ? Math.ceil(total / comprimentoM - 1e-9) : null;
  // Itens em barra: barras inteiras (padrão) ou só os metros usados.
  const porBarra = modo === 'peca_comprimento' && !!comprimentoM;
  const custo = porBarra
    ? cobranca === 'inteira'
      ? (barras ?? 0) * numero(item.preco)
      : (total / comprimentoM) * numero(item.preco)
    : total * numero(item.preco);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          {!!item.imagem_url && (
            <Image source={{ uri: item.imagem_url }} style={styles.imagem} resizeMode="contain" />
          )}
          <Text style={styles.codigo}>{item.codigo}</Text>
          <Text style={styles.titulo}>{item.descricao}</Text>
          <Text style={styles.sub}>
            {reais(item.preco)} {comoEVendido(item)}
            {modo === 'peca_comprimento' && comprimentoM ? ` (${reais(numero(item.preco) / comprimentoM)} o metro)` : ''}
          </Text>

          <Text style={styles.pergunta}>Quanto deste item vai em cada peça?</Text>
          <View style={styles.abas}>
            {(['fixa', 'medida'] as Forma[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  setForma(f);
                  setErro(null);
                }}
                style={[styles.aba, forma === f && styles.abaAtiva]}
              >
                <Text style={[styles.abaTexto, forma === f && styles.abaTextoAtiva]}>
                  {f === 'fixa' ? 'Quantidade fixa' : 'Pela medida da peça'}
                </Text>
              </Pressable>
            ))}
          </View>

          {forma === 'fixa' ? (
            <>
              <Text style={styles.rotulo}>{nomeUnidade[0].toUpperCase() + nomeUnidade.slice(1)} por peça</Text>
              <TextInput
                style={styles.input}
                value={fixa}
                onChangeText={(v) => setFixa(v.replace(/[^0-9,.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder={un === 'un' ? 'Ex: 4' : 'Ex: 2'}
                placeholderTextColor={COR.tintaSuave}
                autoFocus
              />
              <Text style={styles.ajuda}>
                {un === 'm'
                  ? 'Ex: 2 metros por janela. Para 4 janelas, o total vira 8 metros.'
                  : un === 'un'
                    ? 'Ex: 4 roldanas por janela.'
                    : 'Ex: 1,5 m² de vidro por peça.'}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.linha}>
                <CampoNumero rotulo="Vezes a largura" valor={vezesL} onMudar={setVezesL} />
                <CampoNumero rotulo="Vezes a altura" valor={vezesA} onMudar={setVezesA} />
              </View>
              {(modo === 'area' || numero(vezesArea) !== 0) && (
                <CampoNumero rotulo="Vezes a área (largura × altura)" valor={vezesArea} onMudar={setVezesArea} />
              )}
              <Text style={styles.ajuda}>
                Ex: uma travessa em cima e outra embaixo usa 2 vezes a largura.
              </Text>
              <CampoNumero
                rotulo={linear ? 'Desconto ou acréscimo em mm (opcional)' : `Somar ${un} (opcional)`}
                valor={ajusteMm}
                onMudar={setAjusteMm}
                permiteNegativo
              />
            </>
          )}

          {modo === 'peca_comprimento' && !!comprimentoM && (
            <>
              <Text style={styles.rotulo}>Como cobrar este perfil?</Text>
              <View style={styles.abas}>
                {([
                  ['inteira', 'Barra inteira'],
                  ['metro', 'Por metro usado'],
                ] as [Cobranca, string][]).map(([valor, rotulo]) => (
                  <Pressable
                    key={valor}
                    onPress={() => setCobranca(valor)}
                    style={[styles.aba, cobranca === valor && styles.abaAtiva]}
                  >
                    <Text style={[styles.abaTexto, cobranca === valor && styles.abaTextoAtiva]}>{rotulo}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={styles.conta}>
            <Text style={styles.contaTitulo}>
              {contexto
                ? `Nesta peça${contexto.largura_mm || contexto.altura_mm ? ` (${[contexto.largura_mm, contexto.altura_mm].filter(Boolean).join(' × ')} mm)` : ''}, ${ctx.quantidade} ${ctx.quantidade === 1 ? 'unidade' : 'unidades'}`
                : 'Exemplo com uma peça de 1 × 1 metro'}
            </Text>
            {faltaMedida ? (
              <Text style={styles.contaLinha}>Informe a medida da peça para ver a conta.</Text>
            ) : (
              <>
                <Text style={styles.contaLinha}>
                  {fmt(porPeca, 3)} {un} por peça
                  {ctx.quantidade > 1 ? ` × ${ctx.quantidade} = ${fmt(total, 3)} ${un}` : ''}
                </Text>
                {barras !== null && total > 0 && (
                  <Text style={styles.contaLinha}>
                    Comprar {barras} {barras === 1 ? 'barra' : 'barras'} de {fmt(comprimentoM)} m
                    {barras * comprimentoM - total > 0.0005 ? ` (sobram ${fmt(barras * comprimentoM - total)} m)` : ''}
                  </Text>
                )}
                <Text style={styles.contaCusto}>
                  Custo considerado:{' '}
                  {porBarra && cobranca === 'inteira'
                    ? `${barras} ${barras === 1 ? 'barra inteira' : 'barras inteiras'}`
                    : `${fmt(total, 3)} ${un}`}{' '}
                  = {reais(custo)}
                </Text>
              </>
            )}
          </View>

          <Text style={styles.rotulo}>Observação</Text>
          <TextInput
            style={styles.input}
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Opcional. Ex: folha móvel"
            placeholderTextColor={COR.tintaSuave}
            maxLength={100}
          />

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Pressable style={styles.botao} onPress={salvar} accessibilityRole="button">
            <Text style={styles.botaoTexto}>Confirmar</Text>
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={onFechar} accessibilityRole="button">
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
          {onRemover && (
            <Pressable style={styles.botaoSecundario} onPress={onRemover} accessibilityRole="button">
              <Text style={[styles.botaoSecundarioTexto, { color: COR.erro }]}>Remover este item</Text>
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
  imagem: {
    width: '100%', height: 160, borderRadius: 8, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR.linha, marginBottom: 14,
  },
  codigo: { color: COR.tintaSuave, fontSize: 13, fontWeight: '600' },
  titulo: { color: COR.tinta, fontSize: 19, fontWeight: '700', marginTop: 2 },
  sub: { color: COR.tintaSuave, fontSize: 14, marginTop: 4 },
  pergunta: { color: COR.tinta, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  abas: { flexDirection: 'row', backgroundColor: COR.bordaClara, borderRadius: 8, padding: 3, marginBottom: 16 },
  aba: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  abaAtiva: { backgroundColor: COR.superficie },
  abaTexto: { color: COR.tintaSuave, fontSize: 14, fontWeight: '600' },
  abaTextoAtiva: { color: COR.borda },
  linha: { flexDirection: 'row', gap: 12 },
  campo: { flex: 1, marginBottom: 12 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: COR.tinta,
  },
  ajuda: { color: COR.tintaSuave, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 12 },
  conta: {
    backgroundColor: COR.bordaClara, borderLeftWidth: 3, borderLeftColor: COR.borda,
    padding: 14, marginTop: 8, marginBottom: 18,
  },
  contaTitulo: { color: COR.tintaSuave, fontSize: 13, marginBottom: 6 },
  contaLinha: { color: COR.tinta, fontSize: 16, fontWeight: '600', marginTop: 2 },
  contaCusto: { color: COR.tinta, fontSize: 14, marginTop: 6 },
  erro: { color: COR.erro, fontSize: 14, marginBottom: 8 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  botaoSecundario: { alignItems: 'center', paddingVertical: 14 },
  botaoSecundarioTexto: { color: COR.borda, fontSize: 15, fontWeight: '600' },
});
