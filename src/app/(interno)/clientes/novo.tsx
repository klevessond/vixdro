// src/app/(interno)/clientes/novo.tsx
//
// Tela interna: um usuário da equipe (vendedor, atendente) cadastra
// um cliente em nome dele. Reaproveita o MESMO formulário da tela
// self-service - só muda o texto do botão e um campo extra opcional.

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { CadastroClienteForm, DadosCliente } from "../../../components/CadastroClienteForm";

export default function NovoClienteInternoScreen() {
  async function handleCadastrar(dados: DadosCliente) {
    // TODO: chamada real à API, autenticada com o token do usuário interno
    // logado (o header Authorization deve ser incluído aqui, ou melhor
    // ainda, num cliente HTTP central que já injeta o token automaticamente).
    console.log("Cadastro interno de cliente:", dados);

    await new Promise((resolve) => setTimeout(resolve, 800));

    router.back();
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Novo cliente</Text>
        <Text style={styles.subtitulo}>Cadastro realizado pela equipe.</Text>
      </View>

      <CadastroClienteForm onSubmeter={handleCadastrar} textoBotao="Salvar cliente" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  cabecalho: { padding: 16, paddingTop: 24 },
  titulo: { fontSize: 24, fontWeight: "800", color: "#111" },
  subtitulo: { fontSize: 14, color: "#666", marginTop: 4 },
});