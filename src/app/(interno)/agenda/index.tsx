// src/app/(interno)/agenda/index.tsx  ->  rota /agenda
//
// A semana numa faixa de dias (com um ponto nos que têm compromisso) e a
// lista do dia escolhido. Cada compromisso abre no mapa, avisa o cliente
// pelo WhatsApp e pode ser marcado como concluído.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Compromisso,
  concluirCompromisso,
  diaRelativo,
  hora,
  infoTipo,
  listarAgenda,
  mesmoDia,
  nomeDiaCurto,
} from '@/api/agenda';
import { useAuth } from '@/auth/AuthContext';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { abrirMapa, abrirWhatsApp, numeroWhatsApp } from '@/util/contato';

/** Segunda-feira da semana de uma data. */
function inicioDaSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = r.getDay(); // 0 = domingo
  r.setDate(r.getDate() - (dia === 0 ? 6 : dia - 1));
  return r;
}

function somarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const DESCRICAO_PRO = 'Organize medições, instalações e visitas, abra o endereço no mapa e avise o cliente pelo WhatsApp.';

export default function TelaAgenda() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Agenda' }} />
      <SomentePro recurso="A agenda" descricao={DESCRICAO_PRO}>
        <Agenda />
      </SomentePro>
    </View>
  );
}

