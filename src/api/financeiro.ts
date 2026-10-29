// src/api/financeiro.ts
//
// Financeiro (plano Pro): contas a receber e a pagar, parcelas e resumo do mês.

import { ApiError, apiFetch } from './auth';
import { numero, reais } from './produtos';

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
  conta?: string | null; // conta de caixa onde entrou/saiu (quando pago)
  conta_nome?: string | null;
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
  contas: Conta[];
  categorias: Record<TipoLancamento, string[]>;
};

/** Período do filtro: datas "aaaa-mm-dd" (de/até), um mês "aaaa-mm" ou tudo. */
export type FiltroPeriodo = { de?: string; ate?: string; mes?: string };

function paramsPeriodo(f: FiltroPeriodo): URLSearchParams {
  const p = new URLSearchParams();
  if (f.de || f.ate) {
    if (f.de) p.set('de', f.de);
    if (f.ate) p.set('ate', f.ate);
  } else {
    p.set('mes', f.mes ?? 'todos');
  }
  return p;
}

// ---------- Contas de caixa (Pro) ----------

export type TipoConta = 'dinheiro' | 'banco' | 'cartao' | 'outro';

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string; icone: string }[] = [
  { valor: 'dinheiro', rotulo: 'Caixa (dinheiro)', icone: 'cash' },
  { valor: 'banco', rotulo: 'Banco (Pix, transferência)', icone: 'bank-outline' },
  { valor: 'cartao', rotulo: 'Cartão (crédito, débito)', icone: 'credit-card-outline' },
  { valor: 'outro', rotulo: 'Outro', icone: 'wallet-outline' },
];

export type Conta = { id?: string; nome: string; tipo: TipoConta; saldo_inicial: string; saldo?: string };

/** Conta sugerida pela forma (Pix -> banco; dinheiro -> caixa). Igual ao servidor. */
export function tipoContaDaForma(forma?: FormaPagamento | ''): TipoConta | null {
  if (forma === 'dinheiro') return 'dinheiro';
  if (forma === 'pix' || forma === 'transferencia' || forma === 'boleto') return 'banco';
  if (forma === 'cartao') return 'cartao';
  return null;
}

// ---------- Formas de pagamento (plano gratuito) ----------

export type TipoCondicao = 'avista' | 'parcelado' | 'entrada';

export const TIPOS_CONDICAO: { valor: TipoCondicao; rotulo: string }[] = [
  { valor: 'avista', rotulo: 'À vista' },
  { valor: 'parcelado', rotulo: 'Parcelado' },
  { valor: 'entrada', rotulo: 'Entrada + parcelas' },
];

export type Condicao = {
  id?: string;
  nome: string;
  tipo: TipoCondicao;
  desconto_percentual: string;
  acrescimo_percentual: string;
  max_parcelas: number;
  entrada_percentual: string;
};

/** Valores de uma condição para um total (a mesma conta do servidor). */
export function simularCondicao(c: Condicao, total: number, parcelas?: number) {
  const cent = (v: number) => Math.round(v * 100) / 100;
  if (c.tipo === 'avista') {
    const final = cent(total * (1 - Number(c.desconto_percentual || 0) / 100));
    return { total: final, entrada: 0, parcelas: 1, valorParcela: final };
  }
  const final = cent(total * (1 + Number(c.acrescimo_percentual || 0) / 100));
  const n = Math.max(1, Math.min(parcelas ?? c.max_parcelas, c.max_parcelas));
  const entrada = c.tipo === 'entrada' ? cent((final * Number(c.entrada_percentual || 0)) / 100) : 0;
  const resto = final - entrada;
  return { total: final, entrada, parcelas: n, valorParcela: resto > 0 ? Math.floor((resto / n) * 100) / 100 : 0 };
}

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

export async function listarLancamentos(filtros: FiltroPeriodo & {
  tipo?: TipoLancamento;
  situacao?: 'aberto' | 'pago' | 'vencido';
  projeto?: string;
  conta?: string;
}): Promise<Lancamento[]> {
  const { de, ate, mes, ...resto } = filtros;
  const params = resto.projeto ? new URLSearchParams() : paramsPeriodo({ de, ate, mes });
  Object.entries(resto).forEach(([k, v]) => v && params.set(k, v));
  return ler(await apiFetch(`${BASE}?${params}`), 'Não foi possível carregar os lançamentos.');
}

