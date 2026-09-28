// src/pdf/orcamentoPdf.ts
//
// Monta o orçamento para o CLIENTE FINAL em HTML, converte em PDF no
// próprio celular (expo-print) e abre o compartilhamento do sistema
// (WhatsApp, e-mail, salvar em arquivos...).
//
// Regra: o cliente vê só o preço de cada peça e o total. Nenhum custo de
// material, margem ou lista de compra entra neste documento.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Vidraceiro } from '@/api/auth';
import type { CalculoProjeto, Projeto } from '@/api/projetos';
import type { ClienteLocal } from '@/storage/clientesRepository';

type Dados = {
  projeto: Projeto;
  calculo: CalculoProjeto;
  vidraceiro: Vidraceiro;
  cliente: ClienteLocal | null;
};

function esc(texto: string | number | null | undefined): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reais(v: string | number): string {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function documento(d: string): string {
  const n = (d || '').replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d || '';
}

function telefone(t: string): string {
  const n = (t || '').replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return t || '';
}

function endereco(e: { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string }) {
  const linha1 = [e.rua, e.numero].filter(Boolean).join(', ') + (e.complemento ? ` - ${e.complemento}` : '');
  const linha2 = [e.bairro, [e.cidade, e.estado].filter(Boolean).join('/')].filter(Boolean).join(' - ');
  return [linha1, linha2].filter((s) => s.trim()).join(' · ');
}

function dataBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function htmlOrcamento({ projeto, calculo, vidraceiro, cliente }: Dados): string {
  const hoje = new Date();
  const validade = new Date(hoje);
  validade.setDate(validade.getDate() + (parseInt(projeto.validade_dias, 10) || 15));
  const o = calculo.orcamento;
  const temAdicional = parseFloat(o.valor_adicional) > 0;
  const temDesconto = parseFloat(o.desconto) > 0;
  const nomeEmpresa = vidraceiro.empresa || vidraceiro.nome;

  const linhas = calculo.linhas
    .map(
      (l) => `
      <tr>
        <td><strong>${esc(l.nome)}</strong><br><span class="suave">${l.largura_mm} × ${l.altura_mm} mm</span></td>
        <td class="centro">${l.quantidade}</td>
        <td class="direita">${reais(l.preco_unitario)}</td>
        <td class="direita">${reais(l.preco_total)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #16292B; font-size: 12px; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1E5B57; padding-bottom: 14px; }
  .empresa { font-size: 20px; font-weight: 800; color: #1E5B57; margin: 0 0 4px; }
  .suave { color: #546B6D; }
  .doc { text-align: right; }
  .doc h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .bloco { margin-top: 18px; }
  .rotulo { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #546B6D; margin-bottom: 3px; }
  .cliente { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #546B6D; border-bottom: 1px solid #C5D3D1; padding: 6px 4px; }
  td { padding: 9px 4px; border-bottom: 1px solid #E3EEEC; vertical-align: top; }
  .centro { text-align: center; } .direita { text-align: right; white-space: nowrap; }
  .totais { margin-left: auto; width: 55%; margin-top: 12px; }
  .totais div { display: flex; justify-content: space-between; padding: 4px 4px; }
  .total { border-top: 2px solid #1E5B57; margin-top: 4px; padding-top: 8px !important; font-size: 16px; font-weight: 800; color: #1E5B57; }
  .obs { margin-top: 22px; padding: 10px 12px; background: #F1F5F4; border-left: 3px solid #1E5B57; white-space: pre-wrap; }
  .rodape { margin-top: 30px; font-size: 10px; color: #546B6D; text-align: center; }
</style></head>
<body>
  <div class="topo">
    <div>
      <p class="empresa">${esc(nomeEmpresa)}</p>
      ${vidraceiro.empresa ? `<div>${esc(vidraceiro.nome)}</div>` : ''}
      <div class="suave">
        ${vidraceiro.cpf_cnpj ? `${documento(vidraceiro.cpf_cnpj).length > 14 ? 'CNPJ' : 'CPF'} ${esc(documento(vidraceiro.cpf_cnpj))}<br>` : ''}
        ${esc(telefone(vidraceiro.celular))} · ${esc(vidraceiro.email)}<br>
        ${esc(endereco(vidraceiro))}
      </div>
    </div>
    <div class="doc">
      <h1>ORÇAMENTO${projeto.numero ? ` Nº ${projeto.numero}` : ''}</h1>
      <div>Data: ${dataBR(hoje)}</div>
      <div class="suave">Válido até ${dataBR(validade)}</div>
    </div>
  </div>

  <div class="bloco">
    <div class="rotulo">Cliente</div>
    <div class="cliente">${esc(cliente?.nome || projeto.cliente_nome)}</div>
    ${cliente ? `<div class="suave">${[telefone(cliente.celular), cliente.email].filter(Boolean).map(esc).join(' · ')}</div>
    <div class="suave">${esc(endereco(cliente))}</div>` : ''}
  </div>

  <div class="bloco">
    <div class="rotulo">Serviço</div>
    <div><strong>${esc(projeto.nome)}</strong></div>
  </div>

  <table>
    <thead><tr><th>Descrição</th><th class="centro">Qtd.</th><th class="direita">Valor unit.</th><th class="direita">Total</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="totais">
    ${temAdicional || temDesconto ? `<div><span>Subtotal</span><span>${reais(o.subtotal)}</span></div>` : ''}
    ${temAdicional ? `<div><span>${esc(o.descricao_adicional || 'Adicional')}</span><span>${reais(o.valor_adicional)}</span></div>` : ''}
    ${temDesconto ? `<div><span>Desconto</span><span>− ${reais(o.desconto)}</span></div>` : ''}
    <div class="total"><span>Total</span><span>${reais(o.total)}</span></div>
  </div>

  ${projeto.observacoes?.trim() ? `<div class="obs">${esc(projeto.observacoes.trim())}</div>` : ''}

  <div class="rodape">Valores com material e mão de obra inclusos.</div>
</body></html>`;
}

export async function compartilharOrcamentoPdf(dados: Dados): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: htmlOrcamento(dados) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Orçamento ${dados.projeto.numero ?? ''} - ${dados.projeto.nome}`,
  });
}
