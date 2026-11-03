// src/components/imagem/FotoEditavel.tsx
//
// Foto com os botões Câmera, Galeria e Remover. Reaproveitável: produtos,
// peças prontas e o que vier. Quem usa decide o que fazer com a foto
// (onEnviar recebe o base64 já pronto para a API).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cor, espaco, raio } from '@/ui/tema';

type Props = {
  url?: string | null;
  podeEditar?: boolean;
  onEnviar: (base64: string) => Promise<void>;
  onRemover?: () => Promise<void>;
  textoRemover?: string; // ex: "Usar a foto do produto"
  ajuda?: string;
};

export function FotoEditavel({ url, podeEditar = true, onEnviar, onRemover, textoRemover = 'Remover', ajuda }: Props) {
  const [enviando, setEnviando] = useState(false);

  async function escolher(origem: 'camera' | 'galeria') {
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: true };
    let resultado: ImagePicker.ImagePickerResult;
    if (origem === 'camera') {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Sem acesso à câmera', 'Libere o acesso à câmera nas configurações do celular.');
        return;
      }
      resultado = await ImagePicker.launchCameraAsync(opcoes);
    } else {
      resultado = await ImagePicker.launchImageLibraryAsync(opcoes);
    }
    const foto = resultado.canceled ? null : resultado.assets[0];
    if (!foto?.base64) return;
    setEnviando(true);
    try {
      await onEnviar(foto.base64);
    } catch (e: any) {
      Alert.alert('Não foi possível enviar a foto', e?.message ?? 'Confira a internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!onRemover) return;
    setEnviando(true);
    try {
      await onRemover();
    } catch (e: any) {
      Alert.alert('Não foi possível remover', e?.message ?? 'Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.caixa}>
      <View style={styles.quadro}>
        {enviando ? (
          <ActivityIndicator color={cor.marca} />
        ) : url ? (
          <Image source={{ uri: url }} style={styles.foto} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="image-outline" size={40} color={cor.textoSuave} />
        )}
      </View>
      {podeEditar && (
        <View style={{ flex: 1, gap: 8 }}>
          {!!ajuda && <Text style={styles.ajuda}>{ajuda}</Text>}
          <View style={styles.botoes}>
            <Pressable style={styles.botao} onPress={() => escolher('camera')} disabled={enviando}>
              <MaterialCommunityIcons name="camera" size={18} color={cor.marca} />
              <Text style={styles.botaoTexto}>Câmera</Text>
            </Pressable>
            <Pressable style={styles.botao} onPress={() => escolher('galeria')} disabled={enviando}>
              <MaterialCommunityIcons name="image-multiple-outline" size={18} color={cor.marca} />
              <Text style={styles.botaoTexto}>Galeria</Text>
            </Pressable>
          </View>
          {!!url && !!onRemover && (
            <Pressable onPress={remover} disabled={enviando} hitSlop={6}>
              <Text style={styles.remover}>{textoRemover}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { flexDirection: 'row', gap: espaco.lg, alignItems: 'center' },
  quadro: {
    width: 120, height: 120, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  foto: { width: '100%', height: '100%' },
  ajuda: { color: cor.textoSuave, fontSize: 12, lineHeight: 17 },
  botoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: cor.borda,
    borderRadius: raio.botao, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: cor.cartao,
  },
  botaoTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  remover: { color: cor.erro, fontSize: 14, fontWeight: '600' },
});
