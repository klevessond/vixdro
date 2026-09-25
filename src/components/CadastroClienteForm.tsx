// src/components/CadastroClienteForm.tsx
//
// Formulário reutilizável de cadastro de cliente.
// Usado tanto pela tela self-service (cliente se cadastra) quanto pela
// tela interna (equipe cadastra cliente) - a diferença entre os dois
// fluxos fica na tela que envolve este componente, não aqui dentro.

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SeletorEstado } from "./SeletorEstado";

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

interface CadastroClienteFormProps {
  // Chamado quando o formulário passa na validação e o botão é pressionado.
  // A tela que usa este componente decide o que fazer com os dados
  // (chamar a API, etc.) - este componente não sabe nada sobre a API.
  onSubmeter: (dados: DadosCliente) => Promise<void>;
  textoBotao?: string;
  // Campos extras que só fazem sentido no cadastro interno
  // (ex: um seletor de vendedor responsável) podem ser injetados aqui.
  camposExtras?: React.ReactNode;
}

export function CadastroClienteForm({
  onSubmeter,
  textoBotao = "Cadastrar",
  camposExtras,
}: CadastroClienteFormProps) {
  const [dados, setDados] = useState<DadosCliente>(DADOS_INICIAIS);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

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
        return;
      }

      setDados((prev) => ({
        ...prev,
        rua: json.logradouro || prev.rua,
        bairro: json.bairro || prev.bairro,
        cidade: json.localidade || prev.cidade,
        estado: json.uf || prev.estado,
      }));
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
      novosErros.email = "Informe o e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
      novosErros.email = "E-mail inválido";
    }
    if (dados.celular.replace(/\D/g, "").length < 10) {
      novosErros.celular = "Celular inválido";
    }
    const cpfCnpjNumeros = dados.cpfCnpj.replace(/\D/g, "");
    if (cpfCnpjNumeros.length !== 11 && cpfCnpjNumeros.length !== 14) {
      novosErros.cpfCnpj = "CPF ou CNPJ inválido";
    }
    if (dados.cep.replace(/\D/g, "").length !== 8) novosErros.cep = "CEP inválido";
    if (!dados.rua.trim()) novosErros.rua = "Informe a rua";
    if (!dados.numero.trim()) novosErros.numero = "Informe o número";
    if (!dados.bairro.trim()) novosErros.bairro = "Informe o bairro";
    if (!dados.cidade.trim()) novosErros.cidade = "Informe a cidade";
    if (!dados.estado) novosErros.estado = "Selecione o estado";

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function handleSubmeter() {
    if (!validar()) return;

    setEnviando(true);
    try {
      await onSubmeter(dados);
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
      <Text style={styles.secao}>Dados de contato</Text>

      <Campo
        label="Nome"
        valor={dados.nome}
        onAlterar={(v) => atualizarCampo("nome", v)}
        erro={erros.nome}
        placeholder="Seu nome completo"
      />
      <Campo
        label="Nome da empresa"
        valor={dados.nomeEmpresa}
        onAlterar={(v) => atualizarCampo("nomeEmpresa", v)}
        placeholder="Opcional, se for pessoa física"
      />
      <Campo
        label="E-mail"
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
      <Campo
        label="CPF ou CNPJ"
        valor={dados.cpfCnpj}
        onAlterar={(v) => atualizarCampo("cpfCnpj", formatarCpfCnpj(v))}
        erro={erros.cpfCnpj}
        placeholder="000.000.000-00"
        teclado="numeric"
      />

      <Text style={styles.secao}>Endereço</Text>

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
        {buscandoCep && (
          <ActivityIndicator style={styles.loadingCep} size="small" color="#007AFF" />
        )}
      </View>

      <Campo
        label="Rua"
        valor={dados.rua}
        onAlterar={(v) => atualizarCampo("rua", v)}
        erro={erros.rua}
        placeholder="Preenchido automaticamente pelo CEP"
      />

      <View style={styles.linha}>
        <View style={styles.colunaPequena}>
          <Campo
            label="Número"
            valor={dados.numero}
            onAlterar={(v) => atualizarCampo("numero", v)}
            erro={erros.numero}
            placeholder="123"
            teclado="numeric"
          />
        </View>
        <View style={styles.colunaGrande}>
          <Campo
            label="Complemento"
            valor={dados.complemento}
            onAlterar={(v) => atualizarCampo("complemento", v)}
            placeholder="Sala, bloco, etc. (opcional)"
          />
        </View>
      </View>

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

      <SeletorEstado
        valor={dados.estado}
        onSelecionar={(sigla) => atualizarCampo("estado", sigla)}
        erro={erros.estado}
      />

      {camposExtras}

      <TouchableOpacity
        style={[styles.botao, enviando && styles.botaoDesabilitado]}
        onPress={handleSubmeter}
        disabled={enviando}
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

// --- Campo de texto interno, só para não repetir o mesmo bloco 12 vezes ---

interface CampoProps {
  label: string;
  valor: string;
  onAlterar: (valor: string) => void;
  erro?: string;
  placeholder?: string;
  teclado?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalizar?: "none" | "sentences" | "words";
}

function Campo({
  label,
  valor,
  onAlterar,
  erro,
  placeholder,
  teclado = "default",
  autoCapitalizar = "sentences",
}: CampoProps) {
  return (
    <View style={styles.campoContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, erro ? styles.inputErro : null]}
        value={valor}
        onChangeText={onAlterar}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={teclado}
        autoCapitalize={autoCapitalizar}
      />
      {erro ? <Text style={styles.textoErro}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  secao: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 8,
    marginBottom: 12,
  },
  campoContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputErro: { borderColor: "#e53e3e" },
  textoErro: { color: "#e53e3e", fontSize: 12, marginTop: 4 },
  linha: { flexDirection: "row", gap: 12 },
  colunaPequena: { width: "30%" },
  colunaGrande: { width: "66%" },
  loadingCep: { position: "absolute", right: 12, top: 38 },
  botao: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});