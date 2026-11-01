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
