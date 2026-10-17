// src/app/index.tsx  (tela inicial, depois do login)
//
// Painel em cartões: cada um mostra um número que importa, o que se faz
// ali e um botão de ação. Se adapta à largura: 3 colunas no computador,
// 2 no tablet, 1 no celular.
//
// A margem de lucro fica escondida até tocar no olho: o orçamento pode
// ser montado na frente do cliente.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { ComponentProps, ReactNode, useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Painel, obterPainel } from '@/api/painel';
import { numero } from '@/api/produtos';
import { useAuth } from '@/auth/AuthContext';
import { LARGURA_CONTEUDO, colunasPara, cor, espaco, raio, sombra } from '@/ui/tema';

type NomeIcone = ComponentProps<typeof MaterialCommunityIcons>['name'];

function primeiroNome(nome?: string) {
  return nome?.trim().split(/\s+/)[0] ?? '';
}

function iniciais(nome?: string) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function Inicio() {
  const { vidraceiro, sair } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colunas = colunasPara(width);

  const [painel, setPainel] = useState<Painel | null>(null);
  const [mostrarMargem, setMostrarMargem] = useState(false);

  // Atualiza ao voltar para a tela, e esconde a margem de novo.
  useFocusEffect(
    useCallback(() => {
      setMostrarMargem(false);
      obterPainel().then(setPainel).catch(() => {});
    }, [])
  );

  const n = (valor: number | undefined) => (painel ? String(valor ?? 0) : '–');
  const ir = (destino: Href) => () => router.push(destino);
  const margem = painel ? numero(painel.precos.margem_padrao) : 0;

  return (
    <ScrollView style={styles.tela} contentContainerStyle={{ paddingBottom: espaco.xxl }}>
      <View style={styles.cabecalho}>
        <View style={[styles.cabecalhoConteudo, { maxWidth: LARGURA_CONTEUDO }]}>
          {painel?.empresa.logo_url ? (
            <Image source={{ uri: painel.empresa.logo_url }} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{iniciais(vidraceiro?.empresa || vidraceiro?.nome)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.ola}>Olá, {primeiroNome(vidraceiro?.nome)}</Text>
            {!!vidraceiro?.empresa && <Text style={styles.empresa}>{vidraceiro.empresa}</Text>}
          </View>
          <Pressable onPress={sair} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sair da conta" style={styles.sair}>
            <MaterialCommunityIcons name="logout" size={22} color={cor.textoSobreMarca} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.conteudo, { maxWidth: LARGURA_CONTEUDO }]}>
        {!!painel?.projetos.parados && (
          <Pressable
            onPress={ir('/projetos/parados')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.lembrete, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.lembreteIcone}>
              <MaterialCommunityIcons name="clock-alert-outline" size={24} color={cor.alerta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lembreteTitulo}>
                {painel.projetos.parados}{' '}
                {painel.projetos.parados === 1 ? 'orçamento aguardando resposta' : 'orçamentos aguardando resposta'}
              </Text>
              <Text style={styles.lembreteTexto}>
                Enviados há mais de {painel.projetos.dias_lembrete} dias. Uma mensagem agora pode fechar a venda.
              </Text>
            </View>
            <Text style={styles.lembreteAcao}>Ver ›</Text>
          </Pressable>
        )}

        <Text style={styles.grupo}>Atendimento</Text>
        <Grade colunas={colunas}>
          <Cartao
            icone="account-group-outline"
            titulo="Clientes"
            rotulo="Clientes cadastrados"
            valor={n(painel?.clientes.total)}
            extra={painel?.clientes.novos_mes ? { valor: `+${painel.clientes.novos_mes}`, rotulo: 'novos este mês' } : undefined}
            descricao="Cadastre e consulte quem recebe seus orçamentos."
            acao="Ver lista"
            onAcao={ir('/clientes')}
          />
          <Cartao
            icone="floor-plan"
            titulo="Projetos"
            rotulo="Projetos ativos"
            valor={n(painel?.projetos.ativos)}
            extra={painel?.projetos.aguardando_cliente ? { valor: String(painel.projetos.aguardando_cliente), rotulo: 'aguardando o cliente' } : undefined}
            descricao="Monte orçamentos com janelas, portas e boxes sob medida."
            acao="Novo projeto"
            onAcao={ir('/projetos/novo')}
            onAbrir={ir('/projetos')}
            linkAbrir="Ver todos"
          />
          <Cartao
            icone="chart-pie"
            titulo="Preços e margem"
            rotulo="Margem padrão sobre o material"
            valor={!painel ? '–' : mostrarMargem ? `${margem.toLocaleString('pt-BR')}%` : '••%'}
            olho={{ aberto: mostrarMargem, alternar: () => setMostrarMargem((v) => !v) }}
            descricao="Sua margem, mão de obra e perda de corte."
            acao="Ajustar"
            onAcao={ir('/configuracoes/precos')}
          >
            {mostrarMargem && <Barra percentual={Math.min(margem, 100)} />}
            {!!painel?.precos.itens_preco_novo && (
              <View style={styles.alerta}>
                <MaterialCommunityIcons name="alert" size={15} color={cor.alerta} />
                <Text style={styles.alertaTexto}>
                  {painel.precos.itens_preco_novo}{' '}
                  {painel.precos.itens_preco_novo === 1 ? 'item dos seus produtos mudou' : 'itens dos seus produtos mudaram'} de preço
                  nos últimos {painel.precos.dias} dias
                </Text>
              </View>
            )}
          </Cartao>
        </Grade>

        <Text style={styles.grupo}>Seu catálogo</Text>
        <Grade colunas={colunas}>
          <Cartao
            icone="window-closed-variant"
            titulo="Produtos"
            rotulo="Modelos cadastrados"
            valor={n(painel?.produtos)}
            descricao="Seus modelos com perfis, acessórios e vedações."
            acao="Ver produtos"
            onAcao={ir('/produtos')}
          />
          <Cartao
            icone="mirror"
            titulo="Meus itens"
            rotulo="Itens fora do catálogo"
            valor={n(painel?.meus_itens)}
            descricao="Vidros e outros itens que você compra em outro lugar."
            acao="Gerenciar"
            onAcao={ir('/configuracoes/meus-itens')}
          />
          <Cartao
            icone="office-building-outline"
            titulo="Minha empresa"
            rotulo={painel?.empresa.faltando.length ? `Falta: ${painel.empresa.faltando.join(', ')}` : 'Perfil completo'}
            descricao="Logomarca e dados que aparecem nos orçamentos."
            acao="Gerenciar"
            onAcao={ir('/configuracoes/empresa')}
          >
            <Barra percentual={painel?.empresa.percentual ?? 0} legenda={painel ? `${painel.empresa.percentual}%` : undefined} />
          </Cartao>
        </Grade>
      </View>
    </ScrollView>
  );
}

