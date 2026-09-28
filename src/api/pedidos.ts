// src/api/pedidos.ts
//
// Pedidos de compra ao fornecedor, feitos a partir de um projeto aprovado.
// O servidor calcula a lista de compra, envia e guarda o número do pedido.

import { ApiError, apiFetch } from './auth';

export type StatusPedido = 'enviando' | 'erro' | 'recebido' | 'em_separacao' | 'faturado' | 'cancelado';

export type Pedido = {
  id: string;
  projeto: string;
  fornecedor: number;
  fornecedor_nome: string;
  status: StatusPedido;
  status_texto: string;
  numero_fornecedor: string;
  total: string;
  erro: string;
  criado_em: string;
  enviado_em: string | null;
  itens: { codigo: string; descricao: string; unidade: string; quantidade: string; preco_unitario: string; subtotal: string }[];
};

/** Pedido que chegou ao fornecedor (os com erro ou cancelados não contam). */
export function pedidoAtivo(p: Pedido) {
  return p.status !== 'erro' && p.status !== 'cancelado';
}

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

export async function listarPedidos(projetoId: string): Promise<Pedido[]> {
  return ler(await apiFetch(`/pedidos/?projeto=${projetoId}`), 'Não foi possível carregar os pedidos.');
}

export async function enviarPedido(projetoId: string): Promise<Pedido[]> {
  const res = await apiFetch('/pedidos/', { method: 'POST', body: JSON.stringify({ projeto: projetoId }) });
  return ler(res, 'Não foi possível enviar o pedido.');
}

export async function reenviarPedido(id: string): Promise<Pedido> {
  return ler(await apiFetch(`/pedidos/${id}/reenviar/`, { method: 'POST' }), 'Não foi possível reenviar.');
}

export async function atualizarPedido(id: string): Promise<Pedido> {
  return ler(await apiFetch(`/pedidos/${id}/atualizar/`, { method: 'POST' }), 'Não foi possível consultar o fornecedor.');
}
