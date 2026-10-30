// src/components/projetos/RecebimentosProjeto.tsx
//
// Recebimentos do orçamento (plano Pro): gera o sinal e as parcelas a partir
// do total do orçamento e acompanha o que o cliente já pagou.

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

import { Condicao, Lancamento, gerarCobrancasProjeto, listarCondicoes, listarLancamentos, marcarPago, simularCondicao } from '@/api/financeiro';
import { ConfirmarPagamento } from '@/components/financeiro/ConfirmarPagamento';
import { numero, reais } from '@/api/produtos';
import { cor, espaco, raio, sombra } from '@/ui/tema';
import { hojeISO, isoParaTexto, mascaraData, somarDiasISO, somarMesesISO, textoParaISO } from '@/util/datas';

const VERDE = '#1E6B3A';

type Props = {
  projetoId: string;
  pro: boolean;
  total?: string | null;
  condicaoCombinada?: string | null; // forma de pagamento combinada no projeto
  pedirGeracao?: number; // muda de valor = abrir a geração (ex: logo após aprovar)
  onCondicaoDefinida?: (id: string) => void;
};

export function RecebimentosProjeto({ projetoId, pro, total, condicaoCombinada, pedirGeracao, onCondicaoDefinida }: Props) {
  const router = useRouter();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [confirmando, setConfirmando] = useState<Lancamento | null>(null);

  // Logo após aprovar o orçamento: oferece gerar as contas a receber (se ainda não há).
  useEffect(() => {
    if (pro && pedirGeracao && !carregando && lancamentos.length === 0) setGerando(true);
  }, [pedirGeracao, carregando]);

  useEffect(() => {
    if (!pro) return;
    listarLancamentos({ projeto: projetoId, tipo: 'receber' })
      .then(setLancamentos)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [projetoId, pro]);

  if (!pro) {
    return (
      <Pressable style={styles.convite} onPress={() => router.push('/configuracoes/plano')}>
        <MaterialCommunityIcons name="crown-outline" size={20} color={cor.marca} />
        <Text style={styles.conviteTexto}>Controle o sinal e as parcelas deste orçamento · Pro</Text>
      </Pressable>
    );
  }

  const recebido = lancamentos.filter((l) => l.pago).reduce((t, l) => t + numero(l.valor), 0);
  const totalCobrado = lancamentos.reduce((t, l) => t + numero(l.valor), 0);

  async function alternar(l: Lancamento) {
    if (!l.pago) {
      setConfirmando(l); // pergunta a conta, a forma e a data
      return;
    }
    try {
      const atualizado = await marcarPago(l.id!, false);
      setLancamentos((lista) => lista.map((x) => (x.id === l.id ? atualizado : x)));
    } catch (e: any) {
      Alert.alert('Não foi possível atualizar', e?.message ?? 'Tente novamente.');
    }
  }

  return (
    <View style={styles.cartao}>
      <View style={styles.cabecalho}>
        <View style={styles.icone}>
          <MaterialCommunityIcons name="cash-check" size={20} color={cor.marca} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Recebimentos</Text>
          {lancamentos.length > 0 && (
            <Text style={styles.subtitulo}>
              Recebido {reais(recebido)} de {reais(totalCobrado)}
            </Text>
          )}
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={cor.marca} />
      ) : lancamentos.length === 0 ? (
        <>
          <Text style={styles.vazio}>Gere o sinal e as parcelas a partir do total do orçamento.</Text>
          <Pressable style={styles.botao} onPress={() => setGerando(true)}>
            <Text style={styles.botaoTexto}>Gerar contas a receber</Text>
          </Pressable>
        </>
      ) : (
        lancamentos.map((l) => (
          <Pressable key={l.id} style={styles.item} onPress={() => router.push(`/financeiro/${l.id}`)}>
            <Pressable onPress={() => alternar(l)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: l.pago }}>
              <MaterialCommunityIcons
                name={l.pago ? 'check-circle' : 'checkbox-blank-circle-outline'}
                size={24}
                color={l.pago ? VERDE : l.vencido ? cor.erro : cor.borda}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.descricao, l.pago && styles.riscado]} numberOfLines={1}>
                {l.descricao.split(' - ')[0]}
                {l.total_parcelas && l.total_parcelas > 1 ? ` ${l.parcela}/${l.total_parcelas}` : ''}
              </Text>
              <Text style={[styles.detalhe, l.vencido && { color: cor.erro }]}>
                {l.pago ? `recebido em ${isoParaTexto(l.pago_em)}` : `${l.vencido ? 'venceu' : 'vence'} em ${isoParaTexto(l.vencimento)}`}
              </Text>
            </View>
            <Text style={styles.valor}>{reais(l.valor)}</Text>
          </Pressable>
        ))
      )}

      {gerando && (
        <GerarCobrancas
          projetoId={projetoId}
          total={total}
          condicaoCombinada={condicaoCombinada}
          onGerado={(novos, condicao) => {
            setLancamentos(novos);
            setGerando(false);
            if (condicao) onCondicaoDefinida?.(condicao);
          }}
          onFechar={() => setGerando(false)}
        />
      )}

      <ConfirmarPagamento
        lancamento={confirmando}
        onConfirmado={(l) => {
          setConfirmando(null);
          setLancamentos((lista) => lista.map((x) => (x.id === l.id ? l : x)));
        }}
        onFechar={() => setConfirmando(null)}
      />
    </View>
  );
}

