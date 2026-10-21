// src/app/(interno)/financeiro/[id].tsx  ->  rotas /financeiro/novo e /financeiro/<id>
//
// Um lançamento a receber ou a pagar. Ao criar, pode ser dividido em
// parcelas mensais (os centavos que sobram vão para a última).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CATEGORIAS,
  FORMAS,
  FormaPagamento,
  TipoLancamento,
  excluirLancamento,
  obterLancamento,
  parcelar,
  salvarLancamento,
} from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { hojeISO, isoParaTexto, mascaraData, textoParaISO } from '@/util/datas';

export default function TelaLancamento() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Lançamento' }} />
      <SomentePro recurso="O financeiro" descricao="Contas a receber e a pagar, parcelas e o saldo do mês.">
        <EditarLancamento />
      </SomentePro>
    </View>
  );
}

function EditarLancamento() {
  const params = useLocalSearchParams<{ id: string; tipo?: string }>();
  const router = useRouter();
  const novo = params.id === 'novo';

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamento>(params.tipo === 'pagar' ? 'pagar' : 'receber');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(isoParaTexto(hojeISO()));
  const [parcelas, setParcelas] = useState('1');
  const [pago, setPago] = useState(false);
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [vinculo, setVinculo] = useState<string | null>(null); // cliente/projeto, só para mostrar

  useEffect(() => {
    if (novo) return;
    obterLancamento(params.id)
      .then((l) => {
        setTipo(l.tipo);
        setDescricao(l.descricao);
        setCategoria(l.categoria);
        setValor(String(numero(l.valor)).replace('.', ','));
        setVencimento(isoParaTexto(l.vencimento));
        setPago(l.pago);
        setForma(l.forma ?? '');
        setObservacoes(l.observacoes);
        const partes = [
          l.projeto_numero ? `Orçamento nº ${l.projeto_numero}` : l.projeto_nome,
          l.cliente_nome,
          l.total_parcelas && l.total_parcelas > 1 ? `parcela ${l.parcela} de ${l.total_parcelas}` : null,
        ].filter(Boolean);
        setVinculo(partes.length ? partes.join(' · ') : null);
      })
      .catch((e) => Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.', [{ text: 'OK', onPress: () => router.back() }]))
      .finally(() => setCarregando(false));
  }, [params.id]);

  const qtdParcelas = Math.max(1, parseInt(parcelas, 10) || 1);
  const valorNumero = numero(valor);

  async function salvar() {
    const venc = textoParaISO(vencimento);
    if (!descricao.trim()) return Alert.alert('Falta a descrição', 'Ex: Compra de vidros, Sinal do orçamento nº 12.');
    if (!(valorNumero > 0)) return Alert.alert('Falta o valor', 'Informe um valor maior que zero.');
    if (!venc) return Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa.');
    setSalvando(true);
    try {
      if (novo && qtdParcelas > 1) {
        await parcelar({
          tipo, descricao, categoria, valor_total: String(valorNumero), parcelas: qtdParcelas,
          primeiro_vencimento: venc, observacoes,
        });
      } else {
        await salvarLancamento({
          id: novo ? undefined : params.id, tipo, descricao, categoria, valor: String(valorNumero),
          vencimento: venc, pago, forma, observacoes,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    Alert.alert('Excluir lançamento', 'Excluir este lançamento? As outras parcelas, se houver, continuam.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirLancamento(params.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  if (carregando) return <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />;

  const receber = tipo === 'receber';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: novo ? 'Novo lançamento' : 'Lançamento' }} />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {novo && (
          <View style={styles.tipos}>
            {(['receber', 'pagar'] as TipoLancamento[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setTipo(t);
                  setCategoria('');
                }}
                style={[styles.tipo, tipo === t && { backgroundColor: t === 'receber' ? '#1E6B3A' : cor.erro, borderColor: 'transparent' }]}
              >
                <MaterialCommunityIcons
                  name={t === 'receber' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={20}
                  color={tipo === t ? '#FFFFFF' : cor.texto}
                />
                <Text style={[styles.tipoTexto, tipo === t && { color: '#FFFFFF' }]}>{t === 'receber' ? 'A receber' : 'A pagar'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!vinculo && (
          <View style={styles.vinculo}>
            <MaterialCommunityIcons name="link-variant" size={16} color={cor.marca} />
            <Text style={styles.vinculoTexto}>{vinculo}</Text>
          </View>
        )}

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Descrição</Text>
          <TextInput
            style={styles.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder={receber ? 'Ex: Serviço de manutenção' : 'Ex: Compra de vidros'}
            placeholderTextColor="#93A3A5"
          />

          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rotulo}>{novo && qtdParcelas > 1 ? 'Valor total (R$)' : 'Valor (R$)'}</Text>
              <TextInput
                style={styles.input}
                value={valor}
                onChangeText={(v) => setValor(v.replace(/[^0-9,.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#93A3A5"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rotulo}>{novo && qtdParcelas > 1 ? '1º vencimento' : 'Vencimento'}</Text>
              <TextInput
                style={styles.input}
                value={vencimento}
                onChangeText={(v) => setVencimento(mascaraData(v))}
                keyboardType="number-pad"
                placeholder="dd/mm/aaaa"
                placeholderTextColor="#93A3A5"
              />
            </View>
          </View>

          {novo && (
            <>
              <Text style={styles.rotulo}>Parcelas</Text>
              <View style={styles.linha}>
                <TextInput
                  style={[styles.input, { width: 80 }]}
                  value={parcelas}
                  onChangeText={(v) => setParcelas(v.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                />
                <Text style={styles.ajuda}>
                  {qtdParcelas > 1 && valorNumero > 0
                    ? `${qtdParcelas}× de ${reais(Math.floor((valorNumero / qtdParcelas) * 100) / 100)}, uma por mês`
                    : 'À vista (1 parcela)'}
                </Text>
              </View>
            </>
          )}

          <Text style={styles.rotulo}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIAS[tipo].map((c) => (
              <Pressable key={c} onPress={() => setCategoria(categoria === c ? '' : c)} style={[styles.chip, categoria === c && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, categoria === c && { color: '#FFFFFF' }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!(novo && qtdParcelas > 1) && (
          <View style={styles.cartao}>
            <Pressable style={styles.pagoLinha} onPress={() => setPago((p) => !p)}>
              <MaterialCommunityIcons name={pago ? 'check-circle' : 'checkbox-blank-circle-outline'} size={26} color={pago ? '#1E6B3A' : cor.borda} />
              <Text style={styles.pagoTexto}>{receber ? 'Já recebido' : 'Já pago'}</Text>
            </Pressable>
            {pago && (
              <>
                <Text style={[styles.rotulo, { marginTop: espaco.md }]}>Forma de pagamento</Text>
                <View style={styles.chips}>
                  {FORMAS.map((f) => (
                    <Pressable key={f.valor} onPress={() => setForma(forma === f.valor ? '' : f.valor)} style={[styles.chip, forma === f.valor && styles.chipAtivo]}>
                      <Text style={[styles.chipTexto, forma === f.valor && { color: '#FFFFFF' }]}>{f.rotulo}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Observações</Text>
          <TextInput
            style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Opcional"
            placeholderTextColor="#93A3A5"
            multiline
          />
        </View>

        <Pressable style={[styles.botao, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botaoTexto}>{novo && qtdParcelas > 1 ? `Criar ${qtdParcelas} parcelas` : 'Salvar'}</Text>
          )}
        </Pressable>
        {!novo && (
          <Pressable style={{ alignItems: 'center', paddingVertical: 10 }} onPress={excluir}>
            <Text style={{ color: cor.erro, fontSize: 15, fontWeight: '600' }}>Excluir lançamento</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  tipos: { flexDirection: 'row', gap: espaco.sm },
  tipo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1,
    borderColor: cor.borda, borderRadius: raio.botao, paddingVertical: 12, backgroundColor: cor.cartao,
  },
  tipoTexto: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  vinculo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cor.marcaClara, borderRadius: raio.campo, padding: espaco.md },
  vinculoTexto: { color: cor.marca, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, paddingBottom: espaco.sm, ...sombra,
  },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: cor.texto, backgroundColor: cor.fundo, marginBottom: espaco.md,
  },
  linha: { flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-start' },
  ajuda: { color: cor.textoSuave, fontSize: 14, flex: 1, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: espaco.md },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  pagoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: espaco.sm },
  pagoTexto: { color: cor.texto, fontSize: 16, fontWeight: '700' },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
