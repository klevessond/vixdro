// src/app/cadastro-cliente.tsx
//
// Tela self-service: o próprio cliente preenche seus dados.
// Salva LOCALMENTE primeiro (SQLite) e enfileira a sincronização - o
// cadastro funciona mesmo sem internet, e é enviado à API automaticamente
// quando a conexão estiver disponível.

import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { CadastroClienteForm, DadosCliente } from "../components/CadastroClienteForm";
import { salvarClienteLocal } from "../storage/clientesRepository";
import { sincronizar } from "../sync/syncService";

export default function CadastroClienteScreen() {
  async function handleCadastrar(dados: DadosCliente) {
    try {
      // 1. Salva local + enfileira para sincronizar - isso sempre funciona,
      //    com ou sem internet, porque é só escrita em SQLite.
      await salvarClienteLocal(dados);
    } catch (erro) {
      // Erro real de gravação local precisa aparecer para o usuário -
      // nunca falhar em silêncio aqui.
      console.error("Erro ao salvar cliente localmente:", erro);
      Alert.alert(
        "Erro ao salvar",
        erro instanceof Error ? erro.message : "Não foi possível salvar o cadastro localmente."
      );
      return; // não navega se não conseguiu salvar
    }

    // 2. Tenta sincronizar agora mesmo, caso já haja internet - mas não
    //    trava o fluxo do usuário se isso falhar, porque o item já está
    //    seguro na fila e será reenviado automaticamente depois.
    sincronizar().catch((erro) => console.warn("Sincronização adiada:", erro));

    router.back(); // volta para a tela anterior (Home), já que agora é uma tela empilhada
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Criar cadastro</Text>
        <Text style={styles.subtitulo}>
          Preencha seus dados para começar a usar o app.
        </Text>
      </View>

      <CadastroClienteForm onSubmeter={handleCadastrar} textoBotao="Criar cadastro" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  cabecalho: { padding: 16, paddingTop: 24 },
  titulo: { fontSize: 24, fontWeight: "800", color: "#111" },
  subtitulo: { fontSize: 14, color: "#666", marginTop: 4 },
});