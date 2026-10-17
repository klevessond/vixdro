// src/components/projetos/MedicaoProjeto.tsx
//
// Diário da medição dentro do projeto: fotos do vão e anotações ("parede
// fora de esquadro"), cada uma podendo ser marcada com a peça a que se
// refere. É interno: nada disto vai para o PDF do cliente.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RegistroMedicao, criarRegistro, editarRegistro, excluirRegistro, listarMedicao } from '@/api/medicao';
import { cor, espaco, raio, sombra } from '@/ui/tema';

type Props = { projetoId: string; pecas: string[] };

/** O que está sendo editado: um registro existente ou um novo (com ou sem foto). */
type Edicao =
  | { tipo: 'novo'; uri?: string; base64?: string }
  | { tipo: 'existente'; registro: RegistroMedicao };

function dataCurta(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function MedicaoProjeto({ projetoId, pecas }: Props) {
  const [registros, setRegistros] = useState<RegistroMedicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [vendo, setVendo] = useState<RegistroMedicao | null>(null);

  useEffect(() => {
    listarMedicao(projetoId)
      .then(setRegistros)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [projetoId]);

  async function pegarFoto(origem: 'camera' | 'galeria') {
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
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
    setEdicao({ tipo: 'novo', uri: foto.uri, base64: foto.base64 });
  }

  function salvo(r: RegistroMedicao) {
    setRegistros((lista) => [r, ...lista.filter((x) => x.id !== r.id)].sort((a, b) => b.criado_em.localeCompare(a.criado_em)));
    setEdicao(null);
  }

  function excluir(r: RegistroMedicao) {
    Alert.alert('Excluir', r.foto_url ? 'Excluir esta foto do projeto?' : 'Excluir esta anotação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirRegistro(r.id);
            setRegistros((l) => l.filter((x) => x.id !== r.id));
            setVendo(null);
            setEdicao(null);
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.cartao}>
      <View style={styles.cabecalho}>
        <View style={styles.icone}>
          <MaterialCommunityIcons name="camera-outline" size={20} color={cor.marca} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Medição</Text>
          <Text style={styles.subtitulo}>Fotos do vão e anotações. Só você vê.</Text>
        </View>
      </View>

      <View style={styles.botoes}>
        <Botao icone="camera" rotulo="Foto" onPress={() => pegarFoto('camera')} />
        <Botao icone="image-multiple-outline" rotulo="Galeria" onPress={() => pegarFoto('galeria')} />
        <Botao icone="note-edit-outline" rotulo="Anotação" onPress={() => setEdicao({ tipo: 'novo' })} />
      </View>

      {carregando && <ActivityIndicator style={{ marginVertical: 12 }} color={cor.marca} />}
      {!carregando && registros.length === 0 && (
        <Text style={styles.vazio}>Nada registrado ainda. Fotografe o vão e anote o que pode mudar o orçamento.</Text>
      )}

      {registros.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => (r.foto_url ? setVendo(r) : setEdicao({ tipo: 'existente', registro: r }))}
          style={({ pressed }) => [styles.registro, pressed && { backgroundColor: cor.marcaClara }]}
        >
          {r.miniatura_url ? (
            <Image source={{ uri: r.miniatura_url }} style={styles.miniatura} />
          ) : (
            <View style={[styles.miniatura, styles.notaIcone]}>
              <MaterialCommunityIcons name="text-box-outline" size={24} color={cor.marca} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {!!r.referencia && <Text style={styles.referencia}>{r.referencia}</Text>}
            {!!r.texto && <Text style={styles.texto} numberOfLines={3}>{r.texto}</Text>}
            <Text style={styles.data}>{dataCurta(r.criado_em)}</Text>
          </View>
        </Pressable>
      ))}

      {/* Foto em tela cheia */}
      <Modal visible={!!vendo} animationType="fade" onRequestClose={() => setVendo(null)}>
        <View style={styles.visor}>
          <View style={styles.visorTopo}>
            <Pressable onPress={() => setVendo(null)} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 22 }}>
              <Pressable onPress={() => vendo && setEdicao({ tipo: 'existente', registro: vendo })} hitSlop={10}>
                <MaterialCommunityIcons name="pencil-outline" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => vendo && excluir(vendo)} hitSlop={10}>
                <MaterialCommunityIcons name="trash-can-outline" size={26} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          {!!vendo?.foto_url && <Image source={{ uri: vendo.foto_url }} style={styles.visorFoto} resizeMode="contain" />}
          {(!!vendo?.referencia || !!vendo?.texto) && (
            <View style={styles.visorLegenda}>
              {!!vendo?.referencia && <Text style={styles.visorReferencia}>{vendo.referencia}</Text>}
              {!!vendo?.texto && <Text style={styles.visorTexto}>{vendo.texto}</Text>}
            </View>
          )}
        </View>

        {/* No iOS, a edição precisa abrir dentro do modal da foto. */}
        {!!vendo && !!edicao && (
          <EditorRegistro
            edicao={edicao}
            projetoId={projetoId}
            pecas={pecas}
            onSalvo={(r) => {
              salvo(r);
              setVendo(r);
            }}
            onExcluir={excluir}
            onFechar={() => setEdicao(null)}
          />
        )}
      </Modal>

      {!vendo && !!edicao && (
        <EditorRegistro
          edicao={edicao}
          projetoId={projetoId}
          pecas={pecas}
          onSalvo={salvo}
          onExcluir={excluir}
          onFechar={() => setEdicao(null)}
        />
      )}
    </View>
  );
}

