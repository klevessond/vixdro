// src/components/SeletorEstado.tsx
// Dropdown de UF: usa um Modal com FlatList porque o <Picker> nativo
// tem comportamento diferente entre Android e iOS - isso fica igual nos dois.

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { ESTADOS_BRASIL, Estado } from "../constants/estados-brasil";

interface SeletorEstadoProps {
  valor: string; // sigla selecionada, ex: "RN"
  onSelecionar: (sigla: string) => void;
  erro?: string;
}

export function SeletorEstado({ valor, onSelecionar, erro }: SeletorEstadoProps) {
  const [aberto, setAberto] = useState(false);

  const estadoSelecionado = ESTADOS_BRASIL.find((e) => e.sigla === valor);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Estado</Text>
      <TouchableOpacity
        style={[styles.campo, erro ? styles.campoErro : null]}
        onPress={() => setAberto(true)}
      >
        <Text style={estadoSelecionado ? styles.textoSelecionado : styles.placeholder}>
          {estadoSelecionado
            ? `${estadoSelecionado.sigla} - ${estadoSelecionado.nome}`
            : "Selecione o estado"}
        </Text>
      </TouchableOpacity>
      {erro ? <Text style={styles.textoErro}>{erro}</Text> : null}

      <Modal visible={aberto} animationType="slide" transparent>
        <View style={styles.modalFundo}>
          <View style={styles.modalConteudo}>
            <View style={styles.modalCabecalho}>
              <Text style={styles.modalTitulo}>Selecione o estado</Text>
              <TouchableOpacity onPress={() => setAberto(false)}>
                <Text style={styles.modalFechar}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={ESTADOS_BRASIL}
              keyExtractor={(item) => item.sigla}
              renderItem={({ item }: { item: Estado }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    onSelecionar(item.sigla);
                    setAberto(false);
                  }}
                >
                  <Text style={styles.itemTexto}>
                    {item.sigla} - {item.nome}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: "#333" },
  campo: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  campoErro: { borderColor: "#e53e3e" },
  placeholder: { color: "#999", fontSize: 16 },
  textoSelecionado: { color: "#000", fontSize: 16 },
  textoErro: { color: "#e53e3e", fontSize: 12, marginTop: 4 },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalConteudo: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 24,
  },
  modalCabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitulo: { fontSize: 16, fontWeight: "700" },
  modalFechar: { color: "#007AFF", fontSize: 16 },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  itemTexto: { fontSize: 16 },
});