export async function obterResumo(filtro: FiltroPeriodo): Promise<Resumo> {
  return ler(await apiFetch(`/financeiro/resumo/?${paramsPeriodo(filtro)}`), 'Não foi possível carregar o resumo.');
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
  vencimento_entrada: string;
  // Pela forma de pagamento combinada...
  condicao?: string;
  parcelas?: number;
  // ...ou personalizado.
  entrada_percentual?: string;
  parcelas_restantes?: number;
  primeiro_vencimento?: string;
}): Promise<Lancamento[]> {
  const res = await apiFetch(`${BASE}cobrancas-projeto/`, { method: 'POST', body: JSON.stringify(dados) });
  return ler(res, 'Não foi possível gerar as cobranças.');
}

export async function marcarPago(
  id: string,
  pago: boolean,
  extra: { forma?: FormaPagamento | ''; conta?: string | null; pago_em?: string } = {}
): Promise<Lancamento> {
  const res = await apiFetch(`${BASE}${id}/pagar/`, { method: 'POST', body: JSON.stringify({ pago, ...extra }) });
  return ler(res, 'Não foi possível atualizar.');
}

export async function listarContas(): Promise<Conta[]> {
  return ler(await apiFetch('/financeiro/contas/'), 'Não foi possível carregar as contas.');
}

export async function salvarConta(c: Conta): Promise<Conta> {
  const corpo = JSON.stringify({ nome: c.nome.trim(), tipo: c.tipo, saldo_inicial: String(c.saldo_inicial || '0').replace(',', '.') });
  const res = c.id
    ? await apiFetch(`/financeiro/contas/${c.id}/`, { method: 'PATCH', body: corpo })
    : await apiFetch('/financeiro/contas/', { method: 'POST', body: corpo });
  return ler(res, 'Não foi possível salvar a conta.');
}

export async function excluirConta(id: string): Promise<void> {
  const res = await apiFetch(`/financeiro/contas/${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir.');
}

export async function listarCondicoes(): Promise<Condicao[]> {
  return ler(await apiFetch('/condicoes-pagamento/'), 'Não foi possível carregar as formas de pagamento.');
}

export async function salvarCondicao(c: Condicao): Promise<Condicao> {
  const num = (v: string | number) => String(v || '0').replace(',', '.');
  const corpo = JSON.stringify({
    nome: c.nome.trim(), tipo: c.tipo, desconto_percentual: num(c.desconto_percentual),
    acrescimo_percentual: num(c.acrescimo_percentual), max_parcelas: c.max_parcelas || 1,
    entrada_percentual: num(c.entrada_percentual),
  });
  const res = c.id
    ? await apiFetch(`/condicoes-pagamento/${c.id}/`, { method: 'PATCH', body: corpo })
    : await apiFetch('/condicoes-pagamento/', { method: 'POST', body: corpo });
  return ler(res, 'Não foi possível salvar a forma de pagamento.');
}

export async function excluirCondicao(id: string): Promise<void> {
  const res = await apiFetch(`/condicoes-pagamento/${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir.');
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

/** "À vista: R$ 950,00" / "Até 3x de R$ 333,33" / "R$ 500,00 de entrada + 1x de R$ 500,00" */
export function textoCondicao(c: Condicao, total: number): string {
  const v = simularCondicao(c, total);
  if (c.tipo === 'avista') return `${reais(v.total)}${numero(c.desconto_percentual) > 0 ? ` (${numero(c.desconto_percentual).toLocaleString('pt-BR')}% de desconto)` : ''}`;
  const parcelas = `${v.parcelas}x de ${reais(v.valorParcela)}`;
  if (c.tipo === 'entrada') return `${reais(v.entrada)} de entrada + ${parcelas}`;
  return `${v.parcelas > 1 ? 'até ' : ''}${parcelas}`;
}
