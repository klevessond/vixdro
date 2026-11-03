// src/api/estoque.ts
//
// Estoque de materiais (plano Pro). O saldo vem da soma das movimentações,
// na unidade de estoque: perfis em metros (mostrados também em barras),
// vidros em m², o resto na unidade de venda.

import { ApiError, apiFetch } from './auth';

export type ItemEstoque = {
  item: number;
  codigo: string;
  descricao: string;
  tipo: string;
  proprio: boolean;
  unidade: string; // m, m², un...
  fator_compra: string; // 1 barra = 6 m -> "6"
  comprimento_mm: number | null;
  saldo: string;
  saldo_texto: string; // "36 m (≈ 6 barras)"
  minimo: string | null;
  abaixo_minimo: boolean;
  custo_medio: string;
  valor: string;
};

export type Movimento = {
  id: string;
  quantidade: string; // + entrou, - saiu
  texto: string;
  motivo: 'inventario' | 'pedido' | 'compra' | 'obra' | 'perda' | 'ajuste';
  motivo_texto: string;
  observacao: string;
  projeto: string | null;
  projeto_numero: number | null;
  criado_em: string;
};

async function ler<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' ? (Object.values(data).flat()[0] as any) : null;
    throw new ApiError(res.status, data, typeof msg === 'string' ? msg : padrao);
  }
  return data as T;
}

export async function listarEstoque(filtros: { busca?: string; tipo?: string; abaixo?: boolean } = {}) {
  const p = new URLSearchParams();
  if (filtros.busca) p.set('busca', filtros.busca);
  if (filtros.tipo) p.set('tipo', filtros.tipo);
  if (filtros.abaixo) p.set('abaixo', '1');
  return ler<{ itens: ItemEstoque[]; valor_total: string; abaixo_minimo: number }>(
    await apiFetch(`/estoque/itens/?${p}`),
    'Não foi possível carregar o estoque.'
  );
}

export async function obterItemEstoque(item: number) {
  return ler<ItemEstoque & { movimentos: Movimento[] }>(await apiFetch(`/estoque/itens/${item}/`), 'Não foi possível abrir o item.');
}

/** Contagem (o saldo passa a ser o contado), compra (entra), perda (sai) ou ajuste. */
export async function movimentar(dados: {
  item: number;
  motivo: 'inventario' | 'compra' | 'perda' | 'ajuste';
  quantidade: string;
  unidade: 'estoque' | 'compra'; // compra = barras, para perfis
  custo_unitario?: string;
  observacao?: string;
}) {
  const res = await apiFetch('/estoque/movimentos/', {
    method: 'POST',
    body: JSON.stringify({ ...dados, quantidade: dados.quantidade.replace(',', '.'), custo_unitario: dados.custo_unitario?.replace(',', '.') }),
  });
  return ler<{ saldo_texto: string }>(res, 'Não foi possível registrar.');
}

export async function definirMinimo(item: number, minimo: string, unidade: 'estoque' | 'compra') {
  const res = await apiFetch(`/estoque/itens/${item}/minimo/`, {
    method: 'POST',
    body: JSON.stringify({ minimo: minimo.replace(',', '.') || '0', unidade }),
  });
  return ler<{ minimo: string }>(res, 'Não foi possível salvar o mínimo.');
}

/** Itens próprios de um projeto recebidos (comprados fora do pedido). Quantidades em unidade de compra. */
export async function entradaProjeto(projeto: string, itens: { item: number; quantidade: string }[], novaCompra = false) {
  const res = await apiFetch('/estoque/entrada-projeto/', {
    method: 'POST',
    body: JSON.stringify({ projeto, itens, nova_compra: novaCompra }),
  });
  return ler<{ entradas: number }>(res, 'Não foi possível dar entrada.');
}

/** Mercadoria do pedido chegou: entra no estoque (uma única vez). */
export async function receberPedido(pedidoId: string) {
  const res = await apiFetch(`/pedidos/${pedidoId}/receber/`, { method: 'POST' });
  return ler<{ entradas: number; ja_recebido: boolean }>(res, 'Não foi possível dar entrada no pedido.');
}

// ---------- Peças prontas ----------

export type PecaPronta = {
  id: string;
  produto: string | null;
  nome: string;
  largura_mm: number;
  altura_mm: number;
  observacao: string; // ex: cor, lado de abertura
  saldo: number;
  custo_unitario: string;
};

export type MovimentoPeca = {
  id: string;
  quantidade: number;
  motivo: 'producao' | 'obra' | 'contagem' | 'saida';
  motivo_texto: string;
  observacao: string;
  projeto: string | null;
  custo_unitario: string | null;
  criado_em: string;
};

export type SimulacaoProducao = {
  materiais: { item: number; descricao: string; precisa: string; tem: string; falta: boolean }[];
  custo_total: string;
  custo_unitario: string;
  falta_algum: boolean;
};

export async function listarPecasProntas(filtro: { produto?: string; largura_mm?: number; altura_mm?: number; com_saldo?: boolean } = {}) {
  const p = new URLSearchParams();
  if (filtro.produto) p.set('produto', filtro.produto);
  if (filtro.largura_mm) p.set('largura_mm', String(filtro.largura_mm));
  if (filtro.altura_mm) p.set('altura_mm', String(filtro.altura_mm));
  if (filtro.com_saldo) p.set('com_saldo', '1');
  return ler<PecaPronta[]>(await apiFetch(`/estoque/pecas/?${p}`), 'Não foi possível carregar as peças prontas.');
}

export async function obterPecaPronta(id: string) {
  return ler<PecaPronta & { movimentos: MovimentoPeca[] }>(await apiFetch(`/estoque/pecas/${id}/`), 'Não foi possível abrir a peça.');
}

/** Contagem (o saldo passa a ser o contado) ou saída (vendida/descartada). */
export async function movimentarPeca(id: string, motivo: 'contagem' | 'saida', quantidade: number, observacao = '') {
  const res = await apiFetch(`/estoque/pecas/${id}/`, { method: 'POST', body: JSON.stringify({ motivo, quantidade, observacao }) });
  return ler<PecaPronta>(res, 'Não foi possível registrar.');
}

type DadosProducao = { produto: string; largura_mm: number; altura_mm: number; quantidade: number; observacao?: string };

export async function simularProducao(d: DadosProducao) {
  return ler<SimulacaoProducao>(await apiFetch('/estoque/pecas/simular/', { method: 'POST', body: JSON.stringify(d) }), 'Não foi possível simular.');
}

/** Tira os materiais do estoque e põe as peças prontas. */
export async function produzirPecas(d: DadosProducao) {
  return ler<PecaPronta>(await apiFetch('/estoque/pecas/produzir/', { method: 'POST', body: JSON.stringify(d) }), 'Não foi possível registrar a produção.');
}