function Botao({ icone, rotulo, onPress }: { icone: any; rotulo: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaClara }]}>
      <MaterialCommunityIcons name={icone} size={20} color={cor.marca} />
      <Text style={styles.botaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

// ---------- Legenda / anotação ----------

function EditorRegistro({
  edicao,
  projetoId,
  pecas,
  onSalvo,
  onExcluir,
  onFechar,
}: {
  edicao: Edicao;
  projetoId: string;
  pecas: string[];
  onSalvo: (r: RegistroMedicao) => void;
  onExcluir: (r: RegistroMedicao) => void;
  onFechar: () => void;
}) {
  const existente = edicao.tipo === 'existente' ? edicao.registro : null;
  const [texto, setTexto] = useState(existente?.texto ?? '');
  const [referencia, setReferencia] = useState(existente?.referencia ?? '');
  const [salvando, setSalvando] = useState(false);

  const fotoUri = edicao.tipo === 'novo' ? edicao.uri : existente?.miniatura_url ?? undefined;
  const ehAnotacao = !fotoUri;
  const nomesPecas = Array.from(new Set(pecas.filter(Boolean)));

  async function salvar() {
    if (ehAnotacao && !texto.trim()) {
      Alert.alert('Anotação vazia', 'Escreva o que foi observado na medição.');
      return;
    }
    setSalvando(true);
    try {
      const r = existente
        ? await editarRegistro(existente.id, { texto: texto.trim(), referencia })
        : await criarRegistro({
            projeto: projetoId,
            texto: texto.trim(),
            referencia,
            imagem_base64: edicao.tipo === 'novo' ? edicao.base64 : undefined,
          });
      onSalvo(r);
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.editor} contentContainerStyle={{ padding: espaco.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={styles.editorTopo}>
            <Text style={styles.editorTitulo}>
              {existente ? 'Editar' : ehAnotacao ? 'Nova anotação' : 'Nova foto'}
            </Text>
            <Pressable onPress={onFechar} hitSlop={10}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>

          {!!fotoUri && <Image source={{ uri: fotoUri }} style={styles.previa} resizeMode="cover" />}

          <Text style={styles.rotulo}>{ehAnotacao ? 'Anotação' : 'Legenda (opcional)'}</Text>
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ex: parede fora de esquadro, 8 mm de diferença na altura"
            placeholderTextColor="#93A3A5"
            multiline
            autoFocus={ehAnotacao && !existente}
          />

          {nomesPecas.length > 0 && (
            <>
              <Text style={styles.rotulo}>Peça (opcional)</Text>
              <View style={styles.chips}>
                {['', ...nomesPecas].map((n) => (
                  <Pressable key={n || '_nenhuma'} onPress={() => setReferencia(n)} style={[styles.chip, referencia === n && styles.chipAtivo]}>
                    <Text style={[styles.chipTexto, referencia === n && { color: '#FFFFFF' }]} numberOfLines={1}>
                      {n || 'Projeto todo'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Pressable style={[styles.salvar, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.salvarTexto}>{edicao.tipo === 'novo' && !ehAnotacao ? 'Enviar foto' : 'Salvar'}</Text>
            )}
          </Pressable>
          {existente && (
            <Pressable style={{ alignItems: 'center', paddingVertical: 14 }} onPress={() => onExcluir(existente)}>
              <Text style={{ color: cor.erro, fontSize: 15, fontWeight: '600' }}>Excluir</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, marginBottom: espaco.md, ...sombra,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: espaco.md },
  icone: { width: 34, height: 34, borderRadius: 9, backgroundColor: cor.marcaClara, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  subtitulo: { color: cor.textoSuave, fontSize: 13 },
  botoes: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.sm },
  botao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.botao, paddingVertical: 10,
  },
  botaoTexto: { color: cor.marca, fontSize: 14, fontWeight: '700' },
  vazio: { color: cor.textoSuave, fontSize: 14, lineHeight: 20, paddingVertical: espaco.sm },
  registro: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: cor.borda, borderRadius: 6 },
  miniatura: { width: 64, height: 64, borderRadius: 8, backgroundColor: cor.fundo },
  notaIcone: { alignItems: 'center', justifyContent: 'center', backgroundColor: cor.marcaClara },
  referencia: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  texto: { color: cor.texto, fontSize: 14, lineHeight: 19, marginTop: 1 },
  data: { color: cor.textoSuave, fontSize: 12, marginTop: 3 },
  visor: { flex: 1, backgroundColor: '#000000' },
  visorTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12 },
  visorFoto: { flex: 1, width: '100%' },
  visorLegenda: { padding: 20, paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.85)' },
  visorReferencia: { color: '#9FD3CC', fontSize: 14, fontWeight: '700' },
  visorTexto: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, marginTop: 2 },
  editor: { flex: 1, backgroundColor: cor.fundo },
  editorTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espaco.lg },
  editorTitulo: { color: cor.texto, fontSize: 20, fontWeight: '800' },
  link: { color: cor.marca, fontSize: 15, fontWeight: '700' },
  previa: { width: '100%', height: 220, borderRadius: raio.cartao, marginBottom: espaco.lg, backgroundColor: cor.cartao },
  rotulo: { color: cor.texto, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: cor.texto, backgroundColor: cor.cartao, marginBottom: espaco.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: espaco.lg },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: cor.cartao, maxWidth: '100%' },
  chipAtivo: { backgroundColor: cor.marca, borderColor: cor.marca },
  chipTexto: { color: cor.texto, fontSize: 14, fontWeight: '600' },
  salvar: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingVertical: 15, alignItems: 'center' },
  salvarTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
