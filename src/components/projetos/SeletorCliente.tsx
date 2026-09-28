// src/components/projetos/SeletorCliente.tsx
//
// Escolhe o cliente do projeto entre os clientes guardados no celular.
// Um cliente ainda não enviado ao servidor não pode ser usado (o servidor
// não o conhece): ao tocar nele, o app tenta enviar na hora.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { COR } from '@/components/produtos/cores';
import { ClienteLocal, listarClientesLocais } from '@/storage/clientesRepository';
import { sincronizar } from '@/sync/syncService';

type Props = {
  visivel: boolean;
  onSelecionar: (cliente: ClienteLocal) => void;
  onNovoCliente: () => void;
  onFechar: () => void;
};

export function SeletorCliente({ visivel, onSelecionar, onNovoCliente, onFechar }: Props) {
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => {
    if (visivel) listarClientesLocais().then(setClientes);
  }, [visivel]);

  async function escolher(c: ClienteLocal) {
    if (c.sincronizado) {
      onSelecionar(c);
      return;
    }
    setEnviando(c.id);
    try {
      await sincronizar();
    } catch {
      // tratado abaixo
    }
    const atualizados = await listarClientesLocais();
    setClientes(atualizados);
    setEnviando(null);
    const agora = atualizados.find((x) => x.id === c.id);
    if (agora?.sincronizado) onSelecionar(agora);
    else
      Alert.alert(
        'Cliente ainda não enviado',
        'Este cliente foi cadastrado sem internet e ainda não chegou ao servidor. Conecte-se e tente de novo.'
      );
  }

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? clientes.filter((c) => c.nome.toLowerCase().includes(termo) || c.nomeEmpresa.toLowerCase().includes(termo))
    : clientes;

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={styles.tela}>
        <View style={styles.topo}>
          <Text style={styles.titulo}>Cliente do projeto</Text>
          <Pressable onPress={onFechar} hitSlop={10}>
            <Text style={styles.link}>Fechar</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar cliente"
          placeholderTextColor={COR.tintaSuave}
        />
        <FlatList
          data={filtrados}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.divisor} />}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum cliente encontrado.</Text>}
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => escolher(c)}
              disabled={enviando !== null}
              style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{c.nome}</Text>
                {!!c.nomeEmpresa && <Text style={styles.detalhe}>{c.nomeEmpresa}</Text>}
              </View>
              {enviando === c.id ? (
                <ActivityIndicator color={COR.borda} />
              ) : (
                !c.sincronizado && <Text style={styles.pendente}>aguardando envio</Text>
              )}
            </Pressable>
          )}
        />
        <Pressable style={styles.novo} onPress={onNovoCliente}>
          <Text style={styles.link}>+ Cadastrar novo cliente</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, paddingTop: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  titulo: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  link: { color: COR.borda, fontSize: 16, fontWeight: '600' },
  busca: {
    marginHorizontal: 20, marginBottom: 8, backgroundColor: COR.superficie, borderWidth: 1,
    borderColor: COR.linha, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: COR.tinta,
  },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  nome: { color: COR.tinta, fontSize: 16, fontWeight: '600' },
  detalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  pendente: { color: COR.aviso, fontSize: 12, fontWeight: '600' },
  vazio: { color: COR.tintaSuave, fontSize: 15, textAlign: 'center', marginTop: 32 },
  novo: { padding: 20, paddingBottom: 36, alignItems: 'center', borderTopWidth: 1, borderTopColor: COR.linha },
});
