// src/components/projetos/ComprasProjeto.tsx
//
// Compras da obra (plano Pro): as contas a pagar ligadas ao projeto. O pedido
// à Alumínio Seridó entra sozinho ao ser enviado; compras de outros
// fornecedores (vidro, acessórios) são registradas aqui, com o valor sugerido
// pelos itens próprios da lista de compra.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { CATEGORIAS, Lancamento, listarLancamentos, marcarPago, parcelar } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { ConfirmarPagamento } from '@/components/financeiro/ConfirmarPagamento';
import { cor, espaco, raio, sombra } from '@/ui/tema';
import { hojeISO, isoParaTexto, mascaraData, somarDiasISO, textoParaISO } from '@/util/datas';

type Props = {
  projetoId: string;
  pro: boolean;
  referencia: string; // ex: "Orçamento nº 12"
  custoItensProprios: number; // sugestão para a compra de outros fornecedores
  atualizarEm?: number; // muda de valor = recarregar (ex: depois de enviar o pedido)
};

export function ComprasProjeto({ projetoId, pro, referencia, custoItensProprios, atualizarEm }: Props) {
  const router = useRouter();
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [confirmando, setConfirmando] = useState<Lancamento | null>(null);

  useEffect(() => {
    if (!pro) return;
    listarLancamentos({ projeto: projetoId, tipo: 'pagar' })
      .then(setLista)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [projetoId, pro, atualizarEm]);

  if (!pro) return null; // o convite do Pro já aparece nos Recebimentos

  const total = lista.reduce((t, l) => t + numero(l.valor), 0);
  const pago = lista.filter((l) => l.pago).reduce((t, l) => t + numero(l.valor), 0);

  async function alternar(l: Lancamento) {
    if (!l.pago) return setConfirmando(l);
    try {
      const atualizado = await marcarPago(l.id!, false);
      setLista((x) => x.map((y) => (y.id === l.id ? atualizado : y)));
    } catch (e: any) {
      Alert.alert('Não foi possível atualizar', e?.message ?? 'Tente novamente.');
    }
  }

  return (
    <View style={styles.cartao}>
      <View style={styles.cabecalho}>
        <View style={styles.icone}>
          <MaterialCommunityIcons name="cart-outline" size={20} color={cor.marca} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Compras da obra</Text>
          <Text style={styles.subtitulo}>
            {lista.length ? `Pago ${reais(pago)} de ${reais(total)}` : 'Contas a pagar ligadas a este projeto.'}
          </Text>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={cor.marca} />
      ) : (
        lista.map((l) => (
          <Pressable key={l.id} style={styles.item} onPress={() => router.push(`/financeiro/${l.id}`)}>
            <Pressable onPress={() => alternar(l)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: l.pago }}>
              <MaterialCommunityIcons
                name={l.pago ? 'check-circle' : 'checkbox-blank-circle-outline'}
                size={24}
                color={l.pago ? '#1E6B3A' : l.vencido ? cor.erro : cor.borda}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.descricao, l.pago && styles.riscado]} numberOfLines={1}>
                {l.descricao.split(' - ')[0]}
                {l.total_parcelas && l.total_parcelas > 1 ? ` ${l.parcela}/${l.total_parcelas}` : ''}
              </Text>
              <Text style={[styles.detalhe, l.vencido && { color: cor.erro }]}>
                {l.pago ? `pago em ${isoParaTexto(l.pago_em)}` : `${l.vencido ? 'venceu' : 'vence'} em ${isoParaTexto(l.vencimento)}`}
                {l.categoria ? ` · ${l.categoria}` : ''}
              </Text>
            </View>
            <Text style={styles.valor}>{reais(l.valor)}</Text>
          </Pressable>
        ))
      )}

      <Pressable style={styles.registrar} onPress={() => setRegistrando(true)}>
        <Text style={styles.registrarTexto}>+ Registrar compra de outro fornecedor</Text>
      </Pressable>
      <Text style={styles.nota}>O pedido à Alumínio Seridó entra aqui sozinho, quando é enviado.</Text>

      {registrando && (
        <RegistrarCompra
          projetoId={projetoId}
          referencia={referencia}
          sugestao={custoItensProprios}
          onRegistrado={(novos) => {
            setLista((x) => [...x, ...novos]);
            setRegistrando(false);
          }}
          onFechar={() => setRegistrando(false)}
        />
      )}
      <ConfirmarPagamento
        lancamento={confirmando}
        onConfirmado={(l) => {
          setConfirmando(null);
          setLista((x) => x.map((y) => (y.id === l.id ? l : y)));
        }}
        onFechar={() => setConfirmando(null)}
      />
    </View>
  );
}

