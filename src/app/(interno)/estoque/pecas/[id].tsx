// src/app/(interno)/estoque/pecas/[id].tsx  ->  rota /estoque/pecas/<id>
//
// Ficha de uma peça pronta: saldo, custo, histórico, contagem e saída.

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MovimentoPeca, PecaPronta, movimentarPeca, obterPecaPronta } from '@/api/estoque';
import { reais } from '@/api/produtos';
import { SomentePro } from '@/components/plano/SomentePro';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';

const metros = (mm: number) => (mm / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function TelaPecaPronta() {
  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Peça pronta' }} />
      <SomentePro recurso="O estoque" descricao="Produza peças para o estoque e use-as nos projetos.">
        <Ficha />
      </SomentePro>
    </View>
  );
}

function Ficha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [peca, setPeca] = useState<(PecaPronta & { movimentos: MovimentoPeca[] }) | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [obs, setObs] = useState('');

  const carregar = useCallback(() => {
    obterPecaPronta(id).then(setPeca).catch((e) => Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.'));
  }, [id]);
  useFocusEffect(carregar);

  if (!peca) return <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />;

  async function registrar(motivo: 'contagem' | 'saida') {
    const q = parseInt(quantidade, 10);
    if (Number.isNaN(q)) return Alert.alert('Falta a quantidade', motivo === 'contagem' ? 'Quantas peças há agora?' : 'Quantas saíram?');
    try {
      await movimentarPeca(peca!.id, motivo, q, obs);
      setQuantidade('');
      setObs('');
      carregar();
    } catch (e: any) {
      Alert.alert('Não foi possível registrar', e?.message ?? 'Tente novamente.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <View style={styles.cartao}>
        <Text style={styles.nome}>{peca.nome}</Text>
        <Text style={styles.detalhe}>{metros(peca.largura_mm)} × {metros(peca.altura_mm)} m{peca.observacao ? ` · ${peca.observacao}` : ''}</Text>
        <Text style={styles.saldo}>{peca.saldo} {peca.saldo === 1 ? 'peça' : 'peças'}</Text>
        <Text style={styles.detalhe}>Custo do material: {reais(peca.custo_unitario)} por peça</Text>
      </View>

      <View style={styles.cartao}>
        <Text style={styles.rotulo}>Quantidade</Text>
        <TextInput style={[styles.input, { width: 100 }]} value={quantidade} onChangeText={(v) => setQuantidade(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Text style={styles.rotulo}>Observação (opcional)</Text>
        <TextInput style={styles.input} value={obs} onChangeText={setObs} placeholder="Ex: vendida no balcão" placeholderTextColor="#93A3A5" />
        <View style={styles.acoes}>
          <Pressable style={styles.secundario} onPress={() => registrar('contagem')}>
            <Text style={styles.secundarioTexto}>Contagem</Text>
          </Pressable>
          <Pressable style={styles.secundario} onPress={() => registrar('saida')}>
            <Text style={[styles.secundarioTexto, { color: cor.erro }]}>Saída</Text>
          </Pressable>
        </View>
        <Text style={styles.nota}>Contagem: o saldo passa a ser a quantidade informada. Saída: vendida avulsa ou descartada.</Text>
      </View>

      <Text style={styles.secao}>Histórico</Text>
      <View style={[styles.cartao, { padding: 0 }]}>
        {peca.movimentos.map((m, i) => (
          <Pressable key={m.id} disabled={!m.projeto} onPress={() => m.projeto && router.push(`/projetos/${m.projeto}`)} style={[styles.mov, i > 0 && styles.divisor]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.movTitulo}>{m.motivo_texto}</Text>
              <Text style={styles.detalhe} numberOfLines={2}>{new Date(m.criado_em).toLocaleDateString('pt-BR')}{m.observacao ? ` · ${m.observacao}` : ''}</Text>
            </View>
            <Text style={[styles.movQtd, { color: m.quantidade > 0 ? '#1E6B3A' : cor.erro }]}>{m.quantidade > 0 ? '+' : '−'}{Math.abs(m.quantidade)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  cartao: { backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda, padding: espaco.lg, ...sombra },
  nome: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  detalhe: { color: cor.textoSuave, fontSize: 13, marginTop: 2 },
  saldo: { color: cor.texto, fontSize: 26, fontWeight: '800', marginTop: espaco.md },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginTop: espaco.sm, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cor.texto, backgroundColor: cor.fundo },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
  secundario: { flex: 1, borderWidth: 1.5, borderColor: cor.marca, borderRadius: raio.botao, paddingVertical: 11, alignItems: 'center' },
  secundarioTexto: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  nota: { color: cor.textoSuave, fontSize: 12, marginTop: 6 },
  secao: { color: cor.texto, fontSize: 17, fontWeight: '800', marginTop: espaco.sm },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: espaco.md },
  divisor: { borderTopWidth: 1, borderTopColor: cor.borda },
  movTitulo: { color: cor.texto, fontSize: 14, fontWeight: '700' },
  movQtd: { fontSize: 16, fontWeight: '800' },
});
