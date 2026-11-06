// src/components/imagem/MiniaturaAmpliavel.tsx
//
// Miniatura que, ao ser tocada, abre a foto grande em tela cheia. Funciona
// também dentro de outra janela (como a escolha de produto do projeto).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  miniatura: string; // a imagem pequena, mostrada na lista
  imagem?: string | null; // a grande, mostrada ao tocar (sem ela, usa a miniatura)
  titulo?: string;
  tamanho?: number;
};

export function MiniaturaAmpliavel({ miniatura, imagem, titulo, tamanho = 48 }: Props) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Pressable onPress={() => setAberta(true)} hitSlop={4} accessibilityRole="imagebutton" accessibilityLabel={titulo ? `Ver foto: ${titulo}` : 'Ver foto'}>
        <Image source={{ uri: miniatura }} style={[styles.mini, { width: tamanho, height: tamanho }]} />
      </Pressable>
      <VisualizadorImagem url={aberta ? imagem || miniatura : null} titulo={titulo} onFechar={() => setAberta(false)} />
    </>
  );
}

/** Foto em tela cheia, sobre fundo escuro. url null = fechado. */
export function VisualizadorImagem({ url, titulo, onFechar }: { url: string | null; titulo?: string; onFechar: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar a foto">
        <View style={styles.topo}>
          {!!titulo && <Text style={styles.titulo} numberOfLines={2}>{titulo}</Text>}
          <MaterialCommunityIcons name="close" size={30} color="#FFFFFF" />
        </View>
        {!!url && <Image source={{ uri: url }} style={styles.foto} resizeMode="contain" />}
        <Text style={styles.dica}>Toque em qualquer lugar para fechar</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mini: { borderRadius: 8, backgroundColor: '#E6EFED' },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  topo: { position: 'absolute', top: 48, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1 },
  titulo: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  foto: { width: '100%', height: '75%', maxWidth: 1000 },
  dica: { position: 'absolute', bottom: 36, color: '#BBBBBB', fontSize: 13 },
});
