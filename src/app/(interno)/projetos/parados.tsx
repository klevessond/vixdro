// src/app/(interno)/projetos/parados.tsx  ->  rota /projetos/parados
//
// Orçamentos enviados ao cliente e sem resposta há mais de N dias. Para
// cada um: cobrar no WhatsApp (com mensagem pronta), lembrar depois, ou
// marcar como aprovado/recusado quando o cliente já respondeu.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { reais } from '@/api/produtos';
import { OrcamentoParado, adiarLembrete, alterarStatus, listarParados } from '@/api/projetos';
import { useAuth } from '@/auth/AuthContext';
import { usePlano } from '@/hooks/usePlano';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

// Depois de cobrar, o lembrete volta só depois destes dias.
const DIAS_APOS_COBRAR = 3;

const OPCOES_ADIAR = [
  { dias: 1, rotulo: 'Amanhã' },
  { dias: 3, rotulo: 'Em 3 dias' },
  { dias: 7, rotulo: 'Em 1 semana' },
];

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** Celular brasileiro para o link do WhatsApp: só dígitos, com o 55 na frente. */
function numeroWhatsApp(celular: string): string | null {
  const d = (celular || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export default function OrcamentosParados() {
  const router = useRouter();
  const { pro } = usePlano();
  const { vidraceiro } = useAuth();
  const [lista, setLista] = useState<OrcamentoParado[]>([]);
  const [dias, setDias] = useState(5);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [adiando, setAdiando] = useState<string | null>(null); // id com as opções de adiar abertas
  const [ocupado, setOcupado] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setErro(null);
      listarParados()
        .then((r) => {
          setLista(r.orcamentos);
          setDias(r.dias_lembrete);
        })
        .catch((e) => setErro(e?.message ?? 'Sem conexão com o servidor.'))
        .finally(() => setCarregando(false));
    }, [])
  );

  function tirarDaLista(id: string) {
    setLista((l) => l.filter((o) => o.id !== id));
    setAdiando(null);
  }

  async function cobrar(o: OrcamentoParado) {
    const numero = numeroWhatsApp(o.cliente_celular);
    if (!numero) return;
    const quem = vidraceiro?.empresa ? `${primeiroNome(vidraceiro.nome)}, da ${vidraceiro.empresa}` : primeiroNome(vidraceiro?.nome ?? '');
    const mensagem =
      `Olá, ${primeiroNome(o.cliente_nome)}! Tudo bem? Aqui é ${quem}. ` +
      `Passando para saber se você conseguiu ver o orçamento${o.numero ? ` nº ${o.numero}` : ''} (${o.nome}). ` +
      'Fico à disposição para tirar qualquer dúvida!';
    try {
      await Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`);
    } catch {
      Alert.alert('Não foi possível abrir o WhatsApp', 'Confira se ele está instalado neste aparelho.');
      return;
    }
    // Registra a cobrança e esconde o lembrete por alguns dias.
    adiarLembrete(o.id, DIAS_APOS_COBRAR, true).then(() => tirarDaLista(o.id)).catch(() => {});
  }

  async function adiar(o: OrcamentoParado, d: number) {
    setOcupado(o.id);
    try {
      await adiarLembrete(o.id, d);
      tirarDaLista(o.id);
    } catch (e: any) {
      Alert.alert('Não foi possível adiar', e?.message ?? 'Tente novamente.');
    } finally {
      setOcupado(null);
    }
  }

  function responder(o: OrcamentoParado, status: 'aprovado' | 'recusado') {
    const texto = status === 'aprovado' ? 'aprovou' : 'recusou';
    Alert.alert(`O cliente ${texto}?`, `Marcar o orçamento de ${o.cliente_nome} como ${status}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: status === 'aprovado' ? 'Marcar aprovado' : 'Marcar recusado',
        onPress: async () => {
          setOcupado(o.id);
          try {
            await alterarStatus(o.id, status);
            tirarDaLista(o.id);
            // Aprovado: oferece gerar as contas a receber (Pro), abrindo o projeto.
            if (status === 'aprovado' && pro) {
              Alert.alert('Orçamento aprovado', 'Gerar as contas a receber agora?', [
                { text: 'Depois', style: 'cancel' },
                { text: 'Gerar', onPress: () => router.push({ pathname: '/projetos/[id]', params: { id: o.id, cobrancas: '1' } }) },
              ]);
            }
          } catch (e: any) {
            Alert.alert('Não foi possível mudar a situação', e?.message ?? 'Tente novamente.');
          } finally {
            setOcupado(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Orçamentos sem resposta' }} />
      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <>
              {erro && <Text style={styles.erro}>{erro}</Text>}
              {lista.length > 0 && (
                <Text style={styles.intro}>
                  Enviados ao cliente há mais de {dias} dias, sem resposta. Uma mensagem na hora certa
                  costuma fechar a venda.
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            !erro ? (
              <View style={styles.vazio}>
                <MaterialCommunityIcons name="check-circle-outline" size={44} color={cor.marca} />
                <Text style={styles.vazioTitulo}>Tudo em dia</Text>
                <Text style={styles.vazioTexto}>
                  Nenhum orçamento esperando resposta há mais de {dias} dias.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: o }) => {
            const whats = numeroWhatsApp(o.cliente_celular);
            const ocupadoAqui = ocupado === o.id;
            return (
              <View style={styles.cartao}>
                <Pressable onPress={() => router.push(`/projetos/${o.id}`)}>
                  <View style={styles.topo}>
                    {!!o.numero && <Text style={styles.numero}>Nº {o.numero}</Text>}
                    <View style={styles.dias}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={14} color={cor.alerta} />
                      <Text style={styles.diasTexto}>há {o.dias_parado} dias</Text>
                    </View>
                  </View>
                  <View style={styles.cliente}>
                    <MaterialCommunityIcons name="account-outline" size={20} color={cor.marca} />
                    <Text style={styles.clienteNome} numberOfLines={1}>{o.cliente_nome}</Text>
                    <Text style={styles.total}>{reais(o.total)}</Text>
                  </View>
                  <Text style={styles.nome} numberOfLines={2}>{o.nome}</Text>
                  {!!o.ultimo_contato_em && (
                    <Text style={styles.contato}>
                      Cobrado em {new Date(o.ultimo_contato_em).toLocaleDateString('pt-BR')}
                    </Text>
                  )}
                </Pressable>

                <View style={styles.acoes}>
                  <Pressable
                    style={({ pressed }) => [styles.whats, !whats && styles.desativado, pressed && { opacity: 0.85 }]}
                    onPress={() => cobrar(o)}
                    disabled={!whats || ocupadoAqui}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.whatsTexto}>{whats ? 'Cobrar no WhatsApp' : 'Cliente sem celular'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secundario}
                    onPress={() => setAdiando((a) => (a === o.id ? null : o.id))}
                    disabled={ocupadoAqui}
                  >
                    <Text style={styles.secundarioTexto}>Lembrar depois</Text>
                  </Pressable>
                </View>

                {adiando === o.id && (
                  <View style={styles.opcoes}>
                    {OPCOES_ADIAR.map((op) => (
                      <Pressable key={op.dias} style={styles.opcao} onPress={() => adiar(o, op.dias)} disabled={ocupadoAqui}>
                        <Text style={styles.opcaoTexto}>{op.rotulo}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.resposta}>
                  <Text style={styles.respostaRotulo}>O cliente já respondeu?</Text>
                  <Pressable onPress={() => responder(o, 'aprovado')} disabled={ocupadoAqui} hitSlop={6}>
                    <Text style={[styles.respostaLink, { color: '#1E6B3A' }]}>Aprovou</Text>
                  </Pressable>
                  <Pressable onPress={() => responder(o, 'recusado')} disabled={ocupadoAqui} hitSlop={6}>
                    <Text style={[styles.respostaLink, { color: cor.erro }]}>Recusou</Text>
                  </Pressable>
                  {ocupadoAqui && <ActivityIndicator size="small" color={cor.marca} />}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  lista: {
    padding: espaco.lg, gap: espaco.md, flexGrow: 1, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center',
  },
  intro: { color: cor.textoSuave, fontSize: 14, lineHeight: 20, marginBottom: espaco.xs },
  erro: { color: cor.erro, fontSize: 14, marginBottom: espaco.sm },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, ...sombra,
  },
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  numero: { color: cor.textoSuave, fontSize: 13, fontWeight: '700' },
  dias: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: cor.alertaFundo,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  diasTexto: { color: cor.alerta, fontSize: 12, fontWeight: '700' },
  cliente: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clienteNome: { color: cor.texto, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  total: { color: cor.texto, fontSize: 16, fontWeight: '800', marginLeft: 'auto' },
  nome: { color: cor.textoSuave, fontSize: 15, marginTop: 4 },
  contato: { color: cor.textoSuave, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md, flexWrap: 'wrap' },
  whats: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1F8B4C',
    borderRadius: raio.botao, paddingHorizontal: 14, paddingVertical: 11, flexGrow: 1, justifyContent: 'center',
  },
  whatsTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  desativado: { backgroundColor: '#A9B7B5' },
  secundario: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.botao, paddingHorizontal: 14,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  secundarioTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  opcoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm },
  opcao: {
    flex: 1, backgroundColor: cor.marcaClara, borderRadius: raio.botao, paddingVertical: 9, alignItems: 'center',
  },
  opcaoTexto: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  resposta: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.md, borderTopWidth: 1, borderTopColor: cor.borda,
    marginTop: espaco.md, paddingTop: espaco.sm,
  },
  respostaRotulo: { color: cor.textoSuave, fontSize: 13, flex: 1 },
  respostaLink: { fontSize: 14, fontWeight: '700' },
  vazio: { padding: espaco.xxl, alignItems: 'center', gap: 6 },
  vazioTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  vazioTexto: { color: cor.textoSuave, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
