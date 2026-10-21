// src/app/(interno)/configuracoes/plano.tsx  ->  rota /configuracoes/plano
//
// Plano da conta e o que cada um inclui. Por enquanto o Pro é liberado à mão:
// o botão "Quero o Pro" fala com a equipe vixdro pelo WhatsApp.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { WHATSAPP_EQUIPE_VIXDRO } from '@/config/vixdro';
import { usePlano } from '@/hooks/usePlano';
import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from '@/ui/tema';
import { abrirWhatsApp } from '@/util/contato';

function dataBR(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function MeuPlano() {
  const { vidraceiro } = useAuth();
  const { plano, carregando } = usePlano();

  function pedirPro() {
    if (!WHATSAPP_EQUIPE_VIXDRO) {
      Alert.alert('Fale com a equipe vixdro', 'Entre em contato com a equipe vixdro para liberar o plano Pro na sua conta.');
      return;
    }
    const msg =
      `Olá! Sou ${vidraceiro?.nome}${vidraceiro?.empresa ? `, da ${vidraceiro.empresa}` : ''} ` +
      `(${vidraceiro?.email}) e quero conhecer o plano Pro do vixdro.`;
    abrirWhatsApp(WHATSAPP_EQUIPE_VIXDRO, msg).catch(() =>
      Alert.alert('Não foi possível abrir o WhatsApp', 'Entre em contato com a equipe vixdro.')
    );
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Stack.Screen options={{ headerShown: true, title: 'Meu plano' }} />
      {carregando || !plano ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={cor.marca} />
      ) : (
        <>
          <View style={[styles.atual, plano.pro && styles.atualPro]}>
            <MaterialCommunityIcons name={plano.pro ? 'crown' : 'account-outline'} size={28} color={plano.pro ? '#FFFFFF' : cor.marca} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.atualRotulo, plano.pro && { color: cor.textoSobreMarcaSuave }]}>Seu plano</Text>
              <Text style={[styles.atualNome, plano.pro && { color: '#FFFFFF' }]}>{plano.pro ? 'Pro' : 'Gratuito'}</Text>
              {plano.pro && (
                <Text style={{ color: cor.textoSobreMarcaSuave, fontSize: 13 }}>
                  {plano.validade
                    ? `Válido até ${dataBR(plano.validade)} (${plano.dias_restantes} ${plano.dias_restantes === 1 ? 'dia' : 'dias'})`
                    : 'Sem prazo de validade'}
                </Text>
              )}
              {plano.expirado && <Text style={styles.expirado}>Seu plano Pro venceu.</Text>}
            </View>
          </View>

          <Coluna titulo="Gratuito" itens={plano.recursos.gratuito} destaque={!plano.pro} />
          <Coluna titulo="Pro" itens={plano.recursos.pro} destaque={plano.pro} pro />

          {!plano.pro && (
            <Pressable style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaEscura }]} onPress={pedirPro}>
              <MaterialCommunityIcons name="crown-outline" size={20} color="#FFFFFF" />
              <Text style={styles.botaoTexto}>{plano.expirado ? 'Renovar o Pro' : 'Quero o Pro'}</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Coluna({ titulo, itens, destaque, pro = false }: { titulo: string; itens: string[]; destaque: boolean; pro?: boolean }) {
  return (
    <View style={[styles.cartao, destaque && { borderColor: cor.marca, borderWidth: 2 }]}>
      <View style={styles.cartaoTopo}>
        {pro && <MaterialCommunityIcons name="crown-outline" size={20} color={cor.marca} />}
        <Text style={styles.cartaoTitulo}>{titulo}</Text>
        {destaque && <Text style={styles.seu}>seu plano</Text>}
      </View>
      {itens.map((i) => (
        <View key={i} style={styles.item}>
          <MaterialCommunityIcons name="check" size={18} color={cor.marca} />
          <Text style={[styles.itemTexto, i.includes('(em breve)') && { color: cor.textoSuave }]}>{i}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, width: '100%', maxWidth: LARGURA_FORMULARIO, alignSelf: 'center', paddingBottom: espaco.xxl },
  atual: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: cor.cartao, borderRadius: raio.cartao,
    borderWidth: 1, borderColor: cor.borda, padding: espaco.lg, ...sombra,
  },
  atualPro: { backgroundColor: cor.marca, borderColor: cor.marca },
  atualRotulo: { color: cor.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  atualNome: { color: cor.texto, fontSize: 24, fontWeight: '800' },
  expirado: { color: cor.erro, fontSize: 13, fontWeight: '600', marginTop: 2 },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, gap: 8, ...sombra,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cartaoTitulo: { color: cor.texto, fontSize: 18, fontWeight: '800' },
  seu: { marginLeft: 'auto', color: cor.marca, fontSize: 12, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  itemTexto: { color: cor.texto, fontSize: 15, lineHeight: 20, flex: 1 },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: cor.marca,
    borderRadius: raio.botao, paddingVertical: 15, marginTop: espaco.sm,
  },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
