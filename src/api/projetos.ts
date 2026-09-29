// src/api/projetos.ts
//
// Chamadas de projetos. As peças do projeto usam o mesmo formato de item
// dos produtos (Componente), então o EditorRegra e o SeletorItem servem
// para os dois.

import { ApiError, apiFetch } from './auth';
import { Componente, Produto } from './produtos';

export type Peca = {
  produto: string | null; // modelo de origem (só referência)
  nome: string;
  largura_mm: number;
  altura_mm: number;
  quantidade: number;
  observacao: string;
  itens: Componente[];
};

/** Como o preço para o cliente é formado. Valores em texto, como vêm da API. */
export type Precificacao = {
  margem_percentual: string;
  mao_de_obra_m2: string;
  mao_de_obra_minima: string;
  descricao_adicional: string;
  valor_adicional: string;
  desconto: string;
  validade_dias: string;
};

export const CAMPOS_PRECO: (keyof Precificacao)[] = [
  'margem_percentual', 'mao_de_obra_m2', 'mao_de_obra_minima',
  'descricao_adicional', 'valor_adicional', 'desconto', 'validade_dias',
];

export type StatusProjeto = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';

export const STATUS_PROJETO: { valor: StatusProjeto; rotulo: string; cor: string }[] = [
  { valor: 'rascunho', rotulo: 'Rascunho', cor: '#546B6D' },
  { valor: 'enviado', rotulo: 'Enviado', cor: '#8A5A00' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: '#1E6B3A' },
  { valor: 'recusado', rotulo: 'Recusado', cor: '#A32121' },
];

export function infoStatus(s: StatusProjeto | undefined) {
  return STATUS_PROJETO.find((x) => x.valor === s) ?? STATUS_PROJETO[0];
}

export type Projeto = Precificacao & {
  id: string;
  numero?: number | null;
  status?: StatusProjeto;
  nome: string;
  cliente: string;
  cliente_nome?: string;
  observacoes: string;
  perda_percentual: string;
  linhas: Peca[];
  atualizado_em?: string;
};

export type ProjetoResumo = {
  id: string;
  numero: number | null;
  status: StatusProjeto;
  nome: string;
  cliente: string;
  cliente_nome: string;
  total_pecas: number | null;
  atualizado_em: string;
};

export type ItemCompra = {
  item: number;
  codigo: string;
  descricao: string;
  item_ativo: boolean;
  modo: 'peca_comprimento' | 'metro' | 'area' | 'unidade';
  consumo_total: string;
  comprimento_mm: number | null;
  quantidade_compra: string;
  unidade_compra: string;
  sobra_m: string | null;
  preco_unitario: string;
  custo: string;
};

export type LinhaCalculada = {
  nome: string;
  largura_mm: number;
  altura_mm: number;
  quantidade: number;
  area_m2: string;
  custo_unitario: string;
  custo_total: string;
  mao_de_obra_unitaria: string;
  preco_unitario: string; // o que o cliente paga por unidade
  preco_total: string;
};

export type CalculoProjeto = {
  perda_percentual: string;
  orcamento: {
    subtotal: string;
    descricao_adicional: string;
    valor_adicional: string;
    desconto: string;
    total: string;
    material_com_perda: string; // só para o vidraceiro
    lucro_material: string;
    mao_de_obra: string;
  };
  linhas: LinhaCalculada[];
  custo_materiais: string;
  lista_compra: ItemCompra[];
  custo_compra: string;
};

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

async function ler<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(res.status, data, primeiraMensagem(data) ?? padrao);
  return data as T;
}

function itensParaEnvio(itens: Componente[]) {
  return itens.map(({ item_detalhe, ...resto }) => resto);
}

/** Campos numéricos vazios viram "0" (o servidor não aceita texto vazio). */
function precoParaEnvio(p: Precificacao) {
  const num = (v: string) => (v && v.trim() ? v.replace(',', '.') : '0');
  return {
    margem_percentual: num(p.margem_percentual),
    mao_de_obra_m2: num(p.mao_de_obra_m2),
    mao_de_obra_minima: num(p.mao_de_obra_minima),
    descricao_adicional: p.descricao_adicional.trim(),
    valor_adicional: num(p.valor_adicional),
    desconto: num(p.desconto),
    validade_dias: num(p.validade_dias) === '0' ? '15' : num(p.validade_dias),
  };
}

function corpoProjeto(p: Projeto) {
  return {
    id: p.id,
    nome: p.nome,
    cliente: p.cliente,
    observacoes: p.observacoes,
    perda_percentual: p.perda_percentual || '0',
    ...precoParaEnvio(p),
    linhas: p.linhas.map((l) => ({ ...l, itens: itensParaEnvio(l.itens) })),
  };
}

/** Margem e mão de obra do último projeto, para preencher um projeto novo. */
export async function obterPadroes(): Promise<Precificacao & { perda_percentual: string }> {
  return ler(await apiFetch('/projetos/padroes/'), 'Não foi possível carregar os padrões.');
}

/** Cria a peça a partir de um modelo: copia os itens e as regras. */
export function pecaDoProduto(produto: Produto): Peca {
  return {
    produto: produto.id ?? null,
    nome: produto.nome,
    largura_mm: 0,
    altura_mm: 0,
    quantidade: 1,
    observacao: '',
    itens: produto.componentes.map((c) => ({ ...c })),
  };
}

/** busca: nome do projeto, nº do orçamento, nome/empresa, celular ou CPF/CNPJ do cliente. */
export async function listarProjetos(busca = ''): Promise<ProjetoResumo[]> {
  const q = busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : '';
  return ler(await apiFetch(`/projetos/${q}`), 'Não foi possível carregar os projetos.');
}

export async function obterProjeto(id: string): Promise<Projeto> {
  return ler(await apiFetch(`/projetos/${id}/`), 'Não foi possível abrir o projeto.');
}

/** jaExiste = o projeto já foi salvo antes (então é uma edição). */
export async function salvarProjeto(p: Projeto, jaExiste: boolean): Promise<Projeto> {
  const init = { method: jaExiste ? 'PUT' : 'POST', body: JSON.stringify(corpoProjeto(p)) };
  const res = await apiFetch(jaExiste ? `/projetos/${p.id}/` : '/projetos/', init);
  return ler(res, 'Não foi possível salvar o projeto.');
}

export async function arquivarProjeto(id: string): Promise<void> {
  const res = await apiFetch(`/projetos/${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir o projeto.');
}

export async function calcularProjeto(p: Projeto): Promise<CalculoProjeto> {
  const res = await apiFetch('/projetos/calcular/', {
    method: 'POST',
    body: JSON.stringify({
      perda_percentual: p.perda_percentual || '0',
      ...precoParaEnvio(p),
      linhas: p.linhas.map((l) => ({
        nome: l.nome,
        largura_mm: l.largura_mm,
        altura_mm: l.altura_mm,
        quantidade: l.quantidade,
        itens: itensParaEnvio(l.itens),
      })),
    }),
  });
  return ler(res, 'Não foi possível calcular.');
}

export async function alterarStatus(id: string, status: StatusProjeto): Promise<StatusProjeto> {
  const res = await apiFetch(`/projetos/${id}/status/`, { method: 'POST', body: JSON.stringify({ status }) });
  const data = await ler<{ status: StatusProjeto }>(res, 'Não foi possível mudar o status.');
  return data.status;
}
