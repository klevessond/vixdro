// src/components/projetos/BotaoListaCompraPdf.tsx
//
// "Lista de compra em PDF": escolhe quais itens (todos, só do catálogo do
// fornecedor ou só os próprios) e se leva preços. Sem preços serve para pedir
// cotação a outro fornecedor.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuaisItens } from '@/pdf/listaCompraHtml';
import { cor, espaco, raio } from '@/ui/tema';

type Props = { gerar: (quais: QuaisItens, comPrecos: boolean) => Promise<void> };

const OPCOES: { valor: QuaisItens; rotulo: string; ajuda: string }[] = [
  { valor: 'todos', rotulo: 'Todos os itens', ajuda: 'Catálogo do fornecedor e itens próprios, separados.' },
  { valor: 'proprios', rotulo: 'Só os itens próprios', ajuda: 'O que você compra fora do pedido (vidro, por exemplo).' },
  { valor: 'catalogo', rotulo: 'Só os do catálogo', ajuda: 'Os mesmos itens do pedido à Alumínio Seridó.' },
];

export function BotaoListaCompraPdf({ gerar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [quais, setQuais] = useState<QuaisItens>('todos');
  const [comPrecos, setComPrecos] = useState(false);
  const [gerando, setGerando] = useState(false);

  async function confirmar() {
    setGerando(true);
    try {
      await gerar(quais, comPrecos);
      setAberto(false);
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Pressable style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaClara }]} onPress={() => setAberto(true)} accessibilityRole="button">
        <MaterialCommunityIcons name="file-pdf-box" size={20} color={cor.marca} />
        <Text style={styles.botaoTexto}>Lista de compra em PDF</Text>
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={styles.fundo}>
          <View style={styles.caixa}>
            <Text style={styles.titulo}>Lista de compra em PDF</Text>
            <Text style={styles.ajuda}>Para pedir a outro fornecedor ou conferir a compra. Não leva os dados do cliente.</Text>

            <Text style={styles.rotulo}>Quais itens</Text>
            {OPCOES.map((o) => (
              <Pressable key={o.valor} onPress={() => setQuais(o.valor)} style={[styles.opcao, quais === o.valor && styles.opcaoAtiva]}>
                <MaterialCommunityIcons name={quais === o.valor ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={cor.marca} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcaoTitulo}>{o.rotulo}</Text>
                  <Text style={styles.opcaoAjuda}>{o.ajuda}</Text>
                </View>
              </Pressable>
            ))}

            <Pressable style={styles.marcar} onPress={() => setComPrecos((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: comPrecos }}>
              <MaterialCommunityIcons name={comPrecos ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={cor.marca} />
              <View style={{ flex: 1 }}>
                <Text style={styles.opcaoTitulo}>Mostrar preços</Text>
                <Text style={styles.opcaoAjuda}>Desmarcado, serve para pedir cotação sem mostrar quanto você paga hoje.</Text>
              </View>
            </Pressable>

            <View style={styles.acoes}>
              <Pressable style={styles.cancelar} onPress={() => setAberto(false)}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.gerar, gerando && { opacity: 0.7 }]} onPress={confirmar} disabled={gerando}>
                {gerando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gerarTexto}>Gerar PDF</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: cor.marca,
    borderRadius: raio.botao, paddingVertical: 11, marginBottom: 10, backgroundColor: cor.cartao,
  },
  botaoTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  fundo: { flex: 1, backgroundColor: 'rgba(22,41,43,0.45)', justifyContent: 'center', padding: espaco.lg },
  caixa: { backgroundColor: cor.cartao, borderRadius: raio.cartao, padding: espaco.xl, width: '100%', maxWidth: 520, alignSelf: 'center', gap: 6 },
  titulo: { color: cor.texto, fontSize: 19, fontWeight: '800' },
  ajuda: { color: cor.textoSuave, fontSize: 13, marginBottom: espaco.sm },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm },
  opcao: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, padding: espaco.md },
  opcaoAtiva: { borderColor: cor.marca, backgroundColor: cor.marcaClara },
  opcaoTitulo: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  opcaoAjuda: { color: cor.textoSuave, fontSize: 12, marginTop: 1 },
  marcar: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: espaco.md },
  acoes: { flexDirection: 'row', gap: 10, marginTop: espaco.lg },
  cancelar: { borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  cancelarTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  gerar: { flex: 1, backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 13, alignItems: 'center' },
  gerarTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
