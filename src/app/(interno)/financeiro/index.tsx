// src/app/(interno)/financeiro/index.tsx  ->  rota /financeiro
//
// Financeiro do mês (plano Pro): quanto há a receber e a pagar, o que já
// entrou e saiu, o saldo e a lista de lançamentos. Um toque no círculo
// marca o lançamento como pago/recebido.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Lancamento, Resumo, TipoLancamento, listarLancamentos, marcarPago, obterResumo } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { MESES, isoParaTexto } from '@/util/datas';

const VERDE = '#1E6B3A';

export default function TelaFinanceiro() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Financeiro' }} />
      <SomentePro
        recurso="O financeiro"
        descricao="Contas a receber e a pagar, parcelas, cobranças geradas a partir do orçamento e o saldo do mês."
      >
        <Financeiro />
      </SomentePro>
    </View>
  );
}

type Filtro = 'todos' | TipoLancamento;

function Financeiro() {
  const router = useRouter();
  const [data, setData] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

  const carregar = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([
        obterResumo(mes),
        listarLancamentos({ mes, tipo: filtro === 'todos' ? undefined : filtro }),
      ]);
      setResumo(r);
      setLancamentos(l);
    } catch (e: any) {
      Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [mes, filtro]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  function mudarMes(delta: number) {
    setCarregando(true);
    setData((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  async function alternarPago(l: Lancamento) {
    try {
      const atualizado = await marcarPago(l.id!, !l.pago);
      setLancamentos((lista) => lista.map((x) => (x.id === l.id ? atualizado : x)));
      obterResumo(mes).then(setResumo).catch(() => {});
    } catch (e: any) {
      Alert.alert('Não foi possível atualizar', e?.message ?? 'Tente novamente.');
    }
  }

  const venc = resumo?.vencidos;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={styles.mesLinha}>
        <Pressable onPress={() => mudarMes(-1)} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={cor.marca} />
        </Pressable>
        <Text style={styles.mes}>{MESES[data.getMonth()]} de {data.getFullYear()}</Text>
        <Pressable onPress={() => mudarMes(1)} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={cor.marca} />
        </Pressable>
      </View>

      {resumo && (
        <>
          <View style={styles.resumo}>
            <Bloco
              rotulo="A receber"
              valor={resumo.receber.total}
              detalhe={`recebido ${reais(resumo.receber.recebido)}`}
              cor={VERDE}
              icone="arrow-down-circle-outline"
            />
            <Bloco
              rotulo="A pagar"
              valor={resumo.pagar.total}
              detalhe={`pago ${reais(resumo.pagar.pago)}`}
              cor={cor.erro}
              icone="arrow-up-circle-outline"
            />
          </View>
          <View style={styles.saldo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saldoRotulo}>Saldo do mês (previsto)</Text>
              <Text style={[styles.saldoValor, { color: numero(resumo.saldo_previsto) < 0 ? cor.erro : cor.texto }]}>
                {reais(resumo.saldo_previsto)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.saldoRotulo}>Já realizado</Text>
              <Text style={styles.saldoRealizado}>{reais(resumo.saldo_realizado)}</Text>
            </View>
          </View>
          {!!venc && (venc.receber.quantidade > 0 || venc.pagar.quantidade > 0) && (
            <View style={styles.alerta}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={cor.alerta} />
              <Text style={styles.alertaTexto}>
                Vencidos (todos os meses):
                {venc.receber.quantidade > 0 ? ` ${venc.receber.quantidade} a receber (${reais(venc.receber.valor)})` : ''}
                {venc.receber.quantidade > 0 && venc.pagar.quantidade > 0 ? ' ·' : ''}
                {venc.pagar.quantidade > 0 ? ` ${venc.pagar.quantidade} a pagar (${reais(venc.pagar.valor)})` : ''}
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.filtros}>
        {(['todos', 'receber', 'pagar'] as Filtro[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              setCarregando(true);
              setFiltro(f);
            }}
            style={[styles.filtro, filtro === f && styles.filtroAtivo]}
          >
            <Text style={[styles.filtroTexto, filtro === f && { color: '#FFFFFF' }]}>
              {f === 'todos' ? 'Todos' : f === 'receber' ? 'A receber' : 'A pagar'}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [styles.novo, pressed && { backgroundColor: cor.marcaEscura }]}
          onPress={() => router.push({ pathname: '/financeiro/[id]', params: { id: 'novo', tipo: filtro === 'pagar' ? 'pagar' : 'receber' } })}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.novoTexto}>Lançamento</Text>
        </Pressable>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={cor.marca} />
      ) : lancamentos.length === 0 ? (
        <View style={styles.vazio}>
          <MaterialCommunityIcons name="cash-multiple" size={42} color={cor.textoSuave} />
          <Text style={styles.vazioTexto}>Nenhum lançamento neste mês.</Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {lancamentos.map((l, i) => {
            const receber = l.tipo === 'receber';
            return (
              <View key={l.id}>
                {i > 0 && <View style={styles.divisor} />}
                <Pressable
                  onPress={() => router.push(`/financeiro/${l.id}`)}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: cor.marcaClara }]}
                >
                  <Pressable
                    onPress={() => alternarPago(l)}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: l.pago }}
                    accessibilityLabel={receber ? 'Recebido' : 'Pago'}
                  >
                    <MaterialCommunityIcons
                      name={l.pago ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={26}
                      color={l.pago ? VERDE : l.vencido ? cor.erro : cor.borda}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.descricao, l.pago && styles.riscado]} numberOfLines={2}>{l.descricao}</Text>
                    <Text style={[styles.detalhe, l.vencido && { color: cor.erro }]}>
                      {l.pago
                        ? `${receber ? 'recebido' : 'pago'} em ${isoParaTexto(l.pago_em)}`
                        : `${l.vencido ? 'venceu' : 'vence'} em ${isoParaTexto(l.vencimento)}`}
                      {l.cliente_nome ? ` · ${l.cliente_nome}` : l.categoria ? ` · ${l.categoria}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.valor, { color: receber ? VERDE : cor.erro }]}>
                    {receber ? '+' : '−'} {reais(l.valor)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function Bloco({ rotulo, valor, detalhe, cor: c, icone }: { rotulo: string; valor: string; detalhe: string; cor: string; icone: any }) {
  return (
    <View style={styles.bloco}>
      <View style={styles.blocoTopo}>
        <MaterialCommunityIcons name={icone} size={18} color={c} />
        <Text style={styles.blocoRotulo}>{rotulo}</Text>
      </View>
      <Text style={[styles.blocoValor, { color: c }]}>{reais(valor)}</Text>
      <Text style={styles.blocoDetalhe}>{detalhe}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  mesLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.lg },
  mes: { color: cor.texto, fontSize: 18, fontWeight: '800', textTransform: 'capitalize', minWidth: 170, textAlign: 'center' },
  resumo: { flexDirection: 'row', gap: espaco.md },
  bloco: {
    flex: 1, backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, ...sombra,
  },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blocoRotulo: { color: cor.textoSuave, fontSize: 13, fontWeight: '700' },
  blocoValor: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  blocoDetalhe: { color: cor.textoSuave, fontSize: 12, marginTop: 2 },
  saldo: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: cor.cartao, borderRadius: raio.cartao,
    borderWidth: 1, borderColor: cor.borda, padding: espaco.lg, ...sombra,
  },
  saldoRotulo: { color: cor.textoSuave, fontSize: 12, fontWeight: '700' },
  saldoValor: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  saldoRealizado: { color: cor.texto, fontSize: 16, fontWeight: '700', marginTop: 2 },
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cor.alertaFundo,
    borderRadius: raio.campo, padding: espaco.md,
  },
  alertaTexto: { color: cor.alerta, fontSize: 13, flexShrink: 1 },
  filtros: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: espaco.sm },
  filtro: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: cor.cartao },
  filtroAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  filtroTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  novo: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cor.marca,
    borderRadius: raio.botao, paddingHorizontal: 12, paddingVertical: 8,
  },
  novoTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  vazio: { alignItems: 'center', padding: espaco.xxl, gap: 8 },
  vazioTexto: { color: cor.textoSuave, fontSize: 15 },
  lista: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  divisor: { height: 1, backgroundColor: cor.borda, marginLeft: 52 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: espaco.md, paddingHorizontal: espaco.lg },
  descricao: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  riscado: { color: cor.textoSuave, textDecorationLine: 'line-through' },
  detalhe: { color: cor.textoSuave, fontSize: 13, marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '800' },
});
