// src/app/(interno)/projetos/index.tsx  ->  rota /projetos

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProjetoResumo, infoStatus, listarProjetos } from '@/api/projetos';
import { COR } from '@/components/produtos/cores';

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ListaProjetos() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setErro(null);
      listarProjetos()
        .then((l) => ativo && setProjetos(l))
        .catch((e) => ativo && setErro(e?.message ?? 'Sem conexão com o servidor.'))
        .finally(() => ativo && setCarregando(false));
      return () => {
        ativo = false;
      };
    }, [])
  );

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Projetos' }} />
      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      ) : (
        <FlatList
          data={projetos}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListHeaderComponent={erro ? <Text style={styles.erro}>{erro}</Text> : null}
          ListEmptyComponent={
            !erro ? (
              <View style={styles.vazio}>
                <Text style={styles.vazioTitulo}>Nenhum projeto ainda</Text>
                <Text style={styles.vazioTexto}>
                  Escolha um cliente, adicione as janelas, portas e boxes com as medidas, e veja o
                  custo e a lista de compra.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => router.push(`/projetos/${p.id}`)}
              style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>
                  {p.numero ? <Text style={styles.numero}>nº {p.numero}  </Text> : null}
                  {p.nome}
                </Text>
                <Text style={styles.detalhe}>
                  {p.cliente_nome} · {p.total_pecas ?? 0} {p.total_pecas === 1 ? 'peça' : 'peças'} ·{' '}
                  {dataCurta(p.atualizado_em)}
                </Text>
              </View>
              <Text style={[styles.status, { color: infoStatus(p.status).cor }]}>{infoStatus(p.status).rotulo}</Text>
              <Text style={styles.seta}>›</Text>
            </Pressable>
          )}
        />
      )}
      <View style={styles.rodape}>
        <Pressable
          style={({ pressed }) => [styles.botao, pressed && { backgroundColor: COR.bordaEscura }]}
          onPress={() => router.push('/projetos/novo')}
        >
          <Text style={styles.botaoTexto}>Novo projeto</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', backgroundColor: COR.superficie, paddingHorizontal: 20, paddingVertical: 16 },
  nome: { color: COR.tinta, fontSize: 17, fontWeight: '700' },
  numero: { color: COR.tintaSuave, fontSize: 15, fontWeight: '600' },
  detalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  seta: { color: COR.borda, fontSize: 28, fontWeight: '300', marginLeft: 8 },
  status: { fontSize: 13, fontWeight: '700' },
  erro: { color: COR.erro, fontSize: 14, padding: 20 },
  vazio: { padding: 32, alignItems: 'center' },
  vazioTitulo: { color: COR.tinta, fontSize: 18, fontWeight: '700' },
  vazioTexto: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  rodape: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: COR.linha, backgroundColor: COR.fundo },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