function Agenda() {
  const router = useRouter();
  const { vidraceiro } = useAuth();
  const [selecionado, setSelecionado] = useState(() => new Date());
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const segunda = useMemo(() => inicioDaSemana(selecionado), [selecionado]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDias(segunda, i)), [segunda]);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setCompromissos(await listarAgenda(segunda, somarDias(segunda, 6)));
    } catch (e: any) {
      setErro(e?.message ?? 'Sem conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [segunda]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const doDia = compromissos.filter((c) => mesmoDia(new Date(c.inicio), selecionado));
  const temNoDia = (d: Date) => compromissos.some((c) => mesmoDia(new Date(c.inicio), d) && !c.concluido);

  function avisar(c: Compromisso) {
    const quando = new Date(c.inicio);
    const quem = vidraceiro?.empresa ? `${vidraceiro.nome.split(' ')[0]}, da ${vidraceiro.empresa}` : vidraceiro?.nome.split(' ')[0];
    const msg =
      `Olá, ${(c.cliente_nome ?? '').split(' ')[0]}! Aqui é ${quem}. ` +
      `Confirmando a ${infoTipo(c.tipo).rotulo.toLowerCase()} ${diaRelativo(quando)}, às ${hora(quando)}` +
      `${c.endereco ? `, no endereço ${c.endereco}` : ''}. Até lá!`;
    abrirWhatsApp(c.cliente_celular ?? '', msg).catch(() =>
      Alert.alert('Não foi possível abrir o WhatsApp', 'Confira se ele está instalado neste aparelho.')
    );
  }

  async function alternarConcluido(c: Compromisso) {
    try {
      const atualizado = await concluirCompromisso(c.id!, !c.concluido);
      setCompromissos((l) => l.map((x) => (x.id === c.id ? atualizado : x)));
    } catch (e: any) {
      Alert.alert('Não foi possível atualizar', e?.message ?? 'Tente novamente.');
    }
  }

  const hoje = new Date();

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Agenda' }} />

      <View style={styles.semanaCaixa}>
        <View style={styles.semanaTopo}>
          <Pressable onPress={() => setSelecionado((d) => somarDias(d, -7))} hitSlop={10}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={cor.marca} />
          </Pressable>
          <Text style={styles.mes}>
            {MESES[selecionado.getMonth()]} de {selecionado.getFullYear()}
          </Text>
          <Pressable onPress={() => setSelecionado((d) => somarDias(d, 7))} hitSlop={10}>
            <MaterialCommunityIcons name="chevron-right" size={26} color={cor.marca} />
          </Pressable>
          {!mesmoDia(selecionado, hoje) && (
            <Pressable onPress={() => setSelecionado(new Date())} style={styles.hoje}>
              <Text style={styles.hojeTexto}>Hoje</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.semana}>
          {dias.map((d) => {
            const ativo = mesmoDia(d, selecionado);
            const ehHoje = mesmoDia(d, hoje);
            return (
              <Pressable key={d.toISOString()} onPress={() => setSelecionado(d)} style={[styles.dia, ativo && styles.diaAtivo]}>
                <Text style={[styles.diaNome, ativo && styles.diaTextoAtivo]}>{nomeDiaCurto(d)}</Text>
                <Text style={[styles.diaNumero, ativo && styles.diaTextoAtivo, ehHoje && !ativo && { color: cor.marca }]}>
                  {d.getDate()}
                </Text>
                <View style={[styles.ponto, temNoDia(d) && { backgroundColor: ativo ? '#FFFFFF' : cor.marca }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.lista}>
        <View style={styles.listaTopo}>
          <Text style={styles.listaTitulo}>
            {diaRelativo(selecionado).replace(/^./, (l) => l.toUpperCase())}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.novo, pressed && { backgroundColor: cor.marcaEscura }]}
            onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: 'novo', data: selecionado.toISOString() } })}
          >
            <MaterialCommunityIcons name="plus" size={18} color={cor.textoSobreMarca} />
            <Text style={styles.novoTexto}>Agendar</Text>
          </Pressable>
        </View>

        {carregando && <ActivityIndicator style={{ marginTop: 24 }} color={cor.marca} />}
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {!carregando && !erro && doDia.length === 0 && (
          <View style={styles.vazio}>
            <MaterialCommunityIcons name="calendar-check-outline" size={40} color={cor.textoSuave} />
            <Text style={styles.vazioTexto}>Nenhum compromisso neste dia.</Text>
          </View>
        )}

        {doDia.map((c) => {
          const tipo = infoTipo(c.tipo);
          return (
            <View key={c.id} style={[styles.cartao, c.concluido && { opacity: 0.6 }]}>
              <Pressable onPress={() => router.push(`/agenda/${c.id}`)} style={styles.cartaoTopo}>
                <View style={styles.horaCaixa}>
                  <Text style={styles.hora}>{hora(new Date(c.inicio))}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.tipoLinha}>
                    <MaterialCommunityIcons name={tipo.icone as any} size={16} color={cor.marca} />
                    <Text style={styles.tipo}>{tipo.rotulo}</Text>
                    {c.concluido && <Text style={styles.concluidoEtiqueta}>concluído</Text>}
                  </View>
                  <Text style={styles.cliente} numberOfLines={1}>{c.cliente_nome ?? 'Sem cliente'}</Text>
                  {!!c.projeto_nome && (
                    <Text style={styles.detalhe} numberOfLines={1}>
                      {c.projeto_numero ? `Nº ${c.projeto_numero} · ` : ''}{c.projeto_nome}
                    </Text>
                  )}
                  {!!c.endereco && <Text style={styles.detalhe} numberOfLines={2}>{c.endereco}</Text>}
                </View>
              </Pressable>
              <View style={styles.acoes}>
                <Acao icone="map-marker-outline" rotulo="Mapa" desativada={!c.endereco} onPress={() => abrirMapa(c.endereco)} />
                <Acao icone="whatsapp" rotulo="Avisar" desativada={!numeroWhatsApp(c.cliente_celular)} onPress={() => avisar(c)} />
                <Acao
                  icone={c.concluido ? 'undo' : 'check'}
                  rotulo={c.concluido ? 'Reabrir' : 'Concluir'}
                  onPress={() => alternarConcluido(c)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Acao({ icone, rotulo, onPress, desativada = false }: { icone: any; rotulo: string; onPress: () => void; desativada?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={desativada} style={[styles.acao, desativada && { opacity: 0.35 }]}>
      <MaterialCommunityIcons name={icone} size={18} color={cor.marca} />
      <Text style={styles.acaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  semanaCaixa: { backgroundColor: cor.cartao, borderBottomWidth: 1, borderBottomColor: cor.borda, paddingVertical: espaco.md },
  semanaTopo: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.sm, paddingHorizontal: espaco.lg, marginBottom: espaco.sm,
    width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center',
  },
  mes: { color: cor.texto, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  hoje: { marginLeft: 'auto', borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  hojeTexto: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  semana: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: espaco.md,
    width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center',
  },
  dia: { alignItems: 'center', paddingVertical: 8, borderRadius: 12, flex: 1, marginHorizontal: 2 },
  diaAtivo: { backgroundColor: cor.marca },
  diaNome: { color: cor.textoSuave, fontSize: 12, textTransform: 'capitalize' },
  diaNumero: { color: cor.texto, fontSize: 18, fontWeight: '800', marginTop: 2 },
  diaTextoAtivo: { color: '#FFFFFF' },
  ponto: { width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: 'transparent' },
  lista: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center' },
  listaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listaTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  novo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cor.marca,
    borderRadius: raio.botao, paddingHorizontal: 14, paddingVertical: 9,
  },
  novoTexto: { color: cor.textoSobreMarca, fontSize: 14, fontWeight: '700' },
  erro: { color: cor.erro, fontSize: 14 },
  vazio: { alignItems: 'center', padding: espaco.xxl, gap: 8 },
  vazioTexto: { color: cor.textoSuave, fontSize: 15 },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, ...sombra,
  },
  cartaoTopo: { flexDirection: 'row', gap: 14 },
  horaCaixa: { backgroundColor: cor.marcaClara, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'flex-start' },
  hora: { color: cor.marca, fontSize: 16, fontWeight: '800' },
  tipoLinha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tipo: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  concluidoEtiqueta: { color: cor.textoSuave, fontSize: 12, marginLeft: 'auto' },
  cliente: { color: cor.texto, fontSize: 17, fontWeight: '800', marginTop: 2 },
  detalhe: { color: cor.textoSuave, fontSize: 14, marginTop: 2 },
  acoes: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: cor.borda, marginTop: espaco.md, paddingTop: espaco.sm,
  },
  acao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  acaoTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
});
