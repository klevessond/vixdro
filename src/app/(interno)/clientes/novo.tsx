// src/app/(interno)/clientes/novo.tsx  ->  rota /clientes/novo
//
// O vidraceiro cadastra um cliente dele. Salva no celular primeiro
// (funciona sem internet) e enfileira o envio ao servidor.

import { Stack, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { CadastroClienteForm, DadosCliente } from '@/components/CadastroClienteForm';
import { COR } from '@/components/produtos/cores';
import { salvarClienteLocal } from '@/storage/clientesRepository';
import { sincronizar } from '@/sync/syncService';

export default function NovoCliente() {
  const router = useRouter();

  async function handleCadastrar(dados: DadosCliente) {
    // 1. Grava no celular e na fila. Se isto falhar, o formulário mostra o erro.
    await salvarClienteLocal(dados);

    // 2. Tenta enviar agora, sem esperar: se estiver sem internet, o
    //    cadastro continua seguro na fila e vai quando a conexão voltar.
    sincronizar().catch(() => {});

    router.back();
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Novo cliente' }} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <CadastroClienteForm onSubmeter={handleCadastrar} textoBotao="Salvar cliente" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
});
