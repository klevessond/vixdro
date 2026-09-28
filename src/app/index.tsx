// src/app/index.tsx  (tela inicial, depois do login)
//
// Mostra as ações do app na ordem em que o vidraceiro trabalha:
// primeiro o cliente, depois o projeto para esse cliente.
// O catálogo de produtos fica separado, porque é montado uma vez e reutilizado.

import { Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';

const COR = {
  borda: '#1E5B57',
  bordaClara: '#E3EEEC',
  fundo: '#F1F5F4',
  superficie: '#FFFFFF',
  linha: '#D6E1DF',
  tinta: '#16292B',
  tintaSuave: '#546B6D',
};

type Acao = {
  titulo: string;
  descricao: string;
  destino: Href;
  disponivel: boolean;
};

const DIA_A_DIA: Acao[] = [
    {
    titulo: 'Clientes',
    descricao: 'Cadastre e consulte quem recebe seus orçamentos.',
    destino: '/clientes',
    disponivel: true,
  },
  {
    titulo: 'Projetos',
    descricao: 'Escolha um cliente e adicione janelas, portas e boxes com as medidas.',
    destino: '/projetos',
    disponivel: true,
  }
];

const CATALOGO: Acao[] = [
  {
    titulo: 'Produtos',
    descricao: 'Monte seus modelos com os perfis, acessórios e vedações de cada um.',
    destino: '/produtos',
    disponivel: true,
  },
];

function primeiroNome(nome?: string) {
  return nome?.trim().split(/\s+/)[0] ?? '';
}

function Linha({ acao }: { acao: Acao }) {
  const router = useRouter();
  return (
    <Pressable
      disabled={!acao.disponivel}
      onPress={() => router.push(acao.destino)}
      accessibilityRole="button"
      accessibilityState={{ disabled: !acao.disponivel }}
      style={({ pressed }) => [styles.linha, pressed && { backgroundColor: COR.bordaClara }]}
    >
      <View style={styles.linhaTexto}>
        <Text style={[styles.linhaTitulo, !acao.disponivel && { color: COR.tintaSuave }]}>
          {acao.titulo}
        </Text>
        <Text style={styles.linhaDescricao}>{acao.descricao}</Text>
      </View>
      {acao.disponivel ? (
        <Text style={styles.seta}>›</Text>
      ) : (
        <Text style={styles.emBreve}>Em breve</Text>
      )}
    </Pressable>
  );
}

function Grupo({ titulo, acoes }: { titulo: string; acoes: Acao[] }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.grupoTitulo}>{titulo}</Text>
      <View style={styles.grupoCaixa}>
        {acoes.map((a, i) => (
          <View key={a.titulo}>
            {i > 0 && <View style={styles.divisor} />}
            <Linha acao={a} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Inicio() {
  const { vidraceiro, sair } = useAuth();

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View style={styles.cabecalho}>
        <Text style={styles.ola}>Olá, {primeiroNome(vidraceiro?.nome)}</Text>
        {!!vidraceiro?.empresa && <Text style={styles.empresa}>{vidraceiro.empresa}</Text>}
      </View>

      <Grupo titulo="Atendimento" acoes={DIA_A_DIA} />
      <Grupo titulo="Seu catálogo" acoes={CATALOGO} />

      <Pressable onPress={sair} accessibilityRole="button" style={styles.sair} hitSlop={8}>
        <Text style={styles.sairTexto}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingBottom: 40 },
  cabecalho: {
    backgroundColor: COR.borda,
    paddingTop: 72,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  ola: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  empresa: { color: '#D5E6E3', fontSize: 15, marginTop: 4 },
  grupo: { marginTop: 28, paddingHorizontal: 16 },
  grupoTitulo: {
    color: COR.tintaSuave,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 8,
  },
  grupoCaixa: {
    backgroundColor: COR.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COR.linha,
    overflow: 'hidden',
  },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 16 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  linhaTexto: { flex: 1, paddingRight: 12 },
  linhaTitulo: { color: COR.tinta, fontSize: 17, fontWeight: '700' },
  linhaDescricao: { color: COR.tintaSuave, fontSize: 14, lineHeight: 20, marginTop: 2 },
  seta: { color: COR.borda, fontSize: 28, fontWeight: '300' },
  emBreve: { color: COR.tintaSuave, fontSize: 13 },
  sair: { alignSelf: 'center', marginTop: 36, padding: 8 },
  sairTexto: { color: COR.borda, fontSize: 15, fontWeight: '600' },
});
