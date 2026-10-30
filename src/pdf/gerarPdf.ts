// src/pdf/gerarPdf.ts  (celular)
//
// Gera um PDF a partir de um HTML e abre o compartilhamento do sistema
// (WhatsApp, e-mail, salvar em arquivos...). Serve para qualquer documento
// novo; no navegador, o Expo usa o gerarPdf.web.ts no lugar deste arquivo.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function compartilharPdf(html: string, titulo: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
}
