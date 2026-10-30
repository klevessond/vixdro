// src/pdf/listaCompraHtml.ts
//
// Lista de compra em PDF: os itens a comprar para um projeto, separados por
// fornecedor, já descontando o que sai do estoque. Pode ir para outro
// fornecedor (pedido ou cotação), então NÃO leva os dados do cliente, só a
// referência do orçamento. Com ou sem preços (sem preços: para cotação).

import type { Vidraceiro } from '@/api/auth';
import type { CalculoProjeto, ItemCompra, Projeto } from '@/api/projetos';

export type QuaisItens = 'todos' | 'catalogo' | 'proprios';

export type DadosListaCompra = {
  projeto: Projeto;
  calculo: CalculoProjeto;
  vidraceiro: Vidraceiro | null;
  logo?: string | null;
  quais: QuaisItens;
  comPrecos: boolean;
};

const esc = (t: string | number | null | undefined) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reais = (v: string | number) =>
  (typeof v === 'number' ? v : parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number, casas = 3) =>
  (typeof v === 'number' ? v : parseFloat(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

function telefone(t?: string | null): string {
  const n = (t || '').replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return t || '';
}

/** "2 barras de 6,00 m", "20 un", "3,5 m²". */
function quantidade(x: ItemCompra): string {
  const q = parseFloat(x.quantidade_pedir) || 0;
  if (x.unidade_compra === 'peça' && x.comprimento_mm) {
    const m = (x.comprimento_mm / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return `${num(q)} ${q === 1 ? 'barra' : 'barras'} de ${m} m`;
  }
  return `${num(q)} ${x.unidade_compra}`;
}

export function filtrarItens(calculo: CalculoProjeto, quais: QuaisItens): ItemCompra[] {
  return calculo.lista_compra.filter((x) => {
    if ((parseFloat(x.quantidade_pedir) || 0) <= 0) return false; // tudo do estoque: não compra
    if (quais === 'catalogo') return !x.proprio;
    if (quais === 'proprios') return !!x.proprio;
    return true;
  });
}

export function tituloListaCompra({ projeto }: DadosListaCompra): string {
  return `Lista de compra${projeto.numero ? ` - Orçamento ${projeto.numero}` : ''}`;
}

export function htmlListaCompra(d: DadosListaCompra): string {
  const { projeto, vidraceiro, logo, comPrecos } = d;
  const itens = filtrarItens(d.calculo, d.quais);

  // Agrupa por fornecedor (itens próprios ficam juntos, como "outros fornecedores").
  const grupos = new Map<string, ItemCompra[]>();
  for (const x of itens) {
    const nome = x.proprio ? 'Outros fornecedores (itens próprios)' : x.fornecedor ?? 'Fornecedor';
    grupos.set(nome, [...(grupos.get(nome) ?? []), x]);
  }

  const tabelas = [...grupos.entries()].map(([fornecedor, lista]) => {
    const total = lista.reduce((t, x) => t + (parseFloat(x.custo_pedir) || 0), 0);
    const linhas = lista.map((x) => {
      const doEstoque = parseFloat(x.quantidade_estoque) || 0;
      return `<tr>
        <td>${x.proprio ? '' : esc(x.codigo)}</td>
        <td>${esc(x.descricao)}${doEstoque > 0 ? `<div class="obs">já tenho em estoque: ${num(doEstoque)}</div>` : ''}</td>
        <td class="qtd">${quantidade(x)}</td>
        ${comPrecos ? `<td class="dir">${reais(x.preco_unitario)}</td><td class="dir">${reais(x.custo_pedir)}</td>` : ''}
      </tr>`;
    });
    return `<h2>${esc(fornecedor)}</h2>
      <table>
        <thead><tr><th>Código</th><th>Descrição</th><th class="qtd">Quantidade</th>${comPrecos ? '<th class="dir">Preço unit.</th><th class="dir">Total</th>' : ''}</tr></thead>
        <tbody>${linhas.join('')}</tbody>
        ${comPrecos ? `<tfoot><tr><td colspan="4" class="dir">Total ${esc(fornecedor)}</td><td class="dir">${reais(total)}</td></tr></tfoot>` : ''}
      </table>`;
  });

  const totalGeral = itens.reduce((t, x) => t + (parseFloat(x.custo_pedir) || 0), 0);
  const contato = [telefone(vidraceiro?.celular), vidraceiro?.email].filter(Boolean).join(' · ');
  const hoje = new Date().toLocaleDateString('pt-BR');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(tituloListaCompra(d))}</title>
<style>
  @page { margin: 16mm 14mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #16292B; font-size: 12px; }
  .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1E5B57; padding-bottom: 10px; }
  .topo img { max-height: 56px; max-width: 180px; }
  .empresa { font-size: 15px; font-weight: 700; }
  .contato { color: #5B6F71; margin-top: 2px; }
  h1 { font-size: 18px; margin: 16px 0 2px; color: #1E5B57; }
  .ref { color: #5B6F71; margin-bottom: 8px; }
  h2 { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #5B6F71; border-bottom: 1px solid #D6E1DF; padding: 6px 4px; }
  td { border-bottom: 1px solid #EEF2F1; padding: 7px 4px; vertical-align: top; }
  .qtd { white-space: nowrap; font-weight: 700; }
  .dir { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; border-bottom: none; }
  .obs { color: #8A5A00; font-size: 11px; margin-top: 2px; }
  .total { margin-top: 14px; text-align: right; font-size: 14px; font-weight: 700; }
  .rodape { margin-top: 24px; color: #5B6F71; font-size: 11px; }
  .vazio { margin-top: 20px; color: #5B6F71; }
</style></head><body>
  <div class="topo">
    <div>
      <div class="empresa">${esc(vidraceiro?.empresa || vidraceiro?.nome || '')}</div>
      ${contato ? `<div class="contato">${esc(contato)}</div>` : ''}
    </div>
    ${logo ? `<img src="${logo}" alt="">` : ''}
  </div>
  <h1>LISTA DE COMPRA</h1>
  <div class="ref">Ref.: ${projeto.numero ? `Orçamento nº ${projeto.numero} · ` : ''}${esc(projeto.nome)} · ${hoje}</div>
  ${itens.length ? tabelas.join('') : '<div class="vazio">Nenhum item a comprar nesta seleção (tudo sai do estoque, ou não há itens deste tipo).</div>'}
  ${comPrecos && grupos.size > 1 ? `<div class="total">Total da compra: ${reais(totalGeral)}</div>` : ''}
  <div class="rodape">Quantidades já com a perda de corte e descontando o que sai do estoque.${comPrecos ? ' Preços de referência do catálogo.' : ''}</div>
</body></html>`;
}
