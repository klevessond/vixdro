// src/app/(interno)/projetos/[id].tsx  ->  rotas /projetos/novo e /projetos/<id>
//
// O projeto: cliente, peças (janelas, portas, boxes) com medidas e
// quantidade, o preço para o cliente (margem e mão de obra), o cálculo
// com a lista de compra e o PDF do orçamento para compartilhar.

import * as Crypto from 'expo-crypto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Produto, numero, reais } from '@/api/produtos';
import { Pedido, atualizarPedido, enviarPedido, listarPedidos, pedidoAtivo, reenviarPedido } from '@/api/pedidos';
import {
  CAMPOS_PRECO,
  CalculoProjeto,
  STATUS_PROJETO,
  StatusProjeto,
  alterarStatus,
  ItemCompra,
  Peca,
  Projeto,
  arquivarProjeto,
  calcularProjeto,
  concluirPeca,
  medidasTexto,
  pecaAvulsa,
  obterPadroes,
  obterProjeto,
  pecaDoProduto,
  salvarProjeto,
} from '@/api/projetos';
import { useAuth } from '@/auth/AuthContext';
import { obterLogo } from '@/api/empresa';
import { compartilharOrcamentoPdf } from '@/pdf/orcamentoPdf';
import { COR } from '@/components/produtos/cores';
import { AjustesOrcamento, ValoresAjuste } from '@/components/projetos/AjustesOrcamento';
import { EditorPeca } from '@/components/projetos/EditorPeca';
import { MedicaoProjeto } from '@/components/projetos/MedicaoProjeto';
import { RecebimentosProjeto } from '@/components/projetos/RecebimentosProjeto';
import { usePlano } from '@/hooks/usePlano';
import { SeletorCliente } from '@/components/projetos/SeletorCliente';
import { SeletorProduto } from '@/components/projetos/SeletorProduto';
import { ClienteLocal, obterClienteLocal } from '@/storage/clientesRepository';

const ESPERA_MODAL = Platform.OS === 'ios' ? 450 : 0;

function novoProjeto(): Projeto {
  return {
    id: Crypto.randomUUID(),
    nome: '',
    cliente: '',
    cliente_nome: '',
    observacoes: '',
    perda_percentual: '10',
    margem_percentual: '30',
    mao_de_obra_m2: '',
    mao_de_obra_minima: '',
    descricao_adicional: 'Instalação',
    valor_adicional: '',
    desconto: '',
    validade_dias: '15',
    linhas: [],
  };
}

/** Números da API ("40.00") viram texto de edição ("40"); zero vira campo vazio. */
function paraEdicao(v: string | number | null | undefined, zeroVazio = true) {
  const n = numero(String(v ?? ''));
  if (!n && zeroVazio) return '';
  return String(n);
}

function normalizarPreco(p: Partial<Projeto>): Partial<Projeto> {
  return {
    perda_percentual: paraEdicao(p.perda_percentual, false),
    margem_percentual: paraEdicao(p.margem_percentual, false),
    mao_de_obra_m2: paraEdicao(p.mao_de_obra_m2),
    mao_de_obra_minima: paraEdicao(p.mao_de_obra_minima),
    descricao_adicional: p.descricao_adicional ?? '',
    valor_adicional: paraEdicao(p.valor_adicional),
    desconto: paraEdicao(p.desconto),
    validade_dias: paraEdicao(p.validade_dias, false) || '15',
  };
}

function fmt(n: number, casas = 2) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

function textoCompra(x: ItemCompra) {
  const q = numero(x.quantidade_compra);
  if (x.modo === 'peca_comprimento') {
    const tamanho = fmt((x.comprimento_mm ?? 0) / 1000);
    return `${fmt(q, 0)} ${q === 1 ? 'peça' : 'peças'} de ${tamanho} m`;
  }
  return `${fmt(q, 3)} ${x.unidade_compra}`;
}

type EdicaoPeca = { indice: number | null; peca: Peca };