function GerarCobrancas({
  projetoId,
  total,
  condicaoCombinada,
  onGerado,
  onFechar,
}: {
  projetoId: string;
  total?: string | null;
  condicaoCombinada?: string | null;
  onGerado: (l: Lancamento[], condicao?: string) => void;
  onFechar: () => void;
}) {
  const [condicoes, setCondicoes] = useState<Condicao[]>([]);
  const [escolha, setEscolha] = useState<string>(''); // id da condição ou 'personalizado'
  const [parcelas, setParcelas] = useState('');
  const [vencimento, setVencimento] = useState(isoParaTexto(hojeISO()));
  const [primeiro, setPrimeiro] = useState(isoParaTexto(somarMesesISO(hojeISO(), 1)));
  const [entrada, setEntrada] = useState('50'); // personalizado
  const [intervalo, setIntervalo] = useState('30'); // dias entre as parcelas
  const [datas, setDatas] = useState<string[]>([]); // uma por parcela, editáveis
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarCondicoes()
      .then((lista) => {
        setCondicoes(lista);
        const inicial = lista.find((c) => c.id === condicaoCombinada) ?? lista[0];
        setEscolha(inicial?.id ?? 'personalizado');
        if (inicial) setParcelas(String(inicial.max_parcelas));
      })
      .catch(() => setEscolha('personalizado'));
  }, []);

  const cond = condicoes.find((c) => c.id === escolha);
  const valorTotal = total ? numero(total) : null;
  const n = Math.max(1, parseInt(parcelas, 10) || 1);
  const sim = cond && valorTotal !== null ? simularCondicao(cond, valorTotal, n) : null;
  const pct = Math.min(100, Math.max(0, numero(entrada)));

  // Quantas parcelas têm data própria (a entrada e o à vista usam a data de cima).
  const qtdParcelas = !cond
    ? (pct < 100 ? n : 0)
    : cond.tipo === 'avista' ? 0 : Math.min(n, cond.max_parcelas);
  // A 1ª parcela: no parcelado, a data de cima; com entrada, a "1ª parcela do restante".
  const baseParcelas = cond?.tipo === 'parcelado' ? vencimento : primeiro;

  // Datas sugeridas: a primeira e as seguintes a cada N dias (refeitas ao mudar a base).
  useEffect(() => {
    const base = textoParaISO(baseParcelas);
    const dias = Math.max(1, parseInt(intervalo, 10) || 30);
    if (!base) return;
    setDatas(Array.from({ length: qtdParcelas }, (_, i) => isoParaTexto(somarDiasISO(base, i * dias))));
  }, [baseParcelas, intervalo, qtdParcelas]);

  function escolher(id: string) {
    setEscolha(id);
    const c = condicoes.find((x) => x.id === id);
    if (c) setParcelas(String(c.max_parcelas));
  }

  async function gerar() {
    const ve = textoParaISO(vencimento);
    const pv = textoParaISO(primeiro);
    if (!ve) return Alert.alert('Data inválida', 'Confira a data (dd/mm/aaaa).');
    const precisaPrimeiro = cond ? cond.tipo === 'entrada' : pct < 100;
    if (precisaPrimeiro && !pv) return Alert.alert('Data inválida', 'Confira o vencimento da primeira parcela.');
    const vencimentos = datas.map(textoParaISO);
    if (vencimentos.some((d) => !d)) return Alert.alert('Data inválida', 'Confira as datas das parcelas (dd/mm/aaaa).');
    const lista = qtdParcelas > 0 ? (vencimentos as string[]) : undefined;
    setSalvando(true);
    try {
      const gerados = cond
        ? await gerarCobrancasProjeto({
            projeto: projetoId, condicao: cond.id, parcelas: cond.tipo === 'avista' ? 1 : qtdParcelas,
            vencimento_entrada: ve, primeiro_vencimento: cond.tipo === 'entrada' ? pv! : undefined, vencimentos: lista,
          })
        : await gerarCobrancasProjeto({
            projeto: projetoId, entrada_percentual: String(pct), vencimento_entrada: ve,
            parcelas_restantes: qtdParcelas, primeiro_vencimento: pct < 100 ? (lista?.[0] ?? pv!) : undefined, vencimentos: lista,
          });
      onGerado(gerados, cond?.id);
    } catch (e: any) {
      Alert.alert('Não foi possível gerar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const rotuloData = !cond ? 'Vencimento do sinal' : cond.tipo === 'avista' ? 'Vencimento' : cond.tipo === 'entrada' ? 'Vencimento da entrada' : '1º vencimento';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: espaco.xl, gap: espaco.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalTopo}>
            <Text style={styles.modalTitulo}>Gerar contas a receber</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>
          {valorTotal !== null && <Text style={styles.total}>Total do orçamento: {reais(valorTotal)}</Text>}

          <Text style={styles.rotulo}>Forma de pagamento</Text>
          <View style={styles.chips}>
            {condicoes.map((c) => (
              <Pressable key={c.id} onPress={() => escolher(c.id!)} style={[styles.chip, escolha === c.id && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, escolha === c.id && { color: '#FFFFFF' }]}>{c.nome}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setEscolha('personalizado')} style={[styles.chip, escolha === 'personalizado' && styles.chipAtivo]}>
              <Text style={[styles.chipTexto, escolha === 'personalizado' && { color: '#FFFFFF' }]}>Personalizado</Text>
            </Pressable>
          </View>

          {!cond && (
            <>
              <Text style={styles.rotulo}>Sinal (% do total)</Text>
              <TextInput style={[styles.input, { width: 90 }]} value={entrada} onChangeText={(v) => setEntrada(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" />
            </>
          )}
          {(cond ? cond.tipo !== 'avista' : pct < 100) && (
            <>
              <Text style={styles.rotulo}>
                {cond ? `Parcelas (até ${cond.max_parcelas})` : 'Restante em quantas parcelas'}
              </Text>
              <TextInput style={[styles.input, { width: 90 }]} value={parcelas} onChangeText={(v) => setParcelas(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
            </>
          )}

          <Text style={styles.rotulo}>{rotuloData}</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={vencimento} onChangeText={(v) => setVencimento(mascaraData(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" placeholderTextColor="#93A3A5" />
          {(cond ? cond.tipo === 'entrada' : pct < 100) && (
            <>
              <Text style={styles.rotulo}>1ª parcela do restante</Text>
              <TextInput style={[styles.input, { width: 160 }]} value={primeiro} onChangeText={(v) => setPrimeiro(mascaraData(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" placeholderTextColor="#93A3A5" />
            </>
          )}

          {qtdParcelas > 1 && (
            <>
              <Text style={styles.rotulo}>Intervalo entre os vencimentos (dias)</Text>
              <TextInput
                style={[styles.input, { width: 90 }]}
                value={intervalo}
                onChangeText={(v) => setIntervalo(v.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
              />
            </>
          )}
          {qtdParcelas > 0 && (
            <>
              <Text style={styles.rotulo}>Vencimento de cada parcela</Text>
              <View style={styles.datasParcelas}>
                {datas.map((d, i) => (
                  <View key={i} style={styles.dataParcela}>
                    <Text style={styles.dataParcelaRotulo}>{i + 1}ª</Text>
                    <TextInput
                      style={[styles.input, { width: 130 }]}
                      value={d}
                      onChangeText={(v) => setDatas((lista) => lista.map((x, j) => (j === i ? mascaraData(v) : x)))}
                      keyboardType="number-pad"
                      placeholder="dd/mm/aaaa"
                      placeholderTextColor="#93A3A5"
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.nota}>Já vêm preenchidas pelo intervalo; troque qualquer data, se precisar.</Text>
            </>
          )}

          {sim && cond && (
            <Text style={styles.previa}>
              {cond.tipo === 'avista'
                ? `1 recebimento de ${reais(sim.total)}`
                : `${cond.tipo === 'entrada' ? `Entrada de ${reais(sim.entrada)} + ` : ''}${sim.parcelas}x de ${reais(sim.valorParcela)}, nas datas abaixo`}
              {sim.total !== valorTotal ? ` (total ${reais(sim.total)})` : ''}
            </Text>
          )}

          <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={gerar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Gerar</Text>}
          </Pressable>
          <Text style={styles.nota}>As contas aparecem no Financeiro, em "A receber", ligadas a este cliente.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  convite: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: cor.borda, borderStyle: 'dashed',
    borderRadius: raio.campo, padding: espaco.md, marginTop: espaco.md, backgroundColor: cor.cartao,
  },
  conviteTexto: { color: cor.marca, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, marginTop: espaco.md, gap: 4, ...sombra,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: espaco.sm },
  icone: { width: 34, height: 34, borderRadius: 9, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  subtitulo: { color: cor.textoSuave, fontSize: 13 },
  vazio: { color: cor.textoSuave, fontSize: 14, marginBottom: espaco.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: cor.borda },
  descricao: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  riscado: { color: cor.textoSuave, textDecorationLine: 'line-through' },
  detalhe: { color: cor.textoSuave, fontSize: 13 },
  valor: { color: VERDE, fontSize: 15, fontWeight: '800' },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitulo: { color: cor.texto, fontSize: 20, fontWeight: '800' },
  link: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  total: { color: cor.texto, fontSize: 16, fontWeight: '700' },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600' },
  linha: { flexDirection: 'row', gap: espaco.sm },
  input: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: cor.texto, backgroundColor: cor.cartao,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  datasParcelas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dataParcela: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dataParcelaRotulo: { color: cor.textoSuave, fontSize: 14, fontWeight: '700', width: 26 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  previa: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 13, textAlign: 'center' },
});
