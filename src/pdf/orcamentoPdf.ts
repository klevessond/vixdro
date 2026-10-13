// src/pdf/orcamentoPdf.ts  (celular)
//
// Converte o orçamento em PDF no próprio celular (expo-print) e abre o
// compartilhamento do sistema (WhatsApp, e-mail, salvar em arquivos...).
// No navegador, o Expo usa o orcamentoPdf.web.ts no lugar deste arquivo.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { DadosOrcamento, htmlOrcamento, tituloOrcamento } from './orcamentoHtml';

export async function compartilharOrcamentoPdf(dados: DadosOrcamento): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: htmlOrcamento(dados) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: tituloOrcamento(dados),
  });
}
