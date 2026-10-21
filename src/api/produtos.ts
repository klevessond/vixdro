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
  tipo?: TipoItem; // perfil, acessório, vidro, vedação ou outro
  imagem_url?: string | null; // enviada pela equipe no admin
  miniatura_url?: string | null;
};

/** proprio = "Meus itens": os itens que o vidraceiro cadastrou (ex: vidros). */
export type Fornecedor = { id: number; nome: string; slug: string; proprio: boolean };

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
  // Só para itens vendidos em barra: cobrar a barra inteira (padrão) ou só os metros usados.
  cobranca?: Cobranca;
};

export type Cobranca = 'inteira' | 'metro';

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
  // Calculados pelo servidor, só para leitura:
  custo_referencia?: string; // custo dos itens numa peça de 1,00 x 1,00 m
  custo_depende_medida?: boolean; // false = custo exato (só quantidades fixas)
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

export type TipoItem = 'perfil' | 'acessorio' | 'vidro' | 'vedacao' | 'outro';

/** Abas da busca do catálogo. */
export const TIPOS_ITEM: { valor: TipoItem | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'perfil', rotulo: 'Perfis' },
  { valor: 'acessorio', rotulo: 'Acessórios' },
  { valor: 'vedacao', rotulo: 'Vedações' },
  { valor: 'vidro', rotulo: 'Vidros' },
  { valor: 'outro', rotulo: 'Outros' },
];

export async function buscarItens(fornecedor: number, busca: string, tipo: TipoItem | '' = ''): Promise<ItemCatalogo[]> {
  const params = new URLSearchParams({ fornecedor: String(fornecedor), tamanho: '50' });
  if (busca.trim()) params.set('busca', busca.trim());
  if (tipo) params.set('tipo', tipo);
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

const DISCRETAS = new Set(['UN', 'PC', 'PÇ', 'PAR', 'CX', 'JG', 'KIT', 'CJ']);

/** Unidade em que o consumo é contado: "m" (perfis), "m²" (vidro) ou "un". */
export function unidadeConsumo(item: ItemCatalogo): string {
  const m = modoDoItem(item);
  return m === 'area' ? 'm²' : m === 'unidade' ? 'un' : 'm';
}

/** Quantidade fixa (não depende da medida da peça)? */
export function ehFixa(c: Componente): boolean {
  return numero(c.coef_largura) === 0 && numero(c.coef_altura) === 0 && numero(c.coef_area) === 0;
}

/** Quanto do item vai em UMA peça com estas medidas (mesma conta do servidor). */
export function consumoPorPeca(c: Componente, largura_mm: number, altura_mm: number): number {
  const L = largura_mm / 1000;
  const A = altura_mm / 1000;
  let q = numero(c.coef_largura) * L + numero(c.coef_altura) * A + numero(c.coef_area) * L * A + numero(c.ajuste);
  q = Math.max(0, q);
  if (modoDoItem(c.item_detalhe) === 'unidade' && DISCRETAS.has(c.item_detalhe.unidade)) q = Math.ceil(q - 1e-9);
  return q;
}

/** Item vendido em barra (perfis): é o único em que a cobrança inteira/metro faz diferença. */
export function vendidoEmBarra(item: ItemCatalogo): boolean {
  return modoDoItem(item) === 'peca_comprimento' && !!item.comprimento_mm;
}

/** Barras inteiras necessárias para o total das unidades da peça (mesma conta do servidor). */
export function barrasNecessarias(c: Componente, largura_mm: number, altura_mm: number, quantidade: number): number {
  const comprimento = (c.item_detalhe.comprimento_mm ?? 0) / 1000;
  if (!comprimento) return 0;
  return Math.ceil((consumoPorPeca(c, largura_mm, altura_mm) * quantidade) / comprimento - 1e-9);
}

/**
 * Custo do item para TODAS as unidades da peça. Em itens de barra, conforme a
 * cobrança: barras inteiras (padrão) ou só os metros usados. O arredondamento
 * é sobre o total: 4 janelas de 2 m (8 m) pagam 2 barras, e não 4.
 */
export function custoTotalItem(c: Componente, largura_mm: number, altura_mm: number, quantidade: number): number {
  const item = c.item_detalhe;
  const preco = numero(item.preco);
  const total = consumoPorPeca(c, largura_mm, altura_mm) * quantidade;
  if (vendidoEmBarra(item)) {
    if ((c.cobranca ?? 'inteira') === 'metro') return (total / (item.comprimento_mm! / 1000)) * preco;
    return barrasNecessarias(c, largura_mm, altura_mm, quantidade) * preco;
  }
  return total * preco;
}

/** Converte "1,20" (metros) em 1200 (mm). Vazio ou inválido vira 0. */
export function metrosParaMm(texto: string): number {
  const n = parseFloat(String(texto).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

/** 1200 (mm) vira "1,2"; 0 vira "" (campo vazio). */
export function mmParaMetros(mm: number): string {
  return mm ? String(mm / 1000).replace('.', ',') : '';
}

/** Resumo legível da regra, ex: "2 m por peça", "4 un por peça" ou "2× largura + 2× altura". */
export function resumoRegra(c: Componente): string {
  const un = unidadeConsumo(c.item_detalhe);
  if (ehFixa(c)) return `${fmt(numero(c.ajuste), 3)} ${un} por peça`;

  const partes: string[] = [];
  const cl = numero(c.coef_largura);
  const ca = numero(c.coef_altura);
  const car = numero(c.coef_area);
  if (cl) partes.push(`${fmt(cl)}× largura`);
  if (ca) partes.push(`${fmt(ca)}× altura`);
  if (car) partes.push(`${fmt(car)}× área`);
  let texto = partes.join(' + ');
  const aj = numero(c.ajuste);
  if (aj) {
    const ajusteTexto = un === 'm' ? `${fmt(Math.abs(aj) * 1000, 0)} mm` : `${fmt(Math.abs(aj), 3)} ${un}`;
    texto += ` ${aj < 0 ? '−' : '+'} ${ajusteTexto}`;
  }
  return texto;
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

// ---------- Itens próprios (o que não está no catálogo do fornecedor) ----------

export type NovoItemProprio = {
  id?: number;
  codigo: string;
  descricao: string;
  unidade: 'M' | 'M2' | 'UN';
  comprimento_mm: number | null; // só para peças inteiras (barras)
  preco: string;
};

export async function listarMeusItens(): Promise<ItemCatalogo[]> {
  return lerResposta(await apiFetch('/meus-itens/'), 'Não foi possível carregar seus itens.');
}

export async function salvarMeuItem(item: NovoItemProprio): Promise<ItemCatalogo> {
  const corpo = JSON.stringify({ ...item, preco: item.preco.replace(',', '.') });
  const res = item.id
    ? await apiFetch(`/meus-itens/${item.id}/`, { method: 'PATCH', body: corpo })
    : await apiFetch('/meus-itens/', { method: 'POST', body: corpo });
  return lerResposta(res, 'Não foi possível salvar o item.');
}

export async function excluirMeuItem(id: number): Promise<void> {
  const res = await apiFetch(`/meus-itens/${id}/`, { method: 'DELETE' });
  if (!res.ok) await lerResposta(res, 'Não foi possível excluir o item.');
}