// ---------- Peças do painel ----------

function Grade({ colunas, children }: { colunas: number; children: ReactNode }) {
  return (
    <View style={styles.grade}>
      {(Array.isArray(children) ? children : [children]).map((filho, i) => (
        <View key={i} style={{ width: `${100 / colunas}%`, padding: espaco.sm }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

function Barra({ percentual, legenda }: { percentual: number; legenda?: string }) {
  return (
    <View style={styles.barraLinha}>
      <View style={styles.barraFundo}>
        <View style={[styles.barraCheia, { width: `${Math.max(0, Math.min(percentual, 100))}%` }]} />
      </View>
      {!!legenda && <Text style={styles.barraLegenda}>{legenda}</Text>}
    </View>
  );
}

type PropsCartao = {
  icone: NomeIcone;
  titulo: string;
  rotulo: string;
  valor?: string;
  extra?: { valor: string; rotulo: string };
  olho?: { aberto: boolean; alternar: () => void };
  descricao: string;
  acao: string;
  onAcao: () => void;
  onAbrir?: () => void;
  linkAbrir?: string;
  children?: ReactNode;
};

function Cartao({ icone, titulo, rotulo, valor, extra, olho, descricao, acao, onAcao, onAbrir, linkAbrir, children }: PropsCartao) {
  return (
    <View style={styles.cartao}>
      <Pressable onPress={onAbrir ?? onAcao} style={styles.cartaoTopo}>
        <View style={styles.icone}>
          <MaterialCommunityIcons name={icone} size={34} color={cor.marca} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.tituloLinha}>
            <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
            {!!linkAbrir && <Text style={styles.linkAbrir}>{linkAbrir} ›</Text>}
          </View>
          <Text style={styles.rotulo} numberOfLines={2}>{rotulo}</Text>
          {valor !== undefined && (
            <View style={styles.valorLinha}>
              <Text style={styles.valor}>{valor}</Text>
              {olho && (
                <Pressable onPress={olho.alternar} hitSlop={12} accessibilityLabel={olho.aberto ? 'Esconder margem' : 'Mostrar margem'}>
                  <MaterialCommunityIcons name={olho.aberto ? 'eye-off-outline' : 'eye-outline'} size={22} color={cor.textoSuave} />
                </Pressable>
              )}
              {extra && (
                <View style={styles.extra}>
                  <Text style={styles.extraValor}>{extra.valor}</Text>
                  <Text style={styles.extraRotulo}>{extra.rotulo}</Text>
                </View>
              )}
            </View>
          )}
          {children}
        </View>
      </Pressable>
      <View style={styles.cartaoRodape}>
        <Text style={styles.descricao}>{descricao}</Text>
        <Pressable
          onPress={onAcao}
          accessibilityRole="button"
          style={({ pressed }) => [styles.botao, pressed && { backgroundColor: cor.marcaEscura }]}
        >
          <Text style={styles.botaoTexto}>{acao}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: { backgroundColor: cor.marca, paddingTop: 56, paddingBottom: 28, paddingHorizontal: espaco.lg },
  cabecalhoConteudo: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: espaco.sm },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: cor.cartao,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarTexto: { color: cor.marca, fontSize: 19, fontWeight: '800' },
  ola: { color: cor.textoSobreMarca, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  empresa: { color: cor.textoSobreMarcaSuave, fontSize: 15, marginTop: 2 },
  sair: { padding: 8 },
  conteudo: { width: '100%', alignSelf: 'center', paddingHorizontal: espaco.sm },
  lembrete: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cor.alertaFundo,
    borderWidth: 1, borderColor: '#F0D9A8', borderRadius: raio.cartao, padding: espaco.lg,
    marginHorizontal: espaco.sm, marginTop: espaco.xl,
  },
  lembreteIcone: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  lembreteTitulo: { color: cor.texto, fontSize: 16, fontWeight: '800' },
  lembreteTexto: { color: cor.alerta, fontSize: 13, marginTop: 2 },
  lembreteAcao: { color: cor.alerta, fontSize: 15, fontWeight: '800' },
  grupo: { color: cor.texto, fontSize: 18, fontWeight: '800', marginTop: espaco.xl, marginBottom: espaco.xs, marginLeft: espaco.sm },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  cartao: {
    flex: 1, backgroundColor: cor.cartao, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda,
    padding: espaco.lg, justifyContent: 'space-between', ...sombra,
  },
  cartaoTopo: { flexDirection: 'row', gap: 14, paddingBottom: espaco.md },
  icone: {
    width: 64, height: 64, borderRadius: raio.icone, backgroundColor: cor.marcaClara,
    alignItems: 'center', justifyContent: 'center',
  },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titulo: { color: cor.texto, fontSize: 19, fontWeight: '800', flexShrink: 1 },
  linkAbrir: { color: cor.marca, fontSize: 13, fontWeight: '700' },
  rotulo: { color: cor.textoSuave, fontSize: 13, marginTop: 2 },
  valorLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  valor: { color: cor.texto, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  extra: { marginLeft: 'auto', alignItems: 'flex-start', maxWidth: 120 },
  extraValor: { color: cor.marca, fontSize: 20, fontWeight: '800' },
  extraRotulo: { color: cor.textoSuave, fontSize: 12 },
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  barraFundo: { flex: 1, height: 8, borderRadius: 4, backgroundColor: cor.marcaClara, overflow: 'hidden' },
  barraCheia: { height: '100%', borderRadius: 4, backgroundColor: cor.marca },
  barraLegenda: { color: cor.textoSuave, fontSize: 13, fontWeight: '700' },
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cor.alertaFundo,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8,
  },
  alertaTexto: { color: cor.alerta, fontSize: 12, flexShrink: 1 },
  cartaoRodape: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: cor.borda,
    paddingTop: espaco.md,
  },
  descricao: { flex: 1, color: cor.texto, fontSize: 14, lineHeight: 19 },
  botao: { backgroundColor: cor.marca, borderRadius: raio.botao, paddingHorizontal: 16, paddingVertical: 11 },
  botaoTexto: { color: cor.textoSobreMarca, fontSize: 14, fontWeight: '700' },
});