export default function EditorProjeto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { vidraceiro } = useAuth();
  const { pro } = usePlano(); // a agenda é do plano Pro
  const novo = id === 'novo';

  const [projeto, setProjeto] = useState<Projeto>(novoProjeto);
  const [jaExiste, setJaExiste] = useState(!novo);
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [seletorCliente, setSeletorCliente] = useState(false);
  const [seletorProduto, setSeletorProduto] = useState(false);
  const [edicao, setEdicao] = useState<EdicaoPeca | null>(null);
  const [calculo, setCalculo] = useState<CalculoProjeto | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  // Margem, mão de obra e custos ficam fora da vista: o orçamento pode ser
  // montado na frente do cliente.
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [mostrarCustos, setMostrarCustos] = useState(false);
  const [ocupadoPedido, setOcupadoPedido] = useState<string | null>(null);

  // Com pedido no fornecedor, o projeto fica congelado (o servidor também bloqueia).
  const congelado = pedidos.some(pedidoAtivo);

  useEffect(() => {
    if (novo || !id) return;
    listarPedidos(id).then(setPedidos).catch(() => {});
  }, [id, novo]);

  // Projeto novo: começa com a margem e a mão de obra do último projeto.
  useEffect(() => {
    if (!novo) return;
    obterPadroes()
      .then((pad) => setProjeto((p) => ({ ...p, ...normalizarPreco(pad) })))
      .catch(() => {}); // sem internet: fica com os valores padrão
  }, [novo]);

  useEffect(() => {
    if (novo || !id) return;
    obterProjeto(id)
      .then((p) => setProjeto({ ...p, ...normalizarPreco(p) }))
      .catch((e) =>
        Alert.alert('Não foi possível abrir', e?.message ?? 'Tente novamente.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      )
      .finally(() => setCarregando(false));
  }, [id, novo]);

  function alterar(parcial: Partial<Projeto>) {
    setProjeto((p) => ({ ...p, ...parcial }));
    setAlterado(true);
    const mudaValores =
      parcial.linhas || parcial.perda_percentual !== undefined || CAMPOS_PRECO.some((c) => c in parcial);
    if (mudaValores) setCalculo(null);
  }

  function clienteEscolhido(c: ClienteLocal) {
    setSeletorCliente(false);
    alterar({ cliente: c.id, cliente_nome: c.nome });
  }

  function avulsaEscolhida() {
    setSeletorProduto(false);
    setTimeout(() => setEdicao({ indice: null, peca: pecaAvulsa() }), ESPERA_MODAL);
  }

  function produtoEscolhido(p: Produto) {
    setSeletorProduto(false);
    setTimeout(() => setEdicao({ indice: null, peca: pecaDoProduto(p) }), ESPERA_MODAL);
  }

  function pecaConfirmada(p: Peca) {
    const linhas = [...projeto.linhas];
    if (edicao?.indice === null || edicao?.indice === undefined) linhas.push(p);
    else linhas[edicao.indice] = p;
    alterar({ linhas });
    setEdicao(null);
  }

  function pecaRemovida() {
    if (edicao?.indice === null || edicao?.indice === undefined) return;
    const i = edicao.indice;
    alterar({ linhas: projeto.linhas.filter((_, j) => j !== i) });
    setEdicao(null);
  }

  async function calcular() {
    if (!projeto.linhas.length) return;
    setCalculando(true);
    try {
      setCalculo(await calcularProjeto(projeto));
    } catch (e: any) {
      Alert.alert('Não foi possível calcular', e?.message ?? 'Tente novamente.');
    } finally {
      setCalculando(false);
    }
  }

  function podeSalvar(): boolean {
    if (!projeto.cliente) {
      Alert.alert('Falta o cliente', 'Escolha para quem é este projeto.');
      return false;
    }
    if (!projeto.nome.trim()) {
      Alert.alert('Falta o nome', 'Ex: Reforma da cozinha.');
      return false;
    }
    if (!projeto.linhas.length) {
      Alert.alert('Nenhuma peça', 'Adicione pelo menos uma peça.');
      return false;
    }
    return true;
  }

  /** Salva no servidor e devolve o número do orçamento. */
  async function gravar(): Promise<number | null | undefined> {
    const salvo = await salvarProjeto({ ...projeto, nome: projeto.nome.trim() }, jaExiste);
    setJaExiste(true);
    setAlterado(false);
    setProjeto((p) => ({ ...p, numero: salvo.numero }));
    return salvo.numero;
  }

  async function salvar() {
    if (!podeSalvar()) return;
    setSalvando(true);
    try {
      await gravar();
      router.back();
    } catch (e: any) {
      Alert.alert('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function compartilhar() {
    if (!podeSalvar() || !vidraceiro) return;
    setCompartilhando(true);
    try {
      // O PDF sempre reflete o que está salvo: grava antes, se preciso.
      let numeroOrcamento = projeto.numero;
      if (!jaExiste || alterado) numeroOrcamento = await gravar();
      const resultado = calculo ?? (await calcularProjeto(projeto));
      setCalculo(resultado);
      const cliente = await obterClienteLocal(projeto.cliente);
      const logo = await obterLogo().then((l) => l.logo_data_uri).catch(() => null);
      await compartilharOrcamentoPdf({
        projeto: { ...projeto, numero: numeroOrcamento },
        calculo: resultado,
        vidraceiro,
        cliente,
        logo,
      });
      // Orçamento compartilhado: sai de "rascunho" para "enviado".
      if (!projeto.status || projeto.status === 'rascunho') {
        const status = await alterarStatus(projeto.id, 'enviado').catch(() => null);
        if (status) setProjeto((p) => ({ ...p, status }));
      }
    } catch (e: any) {
      Alert.alert('Não foi possível gerar o orçamento', e?.message ?? 'Tente novamente.');
    } finally {
      setCompartilhando(false);
    }
  }

  // Ao mudar o que sai do estoque, a lista de compra se atualiza sozinha
  // (espera parar de digitar).
  useEffect(() => {
    if (!calculo) return;
    const t = setTimeout(() => {
      calcularProjeto(projeto).then(setCalculo).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [projeto.estoque_usado]);

  // Acompanhamento: conta pela quantidade (uma linha com 4 janelas vale 4).
  const totalPecas = projeto.linhas.reduce((t, l) => t + (l.quantidade || 0), 0);
  const pecasConcluidas = projeto.linhas.reduce((t, l) => t + (l.concluida ? l.quantidade || 0 : 0), 0);

  async function alternarConcluida(indice: number) {
    const peca = projeto.linhas[indice];
    const concluida = !peca.concluida;
    const atualizar = (c: boolean, em: string | null) =>
      // Não marca o projeto como "alterado": isto já fica gravado na hora.
      setProjeto((p) => ({
        ...p,
        linhas: p.linhas.map((l, j) => (j === indice ? { ...l, concluida: c, concluida_em: em } : l)),
      }));
    atualizar(concluida, concluida ? new Date().toISOString() : null);
    // Peça ainda não salva: fica só na tela, e vai junto quando o projeto for salvo.
    if (!jaExiste || peca.id === undefined) return;
    try {
      const r = await concluirPeca(projeto.id, peca.id, concluida);
      atualizar(r.concluida, r.concluida_em);
    } catch (e: any) {
      atualizar(!!peca.concluida, peca.concluida_em ?? null); // desfaz
      Alert.alert('Não foi possível atualizar a peça', e?.message ?? 'Tente novamente.');
    }
  }

  function mudarEstoque(itemId: number, texto: string) {
    const valor = texto.replace(/[^0-9,.]/g, '').replace(',', '.');
    const atual = { ...(projeto.estoque_usado ?? {}) };
    if (valor && Number(valor) > 0) atual[String(itemId)] = valor;
    else delete atual[String(itemId)];
    setProjeto((p) => ({ ...p, estoque_usado: atual }));
    setAlterado(true);
  }

  async function mudarStatus(status: StatusProjeto) {
    if (status === projeto.status) return;
    if (alterado || !jaExiste) {
      Alert.alert('Salve primeiro', 'Salve o projeto antes de mudar o status.');
      return;
    }
    try {
      const novoStatus = await alterarStatus(projeto.id, status);
      setProjeto((p) => ({ ...p, status: novoStatus }));
    } catch (e: any) {
      Alert.alert('Não foi possível mudar o status', e?.message ?? 'Tente novamente.');
    }
  }

  function confirmarPedido() {
    if (!jaExiste || alterado) {
      Alert.alert('Salve primeiro', 'Salve o projeto antes de enviar o pedido ao fornecedor.');
      return;
    }
    const valor = calculo && mostrarCustos ? ` no valor estimado de ${reais(calculo.custo_compra)}` : '';
    const aviso = `A lista de compra deste projeto será enviada ao fornecedor${valor}. Depois disso, o projeto não pode mais ser alterado.`;

    // O pedido só faz sentido com o orçamento aprovado pelo cliente.
    if (projeto.status !== 'aprovado') {
      Alert.alert('O cliente aprovou o orçamento?', `O orçamento será marcado como aprovado. ${aviso}`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovado, enviar pedido',
          onPress: async () => {
            try {
              const status = await alterarStatus(projeto.id, 'aprovado');
              setProjeto((p) => ({ ...p, status }));
              await fazerPedido();
            } catch (e: any) {
              Alert.alert('Não foi possível enviar', e?.message ?? 'Tente novamente.');
            }
          },
        },
      ]);
      return;
    }
    Alert.alert('Enviar pedido ao fornecedor', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar pedido', onPress: fazerPedido },
    ]);
  }

  async function fazerPedido() {
    setOcupadoPedido('novo');
    try {
      const criados = await enviarPedido(projeto.id);
      setPedidos(await listarPedidos(projeto.id).catch(() => criados));
      if (criados.some((p) => p.status === 'erro')) {
        Alert.alert('Pedido não chegou ao fornecedor', 'Veja o motivo abaixo e tente de novo.');
      }
    } catch (e: any) {
      Alert.alert('Não foi possível enviar o pedido', e?.message ?? 'Tente novamente.');
    } finally {
      setOcupadoPedido(null);
    }
  }

  async function acaoPedido(p: Pedido) {
    setOcupadoPedido(p.id);
    try {
      const atualizado = p.status === 'erro' ? await reenviarPedido(p.id) : await atualizarPedido(p.id);
      setPedidos((lista) => lista.map((x) => (x.id === p.id ? atualizado : x)));
    } catch (e: any) {
      Alert.alert('Não foi possível falar com o fornecedor', e?.message ?? 'Tente novamente.');
    } finally {
      setOcupadoPedido(null);
    }
  }

  function excluir() {
    Alert.alert('Excluir projeto', `Excluir "${projeto.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await arquivarProjeto(projeto.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Não foi possível excluir', e?.message ?? 'Tente novamente.');
          }
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <View style={styles.tela}>
        <Stack.Screen options={{ headerShown: true, title: 'Projeto' }} />
        <ActivityIndicator style={{ marginTop: 40 }} color={COR.borda} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{ headerShown: true, title: projeto.numero ? `Orçamento nº ${projeto.numero}` : 'Novo projeto' }}
      />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={styles.rotulo}>Cliente</Text>
        <Pressable
          style={({ pressed }) => [styles.campoEscolha, pressed && { backgroundColor: COR.bordaClara }]}
          onPress={() => setSeletorCliente(true)}
        >
          <Text style={projeto.cliente ? styles.escolhido : styles.placeholder}>
            {projeto.cliente_nome || 'Escolher cliente'}
          </Text>
          <Text style={styles.seta}>›</Text>
        </Pressable>

        <Text style={styles.rotulo}>Nome do projeto</Text>
        <TextInput
          style={styles.input}
          value={projeto.nome}
          onChangeText={(nome) => alterar({ nome })}
          placeholder="Ex: Reforma da cozinha"
          placeholderTextColor={COR.tintaSuave}
        />

        {jaExiste && (
          <>
            <Text style={styles.rotulo}>Situação do orçamento</Text>
            <View style={styles.statusLinha}>
              {STATUS_PROJETO.map((st) => {
                const ativo = projeto.status === st.valor;
                return (
                  <Pressable
                    key={st.valor}
                    disabled={congelado}
                    onPress={() => mudarStatus(st.valor)}
                    style={[styles.statusChip, ativo && { backgroundColor: st.cor, borderColor: st.cor }]}
                  >
                    <Text style={[styles.statusTexto, ativo && { color: '#FFFFFF', fontWeight: '700' }]}>
                      {st.rotulo}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {jaExiste && !!projeto.cliente && (
          <Pressable
            style={styles.agendar}
            onPress={() =>
              router.push({
                pathname: '/agenda/[id]',
                params: {
                  id: 'novo',
                  cliente: projeto.cliente,
                  projeto: projeto.id,
                  // Aprovado: hora de instalar. Antes disso: medir.
                  tipo: projeto.status === 'aprovado' ? 'instalacao' : 'medicao',
                },
              })
            }
          >
            <Text style={styles.agendarTexto}>
              {projeto.status === 'aprovado' ? '+ Agendar instalação' : '+ Agendar medição ou visita'}
              {!pro ? '  ·  Pro' : ''}
            </Text>
          </Pressable>
        )}

        {congelado && (
          <View style={styles.aviso}>
            <Text style={styles.avisoTexto}>
              Este projeto já tem pedido no fornecedor, por isso não pode mais ser alterado.
            </Text>
          </View>
        )}

        {/* Diário da medição: liberado mesmo com o projeto congelado (fotos da instalação). */}
        {jaExiste && <MedicaoProjeto projetoId={projeto.id} pecas={projeto.linhas.map((l) => l.nome)} />}

        <Text style={styles.secao}>Peças</Text>
        {totalPecas > 0 && jaExiste && (
          <View style={styles.progresso}>
            <View style={styles.progressoFundo}>
              <View style={[styles.progressoCheio, { width: `${(100 * pecasConcluidas) / totalPecas}%` }]} />
            </View>
            <Text style={styles.progressoTexto}>
              {pecasConcluidas === totalPecas ? 'Todas as peças concluídas' : `${pecasConcluidas} de ${totalPecas} peças concluídas`}
            </Text>
          </View>
        )}
        <View style={styles.caixa}>
          {projeto.linhas.map((p, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.divisor} />}
              <Pressable
                onPress={() => setEdicao({ indice: i, peca: p })}
                disabled={congelado}
                style={({ pressed }) => [styles.peca, pressed && { backgroundColor: COR.bordaClara }]}
              >
                <Pressable
                  onPress={() => alternarConcluida(i)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!p.concluida }}
                  accessibilityLabel={`${p.nome} concluída`}
                >
                  <MaterialCommunityIcons
                    name={p.concluida ? 'check-circle' : 'checkbox-blank-circle-outline'}
                    size={26}
                    color={p.concluida ? '#1E6B3A' : COR.linha}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pecaNome, p.concluida && styles.pecaConcluida]}>{p.nome}</Text>
                  <Text style={styles.pecaDetalhe}>
                    {[medidasTexto(p.largura_mm, p.altura_mm), `${p.itens.length} ${p.itens.length === 1 ? 'item' : 'itens'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={styles.quantidade}>{p.quantidade}×</Text>
              </Pressable>
            </View>
          ))}
          {!congelado && (
            <>
              {projeto.linhas.length > 0 && <View style={styles.divisor} />}
              <Pressable
                onPress={() => setSeletorProduto(true)}
                style={({ pressed }) => [styles.adicionar, pressed && { backgroundColor: COR.bordaClara }]}
              >
                <Text style={styles.link}>+ Adicionar peça</Text>
              </Pressable>
            </>
          )}
        </View>

        {projeto.linhas.length > 0 && (
          <>
            <Text style={styles.secao}>Condições do orçamento</Text>
            <View style={styles.grade}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rotulo}>Valor adicional</Text>
                <TextInput
                  style={styles.input}
                  value={projeto.descricao_adicional}
                  onChangeText={(v) => alterar({ descricao_adicional: v })}
                  placeholder="Ex: Instalação e frete"
                  placeholderTextColor={COR.tintaSuave}
                />
              </View>
              <CampoValor rotulo="R$" valor={projeto.valor_adicional} estreito
                onMudar={(v) => alterar({ valor_adicional: v })} />
            </View>
            <View style={styles.grade}>
              <CampoValor rotulo="Desconto (R$)" valor={projeto.desconto}
                onMudar={(v) => alterar({ desconto: v })} />
              <CampoValor rotulo="Validade (dias)" valor={projeto.validade_dias} inteiro
                onMudar={(v) => alterar({ validade_dias: v })} />
            </View>

            <Text style={styles.rotulo}>Observações no orçamento</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={projeto.observacoes}
              onChangeText={(v) => alterar({ observacoes: v })}
              placeholder="Ex: Pagamento 50% na aprovação e 50% na entrega."
              placeholderTextColor={COR.tintaSuave}
              multiline
            />

            <Pressable style={styles.botaoContorno} onPress={calcular} disabled={calculando}>
              {calculando ? (
                <ActivityIndicator color={COR.borda} />
              ) : (
                <Text style={styles.link}>Calcular preço</Text>
              )}
            </Pressable>
            {!congelado && (
              <Pressable style={styles.discreto} onPress={() => setAjustesAbertos(true)} hitSlop={8}>
                <Text style={styles.discretoTexto}>Ajustes</Text>
              </Pressable>
            )}
          </>
        )}

        {calculo && (
          <>
            <Text style={styles.secao}>Orçamento</Text>
            <View style={styles.caixaResultado}>
              {calculo.linhas.map((l, i) => (
                <View key={i} style={styles.resultadoLinha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultadoNome}>{l.nome}</Text>
                    <Text style={styles.resultadoDetalhe}>
                      {[medidasTexto(l.largura_mm, l.altura_mm), `${l.quantidade} × ${reais(l.preco_unitario)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.resultadoValor}>{reais(l.preco_total)}</Text>
                </View>
              ))}
              {numero(calculo.orcamento.valor_adicional) > 0 && (
                <View style={styles.resultadoLinha}>
                  <Text style={[styles.resultadoNome, { flex: 1 }]}>
                    {calculo.orcamento.descricao_adicional || 'Adicional'}
                  </Text>
                  <Text style={styles.resultadoValor}>{reais(calculo.orcamento.valor_adicional)}</Text>
                </View>
              )}
              {numero(calculo.orcamento.desconto) > 0 && (
                <View style={styles.resultadoLinha}>
                  <Text style={[styles.resultadoNome, { flex: 1 }]}>Desconto</Text>
                  <Text style={styles.resultadoValor}>− {reais(calculo.orcamento.desconto)}</Text>
                </View>
              )}
              <View style={styles.total}>
                <Text style={styles.totalRotulo}>Total</Text>
                <Text style={styles.totalValor}>{reais(calculo.orcamento.total)}</Text>
              </View>
            </View>

            <Pressable style={styles.discreto} onPress={() => setMostrarCustos((v) => !v)} hitSlop={8}>
              <Text style={styles.discretoTexto}>{mostrarCustos ? 'Ocultar custos' : 'Mostrar custos'}</Text>
            </Pressable>
          </>
        )}

        {calculo && mostrarCustos && (
          <>
            <Text style={styles.secao}>Só para você</Text>
            <View style={styles.caixaResultado}>
              <LinhaInterna rotulo="Material (pelo que é usado)" valor={calculo.orcamento.material_com_perda} />
              <LinhaInterna rotulo="Seu lucro sobre o material" valor={calculo.orcamento.lucro_material} />
              <LinhaInterna rotulo="Mão de obra" valor={calculo.orcamento.mao_de_obra} />
              <LinhaInterna rotulo="Compra no fornecedor (barras inteiras)" valor={calculo.custo_compra} />
              <Text style={styles.nota}>
                Nada deste quadro aparece no orçamento do cliente. A compra no fornecedor pode ser maior
                que o material, porque as barras são inteiras: a diferença fica como sobra no estoque.
              </Text>
            </View>

            <Text style={styles.secao}>Lista de compra</Text>
            <View style={styles.caixaResultado}>
              {calculo.lista_compra.map((x) => {
                const doEstoque = numero(x.quantidade_estoque) > 0;
                return (
                  <View key={x.item} style={styles.compraItem}>
                    <View style={styles.resultadoLinha}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultadoNome}>{x.descricao}</Text>
                        <Text style={styles.resultadoDetalhe}>
                          {x.codigo} · precisa de {textoCompra(x)}
                          {x.sobra_m !== null ? ` · sobra ${fmt(numero(x.sobra_m))} m` : ''}
                          {!x.item_ativo ? ' · saiu de linha' : ''}
                        </Text>
                      </View>
                      <Text style={styles.resultadoValor}>{reais(x.custo_pedir)}</Text>
                    </View>
                    <View style={styles.estoqueLinha}>
                      <Text style={styles.estoqueRotulo}>Do meu estoque:</Text>
                      <TextInput
                        style={styles.estoqueInput}
                        value={projeto.estoque_usado?.[String(x.item)]?.replace('.', ',') ?? ''}
                        onChangeText={(v) => mudarEstoque(x.item, v)}
                        placeholder="0"
                        placeholderTextColor="#93A3A5"
                        keyboardType="decimal-pad"
                        editable={!congelado}
                      />
                      <Text style={[styles.estoqueRotulo, { flex: 1 }]}>
                        {doEstoque ? `→ pedir ${fmt(numero(x.quantidade_pedir), 3)}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.total}>
                <Text style={styles.totalRotulo}>Total da compra</Text>
                <Text style={styles.totalValor}>{reais(calculo.custo_compra)}</Text>
              </View>
              <Text style={styles.nota}>
                Barras inteiras, somando todas as peças, com {fmt(numero(calculo.perda_percentual))}% de perda. O que sai
                do seu estoque não entra no pedido nem no total da compra, e não muda o preço para o cliente.
                A diferença para os materiais é a sobra que fica no estoque.
              </Text>
            </View>
          </>
        )}

        {!congelado && (
          <Pressable
            style={({ pressed }) => [styles.botao, (pressed || salvando) && { backgroundColor: COR.bordaEscura }]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar projeto</Text>}
          </Pressable>
        )}
        {projeto.linhas.length > 0 && (
          <Pressable
            style={[styles.botaoContorno, { marginTop: 12 }]}
            onPress={compartilhar}
            disabled={compartilhando}
          >
            {compartilhando ? (
              <ActivityIndicator color={COR.borda} />
            ) : (
              <Text style={styles.link}>Compartilhar orçamento (PDF)</Text>
            )}
          </Pressable>
        )}
        {projeto.linhas.length > 0 && (
          <Text style={[styles.nota, { textAlign: 'center' }]}>
            O PDF vai só para o cliente. O pedido ao fornecedor tem botão próprio.
          </Text>
        )}

        {jaExiste && projeto.linhas.length > 0 && (
          <>
            <Text style={styles.secao}>Pedido ao fornecedor</Text>
            {!pedidos.length && (
              <Text style={styles.nota}>
                Separado do orçamento: compartilhar o PDF com o cliente não envia nada ao fornecedor.
              </Text>
            )}
            {pedidos.map((p) => (
              <View key={p.id} style={styles.caixaResultado}>
                <View style={styles.resultadoLinha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultadoNome}>{p.fornecedor_nome}</Text>
                    <Text style={styles.resultadoDetalhe}>
                      {p.numero_fornecedor ? `Pedido nº ${p.numero_fornecedor} · ` : ''}
                      {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                    </Text>
                  </View>
                  {mostrarCustos && <Text style={styles.resultadoValor}>{reais(p.total)}</Text>}
                </View>
                <Text style={[styles.pedidoStatus, p.status === 'erro' && { color: COR.erro }]}>
                  {p.status_texto}
                </Text>
                {!!p.erro && <Text style={styles.nota}>{p.erro}</Text>}
                {p.status !== 'cancelado' && (
                  <Pressable style={[styles.botaoContorno, { marginTop: 10 }]} onPress={() => acaoPedido(p)} disabled={ocupadoPedido !== null}>
                    {ocupadoPedido === p.id ? (
                      <ActivityIndicator color={COR.borda} />
                    ) : (
                      <Text style={styles.link}>{p.status === 'erro' ? 'Tentar enviar de novo' : 'Atualizar situação'}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            ))}
            {!congelado && !pedidos.some((p) => p.status === 'erro') && (
              <Pressable
                style={({ pressed }) => [styles.botao, { marginTop: 0 }, pressed && { backgroundColor: COR.bordaEscura }]}
                onPress={confirmarPedido}
                disabled={ocupadoPedido !== null}
              >
                {ocupadoPedido === 'novo' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.botaoTexto}>Enviar pedido ao fornecedor</Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {jaExiste && projeto.linhas.length > 0 && (
          <RecebimentosProjeto projetoId={projeto.id} pro={pro} total={calculo?.orcamento.total ?? null} />
        )}

        {jaExiste && !congelado && (
          <Pressable style={styles.excluir} onPress={excluir}>
            <Text style={styles.excluirTexto}>Excluir projeto</Text>
          </Pressable>
        )}
      </ScrollView>

      <SeletorCliente
        visivel={seletorCliente}
        onSelecionar={clienteEscolhido}
        onNovoCliente={() => {
          setSeletorCliente(false);
          setTimeout(() => router.push('/clientes/novo'), ESPERA_MODAL);
        }}
        onFechar={() => setSeletorCliente(false)}
      />
      <SeletorProduto
        visivel={seletorProduto}
        onSelecionar={produtoEscolhido}
        onAvulsa={avulsaEscolhida}
        onFechar={() => setSeletorProduto(false)}
      />
      <AjustesOrcamento
        visivel={ajustesAbertos}
        valores={{
          margem_percentual: projeto.margem_percentual,
          mao_de_obra_m2: projeto.mao_de_obra_m2,
          mao_de_obra_minima: projeto.mao_de_obra_minima,
          perda_percentual: projeto.perda_percentual,
        }}
        onSalvar={(v: ValoresAjuste) => {
          alterar(v);
          setAjustesAbertos(false);
        }}
        onFechar={() => setAjustesAbertos(false)}
      />
      <EditorPeca
        peca={edicao?.peca ?? null}
        nova={edicao?.indice === null}
        onSalvar={pecaConfirmada}
        onRemover={pecaRemovida}
        onFechar={() => setEdicao(null)}
      />
    </KeyboardAvoidingView>
  );
}

function CampoValor({
  rotulo,
  valor,
  onMudar,
  inteiro = false,
  estreito = false,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  inteiro?: boolean;
  estreito?: boolean;
}) {
  return (
    <View style={estreito ? { width: 110 } : { flex: 1 }}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        style={styles.input}
        value={valor}
        onChangeText={(v) =>
          onMudar(inteiro ? v.replace(/\D/g, '') : v.replace(/[^0-9,.]/g, '').replace(',', '.'))
        }
        keyboardType={inteiro ? 'number-pad' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={COR.tintaSuave}
      />
    </View>
  );
}

function LinhaInterna({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.resultadoLinha}>
      <Text style={[styles.resultadoNome, { flex: 1 }]}>{rotulo}</Text>
      <Text style={styles.resultadoValor}>{reais(valor)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  grade: { flexDirection: 'row', gap: 12 },
  pecaConcluida: { color: COR.tintaSuave, textDecorationLine: 'line-through' },
  progresso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressoFundo: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COR.bordaClara, overflow: 'hidden' },
  progressoCheio: { height: '100%', borderRadius: 4, backgroundColor: '#1E6B3A' },
  progressoTexto: { color: COR.tintaSuave, fontSize: 13, fontWeight: '600' },
  compraItem: { borderBottomWidth: 1, borderBottomColor: COR.bordaClara, paddingBottom: 6, marginBottom: 2 },
  estoqueLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estoqueRotulo: { color: COR.tintaSuave, fontSize: 13 },
  estoqueInput: {
    borderWidth: 1, borderColor: COR.linha, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    minWidth: 54, textAlign: 'center', fontSize: 14, color: COR.tinta, backgroundColor: COR.superficie,
  },
  agendar: {
    borderWidth: 1, borderColor: COR.linha, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 11, alignItems: 'center', marginBottom: 12, backgroundColor: COR.superficie,
  },
  agendarTexto: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  statusLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusChip: {
    borderWidth: 1, borderColor: COR.linha, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: COR.superficie,
  },
  statusTexto: { color: COR.tinta, fontSize: 14 },
  aviso: { backgroundColor: COR.bordaClara, borderLeftWidth: 3, borderLeftColor: COR.borda, padding: 12, marginBottom: 8 },
  avisoTexto: { color: COR.tinta, fontSize: 14, lineHeight: 20 },
  pedidoStatus: { color: COR.borda, fontSize: 15, fontWeight: '700', marginTop: 4 },
  conteudo: { padding: 20, paddingBottom: 48 },
  rotulo: { color: COR.tinta, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.linha, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COR.tinta, marginBottom: 12,
  },
  campoEscolha: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COR.superficie, borderWidth: 1,
    borderColor: COR.linha, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12,
  },
  escolhido: { flex: 1, color: COR.tinta, fontSize: 16, fontWeight: '600' },
  placeholder: { flex: 1, color: COR.tintaSuave, fontSize: 16 },
  seta: { color: COR.borda, fontSize: 24, fontWeight: '300' },
  secao: { color: COR.tinta, fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  caixa: { backgroundColor: COR.superficie, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, overflow: 'hidden' },
  divisor: { height: 1, backgroundColor: COR.linha, marginLeft: 14 },
  peca: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pecaNome: { color: COR.tinta, fontSize: 16, fontWeight: '600' },
  pecaDetalhe: { color: COR.tintaSuave, fontSize: 14, marginTop: 2 },
  quantidade: { color: COR.borda, fontSize: 17, fontWeight: '800' },
  adicionar: { padding: 16, alignItems: 'center' },
  link: { color: COR.borda, fontSize: 15, fontWeight: '700' },
  discreto: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  discretoTexto: { color: COR.tintaSuave, fontSize: 13 },
  botaoContorno: { borderWidth: 1.5, borderColor: COR.borda, borderRadius: 6, paddingVertical: 13, alignItems: 'center' },
  caixaResultado: { backgroundColor: COR.superficie, borderRadius: 10, borderWidth: 1, borderColor: COR.linha, padding: 14 },
  resultadoLinha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 12 },
  resultadoNome: { color: COR.tinta, fontSize: 15 },
  resultadoDetalhe: { color: COR.tintaSuave, fontSize: 13, marginTop: 1 },
  resultadoValor: { color: COR.tinta, fontSize: 15, fontWeight: '600' },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COR.linha, marginTop: 8, paddingTop: 10 },
  totalRotulo: { color: COR.tinta, fontSize: 16, fontWeight: '700' },
  totalValor: { color: COR.tinta, fontSize: 18, fontWeight: '800' },
  nota: { color: COR.tintaSuave, fontSize: 12, lineHeight: 17, marginTop: 8 },
  botao: { backgroundColor: COR.borda, borderRadius: 6, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  excluir: { alignItems: 'center', paddingVertical: 16 },
  excluirTexto: { color: COR.erro, fontSize: 15, fontWeight: '600' },
});
