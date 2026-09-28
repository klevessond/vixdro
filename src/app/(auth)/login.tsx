import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { ApiError } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';

// Paleta inspirada na borda do vidro float, aquele verde que aparece no corte.
const COR = {
  borda: "#1E5B57",
  bordaEscura: "#15433F",
  fundo: "#F1F5F4",
  campo: "#FFFFFF",
  contorno: "#C5D3D1",
  tinta: "#16292B",
  tintaSuave: "#546B6D",
  erro: "#A32121",
  erroFundo: "#FBECEC",
};

function mensagemDeErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Email ou senha incorretos.";
    if (e.status === 429) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    if (e.status >= 500) return "O servidor está com problemas. Tente de novo em instantes.";
    return e.message;
  }
  // fetch lança TypeError quando não consegue chegar ao servidor
  return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
}

export default function LoginScreen() {
  const { entrar } = useAuth();
  const { width } = useWindowDimensions();
  const senhaRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [focado, setFocado] = useState<"email" | "senha" | null>(null);

  async function handleEntrar() {
    if (enviando) return;
    if (!email.trim() || !senha) {
      setErro("Preencha o email e a senha.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      // O redirecionamento para a home é feito pelo useProtecaoDeRotas.
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.cabecalho}>
          <Text style={styles.marca}>vixdro</Text>
          <Text style={styles.subtitulo}>Orçamentos com seus fornecedores de vidro</Text>
        </View>
        {/* Corte diagonal, como a aresta de uma chapa */}
        <View
          style={[
            styles.corte,
            { borderRightWidth: width, borderTopColor: COR.borda },
          ]}
        />

        <View style={styles.formulario}>
          <Text style={styles.titulo}>Entrar</Text>

          {erro && (
            <View style={styles.caixaErro} accessibilityLiveRegion="polite">
              <Text style={styles.textoErro}>{erro}</Text>
            </View>
          )}

          <Text style={styles.rotulo}>Email</Text>
          <TextInput
            style={[styles.campo, focado === "email" && styles.campoFocado]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocado("email")}
            onBlur={() => setFocado(null)}
            placeholder="voce@suavidracaria.com.br"
            placeholderTextColor={COR.tintaSuave}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => senhaRef.current?.focus()}
            editable={!enviando}
          />

          <Text style={styles.rotulo}>Senha</Text>
          <View style={[styles.campoSenha, focado === "senha" && styles.campoFocado]}>
            <TextInput
              ref={senhaRef}
              style={styles.inputSenha}
              value={senha}
              onChangeText={setSenha}
              onFocus={() => setFocado("senha")}
              onBlur={() => setFocado(null)}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleEntrar}
              editable={!enviando}
            />
            <Pressable
              onPress={() => setMostrarSenha((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              <Text style={styles.alternarSenha}>{mostrarSenha ? "Ocultar" : "Mostrar"}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleEntrar}
            disabled={enviando}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.botao,
              (pressed || enviando) && { backgroundColor: COR.bordaEscura },
            ]}
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotao}>Entrar</Text>
            )}
          </Pressable>

          <View style={styles.rodape}>
            <Text style={styles.textoRodape}>Ainda não tem conta? </Text>
            <Link href="/(auth)/cadastro" style={styles.link}>
              Criar conta
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { flexGrow: 1 },
  cabecalho: {
    backgroundColor: COR.borda,
    paddingTop: 88,
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  marca: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  subtitulo: {
    color: "#D5E6E3",
    fontSize: 15,
    marginTop: 6,
  },
  corte: {
    width: 0,
    height: 0,
    borderTopWidth: 36,
    borderRightColor: "transparent",
  },
  formulario: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 40 },
  titulo: { color: COR.tinta, fontSize: 24, fontWeight: "700", marginBottom: 20 },
  caixaErro: {
    backgroundColor: COR.erroFundo,
    borderLeftWidth: 3,
    borderLeftColor: COR.erro,
    padding: 12,
    marginBottom: 16,
  },
  textoErro: { color: COR.erro, fontSize: 14, lineHeight: 20 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  campo: {
    backgroundColor: COR.campo,
    borderWidth: 1,
    borderColor: COR.contorno,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: COR.tinta,
    marginBottom: 18,
  },
  campoSenha: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COR.campo,
    borderWidth: 1,
    borderColor: COR.contorno,
    borderRadius: 6,
    paddingHorizontal: 14,
    marginBottom: 28,
  },
  campoFocado: { borderColor: COR.borda, borderWidth: 2 },
  inputSenha: { flex: 1, paddingVertical: 13, fontSize: 16, color: COR.tinta },
  alternarSenha: { color: COR.borda, fontSize: 14, fontWeight: "600", marginLeft: 12 },
  botao: {
    backgroundColor: COR.borda,
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  textoBotao: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  rodape: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  textoRodape: { color: COR.tintaSuave, fontSize: 15 },
  link: { color: COR.borda, fontSize: 15, fontWeight: "700" },
});
