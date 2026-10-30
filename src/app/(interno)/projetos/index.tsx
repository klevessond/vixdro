// src/app/(interno)/projetos/index.tsx  ->  rota /projetos
//
// Projetos em cartões, com o cliente em destaque. A busca procura por nome
// do projeto, nº do orçamento, nome/empresa, celular ou CPF/CNPJ do cliente.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ProjetoResumo, StatusProjeto, infoStatus, listarProjetos } from '@/api/projetos';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** "hoje", "ontem", "há 5 dias", "há 3 semanas", "há 2 meses". */
function haQuanto(iso: string) {
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(new Date()) - inicio(new Date(iso))) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  if (dias < 60) return `há ${Math.floor(dias / 7)} semanas`;
  return `há ${Math.floor(dias / 30)} meses`;
}

// Filtros da lista (os da obra em andamento primeiro).
const FILTROS: { valor: StatusProjeto | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'rascunho', rotulo: 'Rascunho' },
  { valor: 'enviado', rotulo: 'Enviado ao cliente' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'concluido', rotulo: 'Concluído' },
  { valor: 'recusado', rotulo: 'Recusado' },
];

export default function ListaProjetos() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusProjeto | ''>('');
  const statusAtual = useRef<StatusProjeto | ''>('');
  const buscaAtual = useRef('');
  const ultimaConsulta = useRef(0);

  const carregar = useCallback(async (termo: string) => {
    const id = ++ultimaConsulta.current;
    setErro(null);
    try {
      const lista = await listarProjetos(termo, statusAtual.current || undefined);
      if (id === ultimaConsulta.current) setProjetos(lista); // ignora respostas atrasadas
    } catch (e: any) {
      if (id === ultimaConsulta.current) setErro(e?.message ?? 'Sem conexão com o servidor.');
    } finally {
      if (id === ultimaConsulta.current) setCarregando(false);
    }
  }, []);

  // Recarrega ao voltar para a tela, mantendo a busca que estava digitada.
  useFocusEffect(
    useCallback(() => {
      carregar(buscaAtual.current);
    }, [carregar])
  );

  function escolherStatus(s: StatusProjeto | '') {
    statusAtual.current = s;
    setStatus(s);
    setCarregando(true);
    carregar(buscaAtual.current);
  }

  // Espera parar de digitar antes de buscar.
  useEffect(() => {
    buscaAtual.current = busca;
    const timer = setTimeout(() => carregar(busca), 350);
    return () => clearTimeout(timer);
  }, [busca, carregar]);

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Projetos' }} />

      <View style={styles.topo}>
        <View style={styles.busca}>
          <MaterialCommunityIcons name="magnify" size={20} color={cor.textoSuave} />
          <TextInput
            style={styles.buscaInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Cliente, projeto, nº, celular ou CPF/CNPJ"
            placeholderTextColor="#93A3A5"
            autoCorrect={false}
            returnKeyType="search"
          />
          {!!busca && (
            <Pressable onPress={() => setBusca('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={cor.textoSuave} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.novo, pressed && { backgroundColor: cor.marcaEscura }]}
          onPress={() => router.push('/projetos/novo')}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={20} color={cor.textoSobreMarca} />
          <Text style={styles.novoTexto}>Novo</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosBarra} contentContainerStyle={styles.filtros}>
        {FILTROS.map((f) => (
          <Pressable key={f.valor || 'todos'} onPress={() => escolherStatus(f.valor)} style={[styles.filtro, status === f.valor && styles.filtroAtivo]}>
            <Text style={[styles.filtroTexto, status === f.valor && { color: '#FFFFFF' }]}>{f.rotulo}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />
      ) : (
        <FlatList
          data={projetos}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={erro ? <Text style={styles.erro}>{erro}</Text> : null}
          ListEmptyComponent={
            !erro ? (
              <View style={styles.vazio}>
                <MaterialCommunityIcons name="floor-plan" size={42} color={cor.textoSuave} />
                <Text style={styles.vazioTitulo}>{busca.trim() ? 'Nada encontrado' : 'Nenhum projeto ainda'}</Text>
                <Text style={styles.vazioTexto}>
                  {busca.trim()
                    ? `Nenhum projeto com "${busca.trim()}".`
                    : 'Escolha um cliente, adicione janelas, portas e boxes com as medidas, e gere o orçamento.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: p }) => {
            const st = infoStatus(p.status);
            const pecas = p.total_pecas ?? 0;
            const feitas = p.pecas_concluidas ?? 0;
            return (
              <Pressable
                onPress={() => router.push(`/projetos/${p.id}`)}
                style={({ pressed }) => [styles.cartao, pressed && { borderColor: cor.marca }]}
              >
                <View style={styles.cartaoTopo}>
                  {!!p.numero && <Text style={styles.numero}>Nº {p.numero}</Text>}
                  <View style={styles.data}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={cor.marca} />
                    <Text style={styles.dataTexto}>{dataCurta(p.atualizado_em)}</Text>
                    <Text style={styles.dataRelativa}>· {haQuanto(p.atualizado_em)}</Text>
                  </View>
                  <View style={[styles.etiqueta, { backgroundColor: st.cor + '1A' }]}>
                    <Text style={[styles.etiquetaTexto, { color: st.cor }]}>{st.rotulo}</Text>
                  </View>
                </View>
                <View style={styles.cliente}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={cor.marca} />
                  <Text style={styles.clienteNome} numberOfLines={1}>{p.cliente_nome || 'Sem cliente'}</Text>
                </View>
                <Text style={styles.nome} numberOfLines={2}>{p.nome}</Text>
                {feitas > 0 && pecas > 0 && (
                  <View style={styles.progresso}>
                    <View style={styles.progressoFundo}>
                      <View style={[styles.progressoCheio, { width: `${(100 * feitas) / pecas}%` }]} />
                    </View>
                    <Text style={styles.progressoTexto}>
                      {feitas === pecas ? 'concluído' : `${feitas}/${pecas} concluídas`}
                    </Text>
                  </View>
                )}
                <View style={styles.rodape}>
                  <Text style={styles.detalhe}>
                    {pecas} {pecas === 1 ? 'peça' : 'peças'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={cor.textoSuave} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: {
    flexDirection: 'row', gap: espaco.sm, padding: espaco.lg, paddingBottom: espaco.sm,
    width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center',
  },
  busca: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cor.cartao,
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12,
  },
  buscaInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: cor.texto },
  novo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cor.marca,
    borderRadius: raio.botao, paddingHorizontal: 14,
  },
  novoTexto: { color: cor.textoSobreMarca, fontSize: 15, fontWeight: '700' },
  lista: { padding: espaco.lg, paddingTop: espaco.sm, gap: espaco.md, flexGrow: 1, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center' },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, ...sombra,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  filtrosBarra: { flexGrow: 0, flexShrink: 0, minHeight: 44 },
  filtros: { gap: 8, paddingHorizontal: espaco.lg, paddingBottom: espaco.sm, maxWidth: LARGURA_FORMULARIO },
  filtro: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: cor.cartao },
  filtroAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  filtroTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  data: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 },
  dataTexto: { color: cor.marca, fontSize: 13, fontWeight: '800' },
  dataRelativa: { color: cor.textoSuave, fontSize: 13 },
  numero: { color: cor.textoSuave, fontSize: 13, fontWeight: '700' },
  etiqueta: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 'auto' },
  etiquetaTexto: { fontSize: 12, fontWeight: '700' },
  cliente: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clienteNome: { color: cor.texto, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  nome: { color: cor.textoSuave, fontSize: 15, marginTop: 4 },
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: cor.borda, marginTop: espaco.md, paddingTop: espaco.sm,
  },
  detalhe: { color: cor.textoSuave, fontSize: 13 },
  progresso: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressoFundo: { flex: 1, height: 6, borderRadius: 3, backgroundColor: cor.marcaClara, overflow: 'hidden' },
  progressoCheio: { height: '100%', borderRadius: 3, backgroundColor: '#1E6B3A' },
  progressoTexto: { color: cor.textoSuave, fontSize: 12, fontWeight: '600' },
  erro: { color: cor.erro, fontSize: 14, marginBottom: espaco.sm },
  vazio: { padding: espaco.xxl, alignItems: 'center', gap: 6 },
  vazioTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  vazioTexto: { color: cor.textoSuave, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
