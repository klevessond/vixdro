// src/app/(interno)/clientes/index.tsx  ->  rota /clientes
//
// Lista os clientes guardados no celular (funciona offline). Ao abrir,
// dispara a sincronização em segundo plano e atualiza a lista quando ela
// termina, trazendo clientes criados no site ou em outro aparelho.

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { COR } from '@/components/produtos/cores';
import { ClienteLocal, listarClientesLocais } from '@/storage/clientesRepository';
import { sincronizar } from '@/sync/syncService';

function formatarCelular(numeros: string) {
  if (numeros.length < 10) return numeros;
  const meio = numeros.length === 11 ? 7 : 6;
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, meio)}-${numeros.slice(meio)}`;
}

export default function ListaClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [busca, setBusca] = useState('');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const carregar = () => listarClientesLocais().then((l) => ativo && setClientes(l));
      carregar();
      sincronizar()
        .then(carregar)
        .catch(() => {}); // sem internet: a lista local já está na tela
      return () => {
        ativo = false;
      };
    }, [])
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.nomeEmpresa.toLowerCase().includes(termo) ||
        c.celular.includes(termo.replace(/\D/g, '') || '§')
    );
  }, [clientes, busca]);

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Clientes' }} />

      {clientes.length > 0 && (
        <TextInput
          style={styles.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome, empresa ou celular"
          placeholderTextColor={COR.tintaSuave}
          clearButtonMode="while-editing"
        />
      )}

      <FlatList
        data={filtrados}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.divisor} />}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTitulo}>
              {clientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            </Text>
            {!clientes.length && (
              <Text style={styles.vazioTexto}>
                Cadastre quem vai receber seus orçamentos. Funciona mesmo sem internet: o
                cadastro é enviado assim que a conexão voltar.
              </Text>
            )}
          </View>
        }
        renderItem={({ item: c }) => (
          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{c.nome}</Text>
              <Text style={styles.detalhe}>
                {[c.nomeEmpresa, formatarCelular(c.celular), c.cidade].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {!c.sincronizado && <Text style={styles.pendente}>aguardando envio</Text>}
          </View>
        )}
      />

      <View style={styles.rodape}>
        <Pressable
          style={({ pressed }) => [styles.botao, pressed && { backgroundColor: COR.bordaEscura }]}
          onPress={() => router.push('/clientes/novo')}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Novo cliente</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  busca: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: COR.superficie,
    borderWidth: 1,
    borderColor: COR.linha,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: COR.tinta,
  },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COR.superficie,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  nome: { color: COR.tinta, fontSize: 16, fontWeight: '700' },
  detalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  pendente: { color: COR.aviso, fontSize: 12, fontWeight: '600' },
  vazio: { padding: 32, alignItems: 'center' },
  vazioTitulo: { color: COR.tinta, fontSize: 18, fontWeight: '700' },
  vazioTexto: { color: COR.tintaSuave, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  rodape: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: COR.linha, backgroundColor: COR.fundo },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
