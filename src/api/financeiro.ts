// src/api/financeiro.ts
//
// Financeiro (plano Pro): contas a receber e a pagar, parcelas e resumo do mês.

import { ApiError, apiFetch } from './auth';

export type TipoLancamento = 'receber' | 'pagar';
export type FormaPagamento = 'pix' | 'dinheiro' | 'cartao' | 'boleto' | 'transferencia' | 'outra';

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'outra', rotulo: 'Outra' },
];

export type Lancamento = {
  id?: string;
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valor: string;
  vencimento: string; // aaaa-mm-dd
  pago: boolean;
  pago_em?: string | null;
  forma?: FormaPagamento | '';
  cliente?: string | null;
  cliente_nome?: string | null;
  projeto?: string | null;
  projeto_nome?: string | null;
  projeto_numero?: number | null;
  parcela?: number;
  total_parcelas?: number;
  observacoes: string;
  vencido?: boolean;
};

export type Resumo = {
  mes: string;
  receber: { total: string; recebido: string; aberto: string };
  pagar: { total: string; pago: string; aberto: string };
  saldo_realizado: string;
  saldo_previsto: string;
  vencidos: { receber: { quantidade: number; valor: string }; pagar: { quantidade: number; valor: string } };
  categorias: Record<TipoLancamento, string[]>;
};

function primeiraMensagem(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    for (const v of data) {
      const m = primeiraMensagem(v);
      if (m) return m;
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'codigo') continue;
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

const BASE = '/financeiro/lancamentos/';

export async function listarLancamentos(filtros: {
  mes?: string; // "2026-10"
  tipo?: TipoLancamento;
  situacao?: 'aberto' | 'pago' | 'vencido';
  projeto?: string;
}): Promise<Lancamento[]> {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
  return ler(await apiFetch(`${BASE}?${params}`), 'Não foi possível carregar os lançamentos.');
}

export async function obterResumo(mes: string): Promise<Resumo> {
  return ler(await apiFetch(`/financeiro/resumo/?mes=${mes}`), 'Não foi possível carregar o resumo.');
}

export async function obterLancamento(id: string): Promise<Lancamento> {
  return ler(await apiFetch(`${BASE}${id}/`), 'Não foi possível abrir o lançamento.');
}

export async function salvarLancamento(l: Lancamento): Promise<Lancamento> {
  const corpo = JSON.stringify({
    tipo: l.tipo,
    descricao: l.descricao.trim(),
    categoria: l.categoria,
    valor: l.valor.replace(',', '.'),
    vencimento: l.vencimento,
    pago: l.pago,
    pago_em: l.pago ? l.pago_em ?? null : null,
    forma: l.forma ?? '',
    cliente: l.cliente ?? null,
    projeto: l.projeto ?? null,
    observacoes: l.observacoes.trim(),
  });
  const res = l.id
    ? await apiFetch(`${BASE}${l.id}/`, { method: 'PATCH', body: corpo })
    : await apiFetch(BASE, { method: 'POST', body: corpo });
  return ler(res, 'Não foi possível salvar.');
}

export async function parcelar(dados: {
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valor_total: string;
  parcelas: number;
  primeiro_vencimento: string;
  observacoes: string;
}): Promise<Lancamento[]> {
  const res = await apiFetch(`${BASE}parcelar/`, {
    method: 'POST',
    body: JSON.stringify({ ...dados, valor_total: dados.valor_total.replace(',', '.') }),
  });
  return ler(res, 'Não foi possível criar as parcelas.');
}

export async function gerarCobrancasProjeto(dados: {
  projeto: string;
  entrada_percentual: string;
  vencimento_entrada: string;
  parcelas_restantes: number;
  primeiro_vencimento?: string;
}): Promise<Lancamento[]> {
  const res = await apiFetch(`${BASE}cobrancas-projeto/`, { method: 'POST', body: JSON.stringify(dados) });
  return ler(res, 'Não foi possível gerar as cobranças.');
}

export async function marcarPago(id: string, pago: boolean, forma?: FormaPagamento): Promise<Lancamento> {
  const res = await apiFetch(`${BASE}${id}/pagar/`, { method: 'POST', body: JSON.stringify({ pago, forma }) });
  return ler(res, 'Não foi possível atualizar.');
}

export async function excluirLancamento(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir.');
}

/** Categorias sugeridas (as mesmas do servidor). */
export const CATEGORIAS: Record<TipoLancamento, string[]> = {
  receber: ['Orçamento', 'Serviço avulso', 'Outros'],
  pagar: ['Fornecedor de alumínio', 'Vidro', 'Acessórios', 'Combustível', 'Funcionários', 'Aluguel', 'Ferramentas', 'Impostos', 'Outros'],
};
