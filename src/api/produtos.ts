// src/api/produtos.ts
//
// Chamadas de produtos e catálogo. Tudo passa pelo apiFetch do auth.ts,
// que coloca o token e renova quando expira.

import { ApiError, apiFetch } from './auth';

export type ItemCatalogo = {
  id: number;
  fornecedor: number;
  codigo: string;
  descricao: string;
  unidade: string;
  comprimento_mm: number | null;
  preco: string;
  estoque: string | null;
  ativo: boolean;
};

export type Fornecedor = { id: number; nome: string; slug: string };

/** Como o consumo do item é medido. Mesma regra do servidor (produtos/calculo.py). */
export type Modo = 'peca_comprimento' | 'metro' | 'area' | 'unidade';

export type Componente = {
  item: number;
  item_detalhe: ItemCatalogo; // no envio o servidor ignora este campo
  coef_largura: string;
  coef_altura: string;
  coef_area: string;
  ajuste: string; // metros para perfis, m² para vidro, unidades para acessórios
  observacao: string;
};

export type Categoria = 'janela' | 'porta' | 'portao' | 'box' | 'outro';

export const CATEGORIAS: { valor: Categoria; rotulo: string }[] = [
  { valor: 'janela', rotulo: 'Janela' },
  { valor: 'porta', rotulo: 'Porta' },
  { valor: 'portao', rotulo: 'Portão' },
  { valor: 'box', rotulo: 'Box' },
  { valor: 'outro', rotulo: 'Outro' },
];

export type Produto = {
  id?: string;
  nome: string;
  categoria: Categoria;
  descricao: string;
  componentes: Componente[];
  atualizado_em?: string;
};

export type LinhaSimulacao = {
  item: number;
  codigo: string;
  descricao: string;
  item_ativo: boolean;
  modo: Modo;
  consumo: string;
  unidade_consumo: string;
  pecas: string | null;
  comprimento_mm: number | null;
  preco_unitario: string;
  custo: string;
  observacao: string;
};

export type Simulacao = {
  largura_mm: number;
  altura_mm: number;
  linhas: LinhaSimulacao[];
  custo_total: string;
};

// ---------- Utilidades ----------

export function modoDoItem(item: ItemCatalogo): Modo {
  if (item.comprimento_mm) return 'peca_comprimento';
  if (item.unidade === 'M') return 'metro';
  if (item.unidade === 'M2') return 'area';
  return 'unidade';
}

/** Primeira mensagem de erro encontrada na resposta do servidor, por mais aninhada que esteja. */
function primeiraMensagem(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    for (const v of data) {
      const m = primeiraMensagem(v);
      if (m) return m;
    }
  } else if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      const m = primeiraMensagem(v);
      if (m) return m;
    }
  }
  return null;
}

async function lerResposta<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data, primeiraMensagem(data) ?? padrao);
  }
  return data as T;
}

function paraEnvio(c: Componente) {
  const { item_detalhe, ...resto } = c;
  return resto;
}

// ---------- Catálogo ----------

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const res = await apiFetch('/fornecedores/');
  return lerResposta(res, 'Não foi possível carregar os fornecedores.');
}

export async function buscarItens(fornecedor: number, busca: string): Promise<ItemCatalogo[]> {
  const params = new URLSearchParams({ fornecedor: String(fornecedor), tamanho: '50' });
  if (busca.trim()) params.set('busca', busca.trim());
  const res = await apiFetch(`/catalogo/itens/?${params}`);
  const data = await lerResposta<{ itens: ItemCatalogo[] }>(res, 'Não foi possível buscar os itens.');
  return data.itens;
}

// ---------- Produtos ----------

export async function listarProdutos(): Promise<Produto[]> {
  const res = await apiFetch('/produtos/');
  return lerResposta(res, 'Não foi possível carregar os produtos.');
}

export async function obterProduto(id: string): Promise<Produto> {
  const res = await apiFetch(`/produtos/${id}/`);
  return lerResposta(res, 'Não foi possível abrir o produto.');
}

export async function salvarProduto(p: Produto): Promise<Produto> {
  const corpo = JSON.stringify({
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    componentes: p.componentes.map(paraEnvio),
  });
  const res = p.id
    ? await apiFetch(`/produtos/${p.id}/`, { method: 'PUT', body: corpo })
    : await apiFetch('/produtos/', { method: 'POST', body: corpo });
  return lerResposta(res, 'Não foi possível salvar o produto.');
}

export async function arquivarProduto(id: string): Promise<void> {
  const res = await apiFetch(`/produtos/${id}/`, { method: 'DELETE' });
  if (!res.ok) await lerResposta(res, 'Não foi possível excluir o produto.');
}

export async function simular(
  largura_mm: number,
  altura_mm: number,
  componentes: Componente[]
): Promise<Simulacao> {
  const res = await apiFetch('/produtos/simular/', {
    method: 'POST',
    body: JSON.stringify({ largura_mm, altura_mm, componentes: componentes.map(paraEnvio) }),
  });
  return lerResposta(res, 'Não foi possível calcular.');
}

// ---------- Formatação ----------

export function numero(txt: string | number): number {
  const n = typeof txt === 'number' ? txt : parseFloat(String(txt).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function reais(valor: string | number): string {
  return numero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmt(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/** Resumo legível da regra, ex: "2×L + 2×A − 30 mm" ou "4 un". */
export function resumoRegra(c: Componente): string {
  const modo = modoDoItem(c.item_detalhe);
  const partes: string[] = [];
  const cl = numero(c.coef_largura);
  const ca = numero(c.coef_altura);
  const car = numero(c.coef_area);
  const aj = numero(c.ajuste);

  if (cl) partes.push(`${fmt(cl)}×L`);
  if (ca) partes.push(`${fmt(ca)}×A`);
  if (car) partes.push(`${fmt(car)}×(L×A)`);

  if (aj) {
    const usaMm = modo === 'peca_comprimento' || modo === 'metro';
    const texto = usaMm ? `${fmt(Math.abs(aj) * 1000, 0)} mm` : `${fmt(Math.abs(aj), 3)} ${modo === 'area' ? 'm²' : 'un'}`;
    if (partes.length === 0) partes.push(aj < 0 ? `−${texto}` : texto);
    else partes.push(`${aj < 0 ? '−' : '+'} ${texto}`);
  }
  return partes.join(' + ').replace(/\+ ([+−])/g, '$1') || 'sem regra';
}

/** Descrição curta de como o item é vendido, ex: "barra de 6 m" ou "por m²". */
export function comoEVendido(item: ItemCatalogo): string {
  switch (modoDoItem(item)) {
    case 'peca_comprimento':
      return `peça de ${fmt((item.comprimento_mm ?? 0) / 1000)} m`;
    case 'metro':
      return 'por metro';
    case 'area':
      return 'por m²';
    default:
      return `por ${item.unidade.toLowerCase()}`;
  }
}
