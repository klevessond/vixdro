// src/app/(interno)/agenda/[id].tsx  ->  rotas /agenda/novo e /agenda/<id>
//
// Cria ou edita um compromisso. Pode chegar já preenchido pela tela do
// projeto (?projeto=...&cliente=...&tipo=instalacao) ou pela agenda (?data=...).

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
  TIPOS_COMPROMISSO,
  TipoCompromisso,
  excluirCompromisso,
  obterCompromisso,
  salvarCompromisso,
} from '@/api/agenda';
import { ProjetoResumo, listarProjetosDoCliente } from '@/api/projetos';
import { SeletorCliente } from '@/components/projetos/SeletorCliente';
import { ClienteLocal, obterClienteLocal } from '@/storage/clientesRepository';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { abrirMapa, enderecoEmLinha } from '@/util/contato';

const p2 = (n: number) => String(n).padStart(2, '0');
const dataTexto = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;

function mascaraData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function mascaraHora(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "17/10/2026" + "14:30" -> Date local, ou null se inválido. */
function montarData(data: string, hora: string): Date | null {
  const [dd, mm, aa] = data.split('/').map(Number);
  const [hh, mi] = hora.split(':').map(Number);
  if (!dd || !mm || !aa || aa < 2000 || hh === undefined || mi === undefined) return null;
  if (hh > 23 || mi > 59 || Number.isNaN(hh) || Number.isNaN(mi)) return null;
  const d = new Date(aa, mm - 1, dd, hh, mi);
  return d.getDate() === dd && d.getMonth() === mm - 1 ? d : null; // recusa 31/02
}

type ClienteEscolhido = { id: string; nome: string };

export default function EditarCompromisso() {
  const params = useLocalSearchParams<{ id: string; data?: string; cliente?: string; projeto?: string; tipo?: string }>();
  const router = useRouter();
  const novo = params.id === 'novo';

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState<TipoCompromisso>((params.tipo as TipoCompromisso) || 'medicao');
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [projeto, setProjeto] = useState<string | null>(params.projeto ?? null);
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [data, setData] = useState(() => dataTexto(params.data ? new Date(params.data) : new Date()));
  const [hora, setHora] = useState('08:00');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [seletorAberto, setSeletorAberto] = useState(false);

  // Edição: carrega o compromisso.
  useEffect(() => {
    if (novo) return;
    obterCompromisso(params.id)
      .then((c) => {
        const d = new Date(c.inicio);
        setTipo(c.tipo);
        setCliente(c.cliente ? { id: c.cliente, nome: c.cliente_nome ?? '' } : null);
        setProjeto(c.projeto);
        setData(dataTexto(d));
        setHora(`${p2(d.getHours())}:${p2(d.getMinutes())}`);
        setEndereco(c.endereco);
        setObservacoes(c.observacoes);
      })
      .catch((e) => Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.', [{ text: 'OK', onPress: () => router.back() }]))
      .finally(() => setCarregando(false));
  }, [params.id]);

  // Novo, vindo do projeto: já traz o cliente e o endereço dele.
  useEffect(() => {
    if (!novo || !params.cliente) return;
    obterClienteLocal(params.cliente).then((c) => c && escolherCliente(c, true));
  }, [params.cliente]);

  // Projetos do cliente escolhido, para ligar o compromisso a um deles.
  useEffect(() => {
    if (!cliente) {
      setProjetos([]);
      return;
    }
    listarProjetosDoCliente(cliente.id).then(setProjetos).catch(() => setProjetos([]));
  }, [cliente?.id]);

  function escolherCliente(c: ClienteLocal, manterProjeto = false) {
    setSeletorAberto(false);
    if (c.id !== cliente?.id && !manterProjeto) setProjeto(null);
    setCliente({ id: c.id, nome: c.nome });
    // Endereço do cliente como sugestão (dá para trocar pelo da obra).
    setEndereco((atual) => atual || enderecoEmLinha(c));
  }

  function atalhoDia(deslocamento: number) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    setData(dataTexto(d));
  }

  async function salvar() {
    const inicio = montarData(data, hora);
    if (!inicio) return Alert.alert('Data ou hora inválida', 'Use o formato dd/mm/aaaa e hh:mm. Ex: 17/10/2026 e 14:30.');
    if (!cliente && tipo !== 'outro') return Alert.alert('Falta o cliente', 'Escolha o cliente deste compromisso.');
    setSalvando(true);
    try {
      await salvarCompromisso({
        id: novo ? undefined : params.id,
        tipo,
        cliente: cliente?.id ?? null,
        projeto,
        inicio: inicio.toISOString(),
        endereco,
        observacoes,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    Alert.alert('Excluir compromisso', 'Remover este compromisso da agenda?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirCompromisso(params.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <View style={styles.tela}>
        <Stack.Screen options={{ headerShown: true, title: 'Compromisso' }} />
        <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: novo ? 'Novo compromisso' : 'Compromisso' }} />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Tipo</Text>
          <View style={styles.chips}>
            {TIPOS_COMPROMISSO.map((t) => (
              <Pressable key={t.valor} onPress={() => setTipo(t.valor)} style={[styles.chip, tipo === t.valor && styles.chipAtivo]}>
                <MaterialCommunityIcons name={t.icone as any} size={16} color={tipo === t.valor ? '#FFFFFF' : cor.marca} />
                <Text style={[styles.chipTexto, tipo === t.valor && { color: '#FFFFFF' }]}>{t.rotulo}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rotulo}>Quando</Text>
          <View style={styles.linha}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={data}
              onChangeText={(v) => setData(mascaraData(v))}
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#93A3A5"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { width: 96 }]}
              value={hora}
              onChangeText={(v) => setHora(mascaraHora(v))}
              placeholder="hh:mm"
              placeholderTextColor="#93A3A5"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.atalhos}>
            <Pressable onPress={() => atalhoDia(0)} style={styles.atalho}><Text style={styles.atalhoTexto}>Hoje</Text></Pressable>
            <Pressable onPress={() => atalhoDia(1)} style={styles.atalho}><Text style={styles.atalhoTexto}>Amanhã</Text></Pressable>
          </View>
        </View>

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Cliente</Text>
          <Pressable style={styles.escolha} onPress={() => setSeletorAberto(true)}>
            <MaterialCommunityIcons name="account-outline" size={20} color={cor.marca} />
            <Text style={cliente ? styles.escolhido : styles.placeholder}>{cliente?.nome || 'Escolher cliente'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={cor.textoSuave} />
          </Pressable>

          {projetos.length > 0 && (
            <>
              <Text style={styles.rotulo}>Projeto (opcional)</Text>
              <View style={styles.chips}>
                <Pressable onPress={() => setProjeto(null)} style={[styles.chip, !projeto && styles.chipAtivo]}>
                  <Text style={[styles.chipTexto, !projeto && { color: '#FFFFFF' }]}>Nenhum</Text>
                </Pressable>
                {projetos.map((p) => (
                  <Pressable key={p.id} onPress={() => setProjeto(p.id)} style={[styles.chip, projeto === p.id && styles.chipAtivo]}>
                    <Text style={[styles.chipTexto, projeto === p.id && { color: '#FFFFFF' }]} numberOfLines={1}>
                      {p.numero ? `Nº ${p.numero} · ` : ''}{p.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={styles.enderecoTopo}>
            <Text style={styles.rotulo}>Endereço da obra</Text>
            {!!endereco.trim() && (
              <Pressable onPress={() => abrirMapa(endereco)} hitSlop={8} style={styles.mapa}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={cor.marca} />
                <Text style={styles.mapaTexto}>Ver no mapa</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
            value={endereco}
            onChangeText={setEndereco}
            placeholder="Rua, número, bairro, cidade"
            placeholderTextColor="#93A3A5"
            multiline
          />

          <Text style={styles.rotulo}>Observações</Text>
          <TextInput
            style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Ex: levar trena a laser; portão fica nos fundos"
            placeholderTextColor="#93A3A5"
            multiline
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.botao, (pressed || salvando) && { backgroundColor: cor.marcaEscura }]}
          onPress={salvar}
          disabled={salvando}
        >
          {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar na agenda</Text>}
        </Pressable>
        {!novo && (
          <Pressable style={styles.excluir} onPress={excluir}>
            <Text style={styles.excluirTexto}>Excluir compromisso</Text>
          </Pressable>
        )}
      </ScrollView>

      <SeletorCliente
        visivel={seletorAberto}
        onSelecionar={(c) => escolherCliente(c)}
        onNovoCliente={() => {
          setSeletorAberto(false);
          setTimeout(() => router.push('/clientes/novo'), Platform.OS === 'ios' ? 450 : 0);
        }}
        onFechar={() => setSeletorAberto(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, paddingBottom: espaco.sm, ...sombra,
  },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: espaco.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: cor.borda,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao, maxWidth: '100%',
  },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  linha: { flexDirection: 'row', gap: espaco.sm },
  input: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: cor.texto, backgroundColor: cor.fundo, marginBottom: espaco.md,
  },
  atalhos: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: espaco.md },
  atalho: { backgroundColor: cor.marcaClara, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  atalhoTexto: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  escolha: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: cor.fundo, marginBottom: espaco.lg,
  },
  escolhido: { flex: 1, color: cor.texto, fontSize: 15, fontWeight: '700' },
  placeholder: { flex: 1, color: '#93A3A5', fontSize: 15 },
  enderecoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapa: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  mapaTexto: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  excluir: { alignItems: 'center', paddingVertical: 8 },
  excluirTexto: { color: cor.erro, fontSize: 15, fontWeight: '600' },
});
