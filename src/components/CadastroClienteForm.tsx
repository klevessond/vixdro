// src/components/CadastroClienteForm.tsx
//
// Formulário reutilizável de cadastro de cliente.
// Usado tanto pela criação de conta do vidraceiro (com senha) quanto pela
// tela interna (vidraceiro cadastra um cliente dele, sem senha) - a
// diferença entre os dois fluxos fica na tela que envolve este componente.

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  InputAccessoryView,
  Keyboard,
  Platform,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { LARGURA_FORMULARIO, cor, espaco, raio, sombra } from "@/ui/tema";
import { SeletorEstado } from "./SeletorEstado";

type NomeIcone = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface DadosCliente {
  nome: string;
  nomeEmpresa: string;
  email: string;
  celular: string;
  cpfCnpj: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const DADOS_INICIAIS: DadosCliente = {
  nome: "",
  nomeEmpresa: "",
  email: "",
  celular: "",
  cpfCnpj: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

type Erros = Partial<Record<keyof DadosCliente, string>>;

// No iPhone, os teclados numéricos não têm tecla de confirmar. Estes
// campos ganham uma barra com o botão "Concluído" acima do teclado.
const ID_BARRA_TECLADO = "barra-teclado-cadastro";
const TECLADOS_SEM_CONFIRMAR = ["numeric", "phone-pad", "number-pad", "decimal-pad"];

interface CadastroClienteFormProps {
  // Chamado quando o formulário passa na validação e o botão é pressionado.
  // A tela que usa este componente decide o que fazer com os dados
  // (chamar a API, etc.) - este componente não sabe nada sobre a API.
  // Quando comSenha está ativo, a senha chega no segundo argumento.
  onSubmeter: (dados: DadosCliente, senha?: string) => Promise<void>;
  textoBotao?: string;
  // Campos extras que só fazem sentido no cadastro interno
  // (ex: um seletor de vendedor responsável) podem ser injetados aqui.
  camposExtras?: React.ReactNode;
  // Mostra os campos de senha e confirmação (usado na criação de conta).
  comSenha?: boolean;
  // CPF/CNPJ obrigatório? Na conta do vidraceiro sim (vai no orçamento e no
  // pedido ao fornecedor); no cadastro de um cliente, é opcional.
  cpfObrigatorio?: boolean;
  // E-mail obrigatório? Na conta do vidraceiro sim (é o login); no
  // cadastro de um cliente, é opcional.
  emailObrigatorio?: boolean;
}

const SENHA_MINIMA = 6;

export function CadastroClienteForm({
  onSubmeter,
  textoBotao = "Cadastrar",
  camposExtras,
  comSenha = false,
  cpfObrigatorio = true,
  emailObrigatorio = true,
}: CadastroClienteFormProps) {
  // Tela larga (computador/tablet): campos lado a lado.
  const { width } = useWindowDimensions();
  const largo = width >= 680;
  const [dados, setDados] = useState<DadosCliente>(DADOS_INICIAIS);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [errosSenha, setErrosSenha] = useState<{ senha?: string; confirmar?: string }>({});
  const numeroRef = useRef<TextInput>(null);

  function atualizarCampo<K extends keyof DadosCliente>(campo: K, valor: DadosCliente[K]) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
    // limpa o erro do campo assim que o usuário começa a corrigir
    if (erros[campo]) {
      setErros((prev) => ({ ...prev, [campo]: undefined }));
    }
  }

  function formatarCelular(texto: string): string {
    const numeros = texto.replace(/\D/g, "").slice(0, 11);
    if (numeros.length <= 2) return numeros;
    if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  function formatarCep(texto: string): string {
    const numeros = texto.replace(/\D/g, "").slice(0, 8);
    if (numeros.length <= 5) return numeros;
    return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
  }

  function formatarCpfCnpj(texto: string): string {
    const numeros = texto.replace(/\D/g, "").slice(0, 14);
    if (numeros.length <= 11) {
      // CPF: 000.000.000-00
      return numeros
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    // CNPJ: 00.000.000/0000-00
    return numeros
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  async function buscarEnderecoPeloCep(cepFormatado: string) {
    const cepNumeros = cepFormatado.replace(/\D/g, "");
    if (cepNumeros.length !== 8) return;

    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
      const json = await resposta.json();

      if (json.erro) {
        setErros((prev) => ({ ...prev, cep: "CEP não encontrado" }));
        Keyboard.dismiss(); // fecha o teclado para o aviso ficar visível
        return;
      }

      setDados((prev) => ({
        ...prev,
        rua: json.logradouro || prev.rua,
        bairro: json.bairro || prev.bairro,
        cidade: json.localidade || prev.cidade,
        estado: json.uf || prev.estado,
      }));

      // Endereço preenchido: o próximo dado que falta é o número.
      numeroRef.current?.focus();
    } catch {
      // Falha de rede na busca de CEP não deve travar o cadastro -
      // o usuário ainda pode preencher o endereço manualmente.
      Alert.alert(
        "Não foi possível buscar o CEP",
        "Verifique sua conexão ou preencha o endereço manualmente."
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  function validar(): boolean {
    const novosErros: Erros = {};

    if (!dados.nome.trim()) novosErros.nome = "Informe o nome";
    if (!dados.email.trim()) {
      if (emailObrigatorio) novosErros.email = "Informe o e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
      novosErros.email = "E-mail inválido";
    }
    if (dados.celular.replace(/\D/g, "").length < 10) {
      novosErros.celular = "Celular inválido";
    }
    const cpfCnpjNumeros = dados.cpfCnpj.replace(/\D/g, "");
    const cpfVazio = cpfCnpjNumeros.length === 0;
    // Opcional pode ficar vazio, mas se for preenchido precisa estar completo.
    if (!(cpfVazio && !cpfObrigatorio) && cpfCnpjNumeros.length !== 11 && cpfCnpjNumeros.length !== 14) {
      novosErros.cpfCnpj = cpfVazio ? "Informe o CPF ou CNPJ" : "CPF ou CNPJ incompleto";
    }
    if (dados.cep.replace(/\D/g, "").length !== 8) novosErros.cep = "CEP inválido";
    if (!dados.rua.trim()) novosErros.rua = "Informe a rua";
    if (!dados.numero.trim()) novosErros.numero = "Informe o número";
    if (!dados.bairro.trim()) novosErros.bairro = "Informe o bairro";
    if (!dados.cidade.trim()) novosErros.cidade = "Informe a cidade";
    if (!dados.estado) novosErros.estado = "Selecione o estado";

    const novosErrosSenha: { senha?: string; confirmar?: string } = {};
    if (comSenha) {
      if (senha.length < SENHA_MINIMA) {
        novosErrosSenha.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`;
      }
      if (confirmarSenha !== senha) {
        novosErrosSenha.confirmar = "As senhas não são iguais";
      }
    }

    setErros(novosErros);
    setErrosSenha(novosErrosSenha);
    return (
      Object.keys(novosErros).length === 0 && Object.keys(novosErrosSenha).length === 0
    );
  }

  async function handleSubmeter() {
    if (!validar()) return;

    setEnviando(true);
    try {
      await onSubmeter(dados, comSenha ? senha : undefined);
    } catch (erro) {
      Alert.alert(
        "Erro ao cadastrar",
        erro instanceof Error ? erro.message : "Tente novamente em instantes."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Secao icone="card-account-details-outline" titulo="Dados de contato">
        <Linha largo={largo}>
          <Campo
            label="Nome"
            valor={dados.nome}
            onAlterar={(v) => atualizarCampo("nome", v)}
            erro={erros.nome}
            placeholder="Nome completo"
            autoCapitalizar="words"
          />
          <Campo
            label="Nome da empresa"
            valor={dados.nomeEmpresa}
            onAlterar={(v) => atualizarCampo("nomeEmpresa", v)}
            placeholder="Opcional, se for pessoa física"
          />
        </Linha>
        <Linha largo={largo}>
          <Campo
            label={emailObrigatorio ? "E-mail" : "E-mail (opcional)"}
            valor={dados.email}
            onAlterar={(v) => atualizarCampo("email", v)}
            erro={erros.email}
            placeholder="voce@exemplo.com"
            teclado="email-address"
            autoCapitalizar="none"
          />
          <Campo
            label="Celular"
            valor={dados.celular}
            onAlterar={(v) => atualizarCampo("celular", formatarCelular(v))}
            erro={erros.celular}
            placeholder="(00) 00000-0000"
            teclado="phone-pad"
          />
        </Linha>
        <Linha largo={largo}>
          <Campo
            label={cpfObrigatorio ? "CPF ou CNPJ" : "CPF ou CNPJ (opcional)"}
            valor={dados.cpfCnpj}
            onAlterar={(v) => atualizarCampo("cpfCnpj", formatarCpfCnpj(v))}
            erro={erros.cpfCnpj}
            placeholder="000.000.000-00"
            teclado="numeric"
          />
          {largo ? <View /> : null}
        </Linha>
      </Secao>

      <Secao icone="map-marker-outline" titulo="Endereço">
        <Linha largo={largo} proporcao={[1, 2]}>
          <View>
            <Campo
              label="CEP"
              valor={dados.cep}
              onAlterar={(v) => {
                const formatado = formatarCep(v);
                atualizarCampo("cep", formatado);
                if (formatado.replace(/\D/g, "").length === 8) {
                  buscarEnderecoPeloCep(formatado);
                }
              }}
              erro={erros.cep}
              placeholder="00000-000"
              teclado="numeric"
            />
            {buscandoCep && <ActivityIndicator style={styles.loadingCep} size="small" color={cor.marca} />}
          </View>
          <Campo
            label="Rua"
            valor={dados.rua}
            onAlterar={(v) => atualizarCampo("rua", v)}
            erro={erros.rua}
            placeholder="Preenchida pelo CEP"
          />
        </Linha>
        <Linha largo proporcao={[1, 2]}>
          <Campo
            label="Número"
            valor={dados.numero}
            onAlterar={(v) => atualizarCampo("numero", v)}
            erro={erros.numero}
            placeholder="123"
            // Aceita letras também: endereços como "S/N" ou "120-A".
            teclado="numbers-and-punctuation"
            autoCapitalizar="characters"
            refInput={numeroRef}
          />
          <Campo
            label="Complemento"
            valor={dados.complemento}
            onAlterar={(v) => atualizarCampo("complemento", v)}
            placeholder="Sala, bloco (opcional)"
          />
        </Linha>
        <Linha largo={largo}>
          <Campo
            label="Bairro"
            valor={dados.bairro}
            onAlterar={(v) => atualizarCampo("bairro", v)}
            erro={erros.bairro}
          />
          <Campo
            label="Cidade"
            valor={dados.cidade}
            onAlterar={(v) => atualizarCampo("cidade", v)}
            erro={erros.cidade}
          />
        </Linha>
        <SeletorEstado
          valor={dados.estado}
          onSelecionar={(sigla) => atualizarCampo("estado", sigla)}
          erro={erros.estado}
        />
      </Secao>

      {comSenha && (
        <Secao icone="lock-outline" titulo="Acesso ao app">
          <Linha largo={largo}>
            <Campo
              label="Senha"
              valor={senha}
              onAlterar={(v) => {
                setSenha(v);
                if (errosSenha.senha) setErrosSenha((p) => ({ ...p, senha: undefined }));
              }}
              erro={errosSenha.senha}
              placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`}
              senha
            />
            <Campo
              label="Confirme a senha"
              valor={confirmarSenha}
              onAlterar={(v) => {
                setConfirmarSenha(v);
                if (errosSenha.confirmar) setErrosSenha((p) => ({ ...p, confirmar: undefined }));
              }}
              erro={errosSenha.confirmar}
              senha
            />
          </Linha>
        </Secao>
      )}

      {camposExtras}

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={ID_BARRA_TECLADO}>
          <View style={styles.barraTeclado}>
            <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={10}>
              <Text style={styles.barraTecladoBotao}>Concluído</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      <TouchableOpacity
        style={[styles.botao, largo && styles.botaoLargo, enviando && styles.botaoDesabilitado]}
        onPress={handleSubmeter}
        disabled={enviando}
        activeOpacity={0.85}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botaoTexto}>{textoBotao}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// --- Seção em cartão, com ícone e título ---

function Secao({ icone, titulo, children }: { icone: NomeIcone; titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.cartao}>
      <View style={styles.secaoCabecalho}>
        <View style={styles.secaoIcone}>
          <MaterialCommunityIcons name={icone} size={20} color={cor.marca} />
        </View>
        <Text style={styles.secao}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

// --- Campos lado a lado na tela larga; um embaixo do outro no celular ---

function Linha({
  largo,
  proporcao,
  children,
}: {
  largo: boolean;
  proporcao?: number[];
  children: React.ReactNode;
}) {
  const filhos = React.Children.toArray(children);
  if (!largo) return <>{filhos}</>;
  return (
    <View style={styles.linha}>
      {filhos.map((filho, i) => (
        <View key={i} style={{ flex: proporcao?.[i] ?? 1, minWidth: 0 }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

// --- Campo de texto interno, só para não repetir o mesmo bloco 12 vezes ---

interface CampoProps {
  label: string;
  valor: string;
  onAlterar: (valor: string) => void;
  erro?: string;
  placeholder?: string;
  teclado?: "default" | "email-address" | "phone-pad" | "numeric" | "numbers-and-punctuation";
  autoCapitalizar?: "none" | "sentences" | "words" | "characters";
  refInput?: React.Ref<TextInput>;
  senha?: boolean;
}

function Campo({
  label,
  valor,
  onAlterar,
  erro,
  placeholder,
  teclado = "default",
  autoCapitalizar = "sentences",
  senha = false,
  refInput,
}: CampoProps) {
  return (
    <View style={styles.campoContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={refInput}
        style={[styles.input, erro ? styles.inputErro : null]}
        value={valor}
        onChangeText={onAlterar}
        placeholder={placeholder}
        placeholderTextColor="#93A3A5"
        keyboardType={teclado}
        autoCapitalize={senha ? "none" : autoCapitalizar}
        autoCorrect={!senha}
        secureTextEntry={senha}
        textContentType={senha ? "newPassword" : undefined}
        inputAccessoryViewID={
          Platform.OS === "ios" && TECLADOS_SEM_CONFIRMAR.includes(teclado) ? ID_BARRA_TECLADO : undefined
        }
      />
      {erro ? <Text style={styles.textoErro}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: espaco.lg, width: "100%", maxWidth: LARGURA_FORMULARIO, alignSelf: "center" },
  cartao: {
    backgroundColor: cor.cartao,
    borderRadius: raio.cartao,
    borderWidth: 1,
    borderColor: cor.borda,
    padding: espaco.lg,
    paddingBottom: espaco.xs,
    marginBottom: espaco.lg,
    ...sombra,
  },
  secaoCabecalho: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: espaco.lg },
  secaoIcone: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: cor.marcaClara,
    alignItems: "center", justifyContent: "center",
  },
  secao: { fontSize: 16, fontWeight: "800", color: cor.texto },
  campoContainer: { marginBottom: espaco.lg },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, color: cor.texto },
  input: {
    borderWidth: 1,
    borderColor: cor.borda,
    borderRadius: raio.campo,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: cor.texto,
    backgroundColor: cor.fundo,
  },
  inputErro: { borderColor: cor.erro, backgroundColor: cor.erroFundo },
  textoErro: { color: cor.erro, fontSize: 12, marginTop: 4 },
  linha: { flexDirection: "row", gap: espaco.lg },
  loadingCep: { position: "absolute", right: 12, top: 36 },
  botao: {
    backgroundColor: cor.marca,
    borderRadius: raio.botao,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: espaco.xs,
  },
  botaoLargo: { alignSelf: "flex-end", paddingHorizontal: 40 },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  barraTeclado: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#F1F1F3",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C7C7CC",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  barraTecladoBotao: { color: cor.marca, fontSize: 16, fontWeight: "700" },
});