function RegistrarCompra({
  projetoId,
  referencia,
  sugestao,
  onRegistrado,
  onFechar,
}: {
  projetoId: string;
  referencia: string;
  sugestao: number;
  onRegistrado: (l: Lancamento[]) => void;
  onFechar: () => void;
}) {
  const [fornecedor, setFornecedor] = useState('');
  const [categoria, setCategoria] = useState('Vidro');
  const [valor, setValor] = useState(sugestao > 0 ? sugestao.toFixed(2).replace('.', ',') : '');
  const [parcelas, setParcelas] = useState('1');
  const [primeiro, setPrimeiro] = useState(isoParaTexto(hojeISO()));
  const [intervalo, setIntervalo] = useState('30');
  const [datas, setDatas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const n = Math.max(1, parseInt(parcelas, 10) || 1);

  // Datas sugeridas: a primeira e as seguintes a cada N dias (editáveis).
  useEffect(() => {
    const base = textoParaISO(primeiro);
    if (!base) return;
    const dias = Math.max(1, parseInt(intervalo, 10) || 30);
    setDatas(Array.from({ length: n }, (_, i) => isoParaTexto(somarDiasISO(base, i * dias))));
  }, [primeiro, intervalo, n]);

  async function salvar() {
    if (!fornecedor.trim()) return Alert.alert('Falta o fornecedor', 'Ex: Vidraçaria Central.');
    if (!(numero(valor) > 0)) return Alert.alert('Falta o valor', 'Informe o valor da compra.');
    const vencimentos = datas.map(textoParaISO);
    if (vencimentos.some((d) => !d)) return Alert.alert('Data inválida', 'Confira as datas (dd/mm/aaaa).');
    setSalvando(true);
    try {
      onRegistrado(
        await parcelar({
          tipo: 'pagar',
          descricao: `Compra ${fornecedor.trim()} - ${referencia}`,
          categoria,
          valor_total: String(numero(valor)),
          parcelas: n,
          primeiro_vencimento: vencimentos[0]!,
          vencimentos: vencimentos as string[],
          observacoes: '',
          projeto: projetoId,
        })
      );
    } catch (e: any) {
      Alert.alert('Não foi possível registrar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: espaco.xl, gap: espaco.sm }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalTopo}>
            <Text style={styles.modalTitulo}>Registrar compra</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>

          <Text style={styles.rotulo}>Fornecedor</Text>
          <TextInput style={styles.input} value={fornecedor} onChangeText={setFornecedor} placeholder="Ex: Vidraçaria Central" placeholderTextColor="#93A3A5" />

          <Text style={styles.rotulo}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIAS.pagar.slice(0, 3).concat('Outros').map((c) => (
              <Pressable key={c} onPress={() => setCategoria(c)} style={[styles.chip, categoria === c && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, categoria === c && { color: '#FFFFFF' }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rotulo}>Valor total (R$)</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={valor} onChangeText={(v) => setValor(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#93A3A5" />
          {sugestao > 0 && <Text style={styles.nota}>Sugerido: o custo dos itens próprios deste projeto ({reais(sugestao)}).</Text>}

          <View style={styles.linha}>
            <View>
              <Text style={styles.rotulo}>Parcelas</Text>
              <TextInput style={[styles.input, { width: 80 }]} value={parcelas} onChangeText={(v) => setParcelas(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
            </View>
            <View>
              <Text style={styles.rotulo}>1º vencimento</Text>
              <TextInput style={[styles.input, { width: 140 }]} value={primeiro} onChangeText={(v) => setPrimeiro(mascaraData(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" placeholderTextColor="#93A3A5" />
            </View>
            {n > 1 && (
              <View>
                <Text style={styles.rotulo}>Intervalo (dias)</Text>
                <TextInput style={[styles.input, { width: 90 }]} value={intervalo} onChangeText={(v) => setIntervalo(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
              </View>
            )}
          </View>

          {n > 1 && (
            <>
              <Text style={styles.rotulo}>Vencimento de cada parcela</Text>
              <View style={styles.chips}>
                {datas.map((d, i) => (
                  <View key={i} style={styles.dataParcela}>
                    <Text style={styles.dataRotulo}>{i + 1}ª</Text>
                    <TextInput
                      style={[styles.input, { width: 130 }]}
                      value={d}
                      onChangeText={(v) => setDatas((x) => x.map((y, j) => (j === i ? mascaraData(v) : y)))}
                      keyboardType="number-pad"
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Registrar</Text>}
          </Pressable>
          <Text style={styles.nota}>Entra no Financeiro como conta a pagar, ligada a esta obra.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, marginTop: espaco.md, gap: 4, ...sombra,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: espaco.sm },
  icone: { width: 34, height: 34, borderRadius: 9, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  subtitulo: { color: cor.textoSuave, fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: cor.borda },
  descricao: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  riscado: { color: cor.textoSuave, textDecorationLine: 'line-through' },
  detalhe: { color: cor.textoSuave, fontSize: 13 },
  valor: { color: cor.erro, fontSize: 15, fontWeight: '800' },
  registrar: { borderWidth: 1, borderColor: cor.borda, borderStyle: 'dashed', borderRadius: raio.campo, paddingVertical: 11, alignItems: 'center', marginTop: espaco.sm },
  registrarTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 12 },
  modalTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espaco.sm },
  modalTitulo: { color: cor.texto, fontSize: 20, fontWeight: '800' },
  link: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.cartao },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  dataParcela: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dataRotulo: { color: cor.textoSuave, fontSize: 14, fontWeight: '700', width: 26 },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 14, alignItems: 'center', marginTop: espaco.lg },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
