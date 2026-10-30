// src/app/(interno)/financeiro/dre.tsx  ->  rota /financeiro/dre
//
// DRE simples (plano Pro), em regime de caixa: o que efetivamente entrou e saiu
// no mês ou no ano. E o resultado de cada obra (acumulado).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DRE, FiltroPeriodo, obterDRE } from '@/api/financeiro';
import { numero, reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { MESES } from '@/util/datas';

export default function TelaDRE() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'DRE' }} />
      <SomentePro recurso="O DRE" descricao="Receitas, custos, despesas e o resultado do mês, e o lucro de cada obra.">
        <Relatorio />
      </SomentePro>
    </View>
  );
}

type Modo = 'mes' | 'ano';

function Relatorio() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('mes');
  const [data, setData] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dre, setDre] = useState<DRE | null>(null);
  const [carregando, setCarregando] = useState(true);

  const ano = data.getFullYear();
  const filtro: FiltroPeriodo =
    modo === 'mes'
      ? { mes: `${ano}-${String(data.getMonth() + 1).padStart(2, '0')}` }
      : { de: `${ano}-01-01`, ate: `${ano}-12-31` };

  useFocusEffect(
    useCallback(() => {
      setCarregando(true);
      obterDRE(filtro)
        .then(setDre)
        .catch((e) => Alert.alert('Não foi possível carregar', e?.message ?? 'Tente novamente.'))
        .finally(() => setCarregando(false));
    }, [modo, data])
  );

  function andar(delta: number) {
    setData((d) => (modo === 'mes' ? new Date(d.getFullYear(), d.getMonth() + delta, 1) : new Date(d.getFullYear() + delta, d.getMonth(), 1)));
  }

  const titulo = modo === 'mes' ? `${MESES[data.getMonth()]} de ${ano}` : `Ano de ${ano}`;
  const pct = (v: string | null) => (v === null ? '' : `${Number(v).toLocaleString('pt-BR')}%`);

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={styles.modos}>
        {([['mes', 'Mês'], ['ano', 'Ano']] as [Modo, string][]).map(([m, r]) => (
          <Pressable key={m} onPress={() => setModo(m)} style={[styles.modo, modo === m && styles.modoAtivo]}>
            <Text style={[styles.modoTexto, modo === m && { color: '#FFFFFF' }]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.navLinha}>
        <Pressable onPress={() => andar(-1)} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={cor.marca} />
        </Pressable>
        <Text style={styles.periodo}>{titulo}</Text>
        <Pressable onPress={() => andar(1)} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={cor.marca} />
        </Pressable>
      </View>

      {carregando || !dre ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={cor.marca} />
      ) : (
        <>
          <View style={styles.cartao}>
            <Linha rotulo="Receitas" valor={dre.receitas} forte />
            <Linha rotulo="(−) Custo do material" valor={dre.custo_material} negativo />
            <Linha rotulo="= Lucro bruto" valor={dre.lucro_bruto} forte destaque extra={pct(dre.margem_bruta)} />
            {dre.despesas_operacionais.map((d) => (
              <Linha key={d.categoria} rotulo={`(−) ${d.categoria}`} valor={d.valor} negativo />
            ))}
            {!dre.despesas_operacionais.length && <Linha rotulo="(−) Despesas operacionais" valor="0" negativo />}
            <View style={styles.resultado}>
              <Text style={styles.resultadoRotulo}>= Resultado do período</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.resultadoValor, numero(dre.resultado) < 0 && { color: '#FFD6D6' }]}>{reais(dre.resultado)}</Text>
                {!!dre.margem_liquida && <Text style={styles.resultadoMargem}>margem {pct(dre.margem_liquida)}</Text>}
              </View>
            </View>
          </View>
          <Text style={styles.nota}>
            Regime de caixa: só o que foi efetivamente recebido e pago no período, pela data do pagamento. Custo do
            material = pagamentos nas categorias Fornecedor de alumínio, Vidro e Acessórios.
          </Text>

          <Text style={styles.secao}>Resultado por obra</Text>
          {dre.obras.length === 0 ? (
            <Text style={styles.nota}>Nenhuma obra com recebimentos ou pagamentos neste período.</Text>
          ) : (
            <View style={styles.cartao}>
              {dre.obras.map((o, i) => (
                <Pressable key={o.projeto} onPress={() => router.push(`/projetos/${o.projeto}`)} style={[styles.obra, i > 0 && styles.divisor]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.obraNome} numberOfLines={1}>{o.numero ? `Nº ${o.numero} · ` : ''}{o.nome}</Text>
                    <Text style={styles.obraDetalhe}>{o.cliente} · recebido {reais(o.recebido)} · gasto {reais(o.gasto)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.obraLucro, numero(o.lucro) < 0 && { color: cor.erro }]}>{reais(o.lucro)}</Text>
                    {!!o.margem && <Text style={styles.obraDetalhe}>{pct(o.margem)}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.nota}>
            Por obra, os valores são acumulados desde o início (tudo o que entrou e saiu ligado ao projeto), para mostrar o
            lucro da obra inteira.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function Linha({ rotulo, valor, forte, negativo, destaque, extra }: { rotulo: string; valor: string; forte?: boolean; negativo?: boolean; destaque?: boolean; extra?: string }) {
  return (
    <View style={[styles.linha, destaque && styles.linhaDestaque]}>
      <Text style={[styles.linhaRotulo, forte && { fontWeight: '800', color: cor.texto }]}>{rotulo}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.linhaValor, forte && { fontWeight: '800' }, negativo && { color: cor.erro }]}>{reais(valor)}</Text>
        {!!extra && <Text style={styles.linhaExtra}>margem {extra}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  modos: { flexDirection: 'row', backgroundColor: cor.cartao, borderRadius: raio.botao, borderWidth: 1, borderColor: cor.borda, padding: 3 },
  modo: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 6 },
  modoAtivo: { backgroundColor: cor.marca },
  modoTexto: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  navLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.lg },
  periodo: { color: cor.texto, fontSize: 18, fontWeight: '800', textTransform: 'capitalize', minWidth: 170, textAlign: 'center' },
  cartao: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden', ...sombra },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: espaco.lg, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: cor.borda },
  linhaDestaque: { backgroundColor: cor.marcaClara },
  linhaRotulo: { color: cor.textoSuave, fontSize: 15, flexShrink: 1 },
  linhaValor: { color: cor.texto, fontSize: 15 },
  linhaExtra: { color: cor.textoSuave, fontSize: 12 },
  resultado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: cor.marca, padding: espaco.lg },
  resultadoRotulo: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resultadoValor: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  resultadoMargem: { color: cor.textoSobreMarcaSuave, fontSize: 12 },
  nota: { color: cor.textoSuave, fontSize: 12, lineHeight: 17 },
  secao: { color: cor.texto, fontSize: 17, fontWeight: '800', marginTop: espaco.sm },
  obra: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: espaco.lg },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  obraNome: { color: cor.texto, fontSize: 15, fontWeight: '800' },
  obraDetalhe: { color: cor.textoSuave, fontSize: 12, marginTop: 2 },
  obraLucro: { color: '#1E6B3A', fontSize: 16, fontWeight: '800' },
});
