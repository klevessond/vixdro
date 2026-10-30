// src/pdf/gerarPdf.web.ts  (navegador)
//
// Abre o documento na janela de impressão, onde se escolhe "Salvar como PDF".
// Usa um quadro invisível na própria página (janelas novas são bloqueadas
// pelos navegadores depois de uma espera).

export async function compartilharPdf(html: string, titulo: string): Promise<void> {
  const quadro = document.createElement('iframe');
  Object.assign(quadro.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(quadro);
  const janela = quadro.contentWindow;
  if (!janela) {
    quadro.remove();
    throw new Error('O navegador não permitiu abrir a impressão.');
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.document.title = titulo;

  // O nome sugerido para o arquivo vem do título da página.
  const tituloOriginal = document.title;
  document.title = titulo;
  const limpar = () => {
    document.title = tituloOriginal;
    quadro.remove();
  };
  janela.addEventListener('afterprint', limpar, { once: true });
  setTimeout(limpar, 60_000);

  await new Promise((r) => setTimeout(r, 300)); // espera o layout montar
  janela.focus();
  janela.print();
}
