// src/app/(interno)/configuracoes/empresa.tsx  ->  rota /configuracoes/empresa
//
// Logomarca da vidraçaria. Ela aparece no topo do orçamento em PDF.

import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Logo, enviarLogo, obterLogo, removerLogo } from '@/api/empresa';
import { COR } from '@/components/produtos/cores';

export default function MinhaEmpresa() {
  const { vidraceiro } = useAuth();
  const [logo, setLogo] = useState<Logo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    obterLogo().then(setLogo).catch(() => setLogo({ logo_url: null, logo_data_uri: null }));
  }, []);

  async function escolher() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true, // a imagem vai para o servidor como texto, junto do login
    });
    if (resultado.canceled || !resultado.assets[0]?.base64) return;

    setOcupado(true);
    try {
      setLogo(await enviarLogo(resultado.assets[0].base64));
    } catch (e: any) {
      Alert.alert('Não foi possível enviar', e?.message ?? 'Tente uma imagem menor.');
    } finally {
      setOcupado(false);
    }
  }

  function remover() {
    Alert.alert('Remover logomarca', 'Os próximos orçamentos sairão sem a logomarca.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removerLogo();
            setLogo({ logo_url: null, logo_data_uri: null });
          } catch (e: any) {
            Alert.alert('Não foi possível remover', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  const imagem = logo?.logo_data_uri ?? logo?.logo_url;

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ headerShown: true, title: 'Minha empresa' }} />
      <Text style={styles.empresa}>{vidraceiro?.empresa || vidraceiro?.nome}</Text>
      <Text style={styles.ajuda}>
        A logomarca aparece no topo dos orçamentos em PDF. Prefira uma imagem com fundo branco
        ou transparente.
      </Text>

      <View style={styles.quadro}>
        {logo === null || ocupado ? (
          <ActivityIndicator color={COR.borda} />
        ) : imagem ? (
          <Image source={{ uri: imagem }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text style={styles.semLogo}>Nenhuma logomarca</Text>
        )}
      </View>

      <Pressable style={styles.botao} onPress={escolher} disabled={ocupado}>
        <Text style={styles.botaoTexto}>{imagem ? 'Trocar logomarca' : 'Escolher logomarca'}</Text>
      </Pressable>
      {!!imagem && (
        <Pressable style={styles.remover} onPress={remover} disabled={ocupado}>
          <Text style={styles.removerTexto}>Remover logomarca</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, padding: 20 },
  empresa: { color: COR.tinta, fontSize: 20, fontWeight: '700' },
  ajuda: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  quadro: {
    height: 180, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, backgroundColor: COR.superficie,
    alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 18,
  },
  logo: { width: '100%', height: '100%' },
  semLogo: { color: COR.tintaSuave, fontSize: 15 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center' },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  remover: { alignItems: 'center', paddingVertical: 16 },
  removerTexto: { color: COR.erro, fontSize: 15, fontWeight: '600' },
});
