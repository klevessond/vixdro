// src/pdf/orcamentoPdf.web.ts  (navegador)
//
// No navegador, o orçamento abre na janela de impressão, onde o vidraceiro
// escolhe "Salvar como PDF" (ou imprime direto). Usa um quadro invisível
// dentro da própria página, e não uma janela nova, porque os navegadores
// bloqueiam janelas abertas depois de uma espera (aqui o projeto é salvo e
// calculado antes).

import { DadosOrcamento, htmlOrcamento, tituloOrcamento } from './orcamentoHtml';

export async function compartilharOrcamentoPdf(dados: DadosOrcamento): Promise<void> {
  const titulo = tituloOrcamento(dados);
  const quadro = document.createElement('iframe');
  Object.assign(quadro.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(quadro);

  const janela = quadro.contentWindow;
  if (!janela) {
    quadro.remove();
    throw new Error('O navegador não permitiu abrir a impressão.');
  }
  janela.document.open();
  janela.document.write(htmlOrcamento(dados));
  janela.document.close();
  janela.document.title = titulo;

  // O nome sugerido para o arquivo PDF vem do título da página.
  const tituloOriginal = document.title;
  document.title = titulo;

  const limpar = () => {
    document.title = tituloOriginal;
    quadro.remove();
  };
  janela.addEventListener('afterprint', limpar, { once: true });
  setTimeout(limpar, 60_000); // garantia, caso o navegador não avise o fim

  await new Promise((r) => setTimeout(r, 300)); // espera o layout montar
  janela.focus();
  janela.print();
}
