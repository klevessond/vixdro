// src/app/(auth)/cadastro.tsx
//
// Criação de conta do vidraceiro. Envia direto para o servidor (precisa de
// internet) e, se der certo, o vidraceiro já sai logado: o
// useProtecaoDeRotas leva para a tela inicial sozinho.

import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { CadastroClienteForm, DadosCliente } from '@/components/CadastroClienteForm';

const COR = {
  borda: '#1E5B57',
  fundo: '#F1F5F4',
  tintaSuave: '#546B6D',
};

export default function CadastroScreen() {
  const { cadastrar } = useAuth();

  async function handleSubmeter(dados: DadosCliente, senha?: string) {
    try {
      await cadastrar({
        nome: dados.nome.trim(),
        empresa: dados.nomeEmpresa.trim(),
        email: dados.email,
        celular: dados.celular,
        cpf_cnpj: dados.cpfCnpj,
        cep: dados.cep,
        rua: dados.rua.trim(),
        numero: dados.numero.trim(),
        complemento: dados.complemento.trim(),
        bairro: dados.bairro.trim(),
        cidade: dados.cidade.trim(),
        estado: dados.estado,
        password: senha ?? '',
      });
    } catch (e) {
      // O formulário mostra a mensagem do erro num alerta.
      if (e instanceof ApiError) throw e;
      throw new Error('Sem conexão com o servidor. Para criar a conta é preciso estar com internet.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.conteudo}>
        <View style={styles.cabecalho}>
          <Text style={styles.titulo}>Criar conta</Text>
          <Text style={styles.subtitulo}>
            Seus dados aparecem nos orçamentos que você enviar aos clientes.
          </Text>
        </View>

        <CadastroClienteForm onSubmeter={handleSubmeter} textoBotao="Criar conta" comSenha />

        <View style={styles.rodape}>
          <Text style={styles.textoRodape}>Já tem conta? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Entrar
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingBottom: 40 },
  cabecalho: {
    backgroundColor: COR.borda,
    paddingTop: 72,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  titulo: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitulo: { color: '#D5E6E3', fontSize: 15, lineHeight: 21, marginTop: 6 },
  rodape: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  textoRodape: { color: COR.tintaSuave, fontSize: 15 },
  link: { color: COR.borda, fontSize: 15, fontWeight: '700' },
});
