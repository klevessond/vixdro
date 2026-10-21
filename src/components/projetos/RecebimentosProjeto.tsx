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

import { Lancamento, gerarCobrancasProjeto, listarLancamentos, marcarPago } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { cor, espaco, raio, sombra } from '@/ui/tema';
import { hojeISO, isoParaTexto, mascaraData, somarMesesISO, textoParaISO } from '@/util/datas';

const VERDE = '#1E6B3A';

type Props = { projetoId: string; pro: boolean; total?: string | null };

export function RecebimentosProjeto({ projetoId, pro, total }: Props) {
  const router = useRouter();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);

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
    try {
      const atualizado = await marcarPago(l.id!, !l.pago);
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
            <Text style={styles.botaoTexto}>Gerar cobranças</Text>
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
          onGerado={(novos) => {
            setLancamentos(novos);
            setGerando(false);
          }}
          onFechar={() => setGerando(false)}
        />
      )}
    </View>
  );
}

function GerarCobrancas({
  projetoId,
  total,
  onGerado,
  onFechar,
}: {
  projetoId: string;
  total?: string | null;
  onGerado: (l: Lancamento[]) => void;
  onFechar: () => void;
}) {
  const [entrada, setEntrada] = useState('50');
  const [vencEntrada, setVencEntrada] = useState(isoParaTexto(hojeISO()));
  const [parcelas, setParcelas] = useState('1');
  const [primeiro, setPrimeiro] = useState(isoParaTexto(somarMesesISO(hojeISO(), 1)));
  const [salvando, setSalvando] = useState(false);

  const pct = Math.min(100, Math.max(0, numero(entrada)));
  const n = Math.max(0, parseInt(parcelas, 10) || 0);
  const valorTotal = total ? numero(total) : null;
  const valorEntrada = valorTotal !== null ? Math.round(valorTotal * pct) / 100 : null;

  async function gerar() {
    const ve = textoParaISO(vencEntrada);
    const pv = textoParaISO(primeiro);
    if (pct > 0 && !ve) return Alert.alert('Data inválida', 'Confira o vencimento do sinal (dd/mm/aaaa).');
    if (pct < 100 && (!pv || n < 1)) return Alert.alert('Confira o restante', 'Informe as parcelas e o primeiro vencimento.');
    setSalvando(true);
    try {
      onGerado(
        await gerarCobrancasProjeto({
          projeto: projetoId,
          entrada_percentual: String(pct),
          vencimento_entrada: ve ?? hojeISO(),
          parcelas_restantes: pct < 100 ? n : 0,
          primeiro_vencimento: pct < 100 ? pv! : undefined,
        })
      );
    } catch (e: any) {
      Alert.alert('Não foi possível gerar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: espaco.xl, gap: espaco.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalTopo}>
            <Text style={styles.modalTitulo}>Gerar cobranças</Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>
          {valorTotal !== null && <Text style={styles.total}>Total do orçamento: {reais(valorTotal)}</Text>}

          <Text style={styles.rotulo}>Sinal (% do total)</Text>
          <View style={styles.linha}>
            <TextInput style={[styles.input, { width: 90 }]} value={entrada} onChangeText={(v) => setEntrada(v.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" />
            <TextInput style={[styles.input, { flex: 1 }]} value={vencEntrada} onChangeText={(v) => setVencEntrada(mascaraData(v))} keyboardType="number-pad" placeholder="vencimento" placeholderTextColor="#93A3A5" />
          </View>
          {valorEntrada !== null && pct > 0 && <Text style={styles.previa}>Sinal de {reais(valorEntrada)}</Text>}

          {pct < 100 && (
            <>
              <Text style={styles.rotulo}>Restante em quantas parcelas? (1º vencimento)</Text>
              <View style={styles.linha}>
                <TextInput style={[styles.input, { width: 90 }]} value={parcelas} onChangeText={(v) => setParcelas(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
                <TextInput style={[styles.input, { flex: 1 }]} value={primeiro} onChangeText={(v) => setPrimeiro(mascaraData(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" placeholderTextColor="#93A3A5" />
              </View>
              {valorTotal !== null && valorEntrada !== null && n > 0 && (
                <Text style={styles.previa}>
                  {n === 1 ? 'Restante de ' : `${n}× de `}
                  {reais(Math.floor(((valorTotal - valorEntrada) / n) * 100) / 100)}
                  {n > 1 ? ', uma por mês' : ''}
                </Text>
              )}
            </>
          )}

          <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={gerar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Gerar</Text>}
          </Pressable>
          <Text style={styles.nota}>As cobranças aparecem no Financeiro, como contas a receber deste cliente.</Text>
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
  previa: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 13, textAlign: 'center' },
});
