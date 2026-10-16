// src/ui/tema.ts
//
// O padrão visual do app num lugar só: cores, espaçamentos, cantos e
// sombras. Telas novas (e as que forem redesenhadas) usam daqui, para
// tudo ficar com a mesma cara.

import { Platform, ViewStyle } from 'react-native';

export const cor = {
  marca: '#1E5B57', // verde da borda do vidro: cabeçalhos e botões
  marcaEscura: '#15433F', // botão pressionado
  marcaClara: '#E6EFED', // fundo de ícones e destaques suaves
  fundo: '#F4F7F6', // fundo das telas
  cartao: '#FFFFFF',
  borda: '#DCE5E3',
  texto: '#16292B',
  textoSuave: '#5B6F71',
  textoSobreMarca: '#FFFFFF',
  textoSobreMarcaSuave: '#CFE2DF',
  alerta: '#8A5A00',
  alertaFundo: '#FFF4DC',
  erro: '#A32121',
  erroFundo: '#FBECEC',
};

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const raio = { campo: 8, botao: 8, cartao: 14, icone: 12 };

/** Sombra leve dos cartões, igual no celular e no navegador. */
export const sombra: ViewStyle = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(22, 41, 43, 0.06), 0 2px 8px rgba(22, 41, 43, 0.04)' } as ViewStyle,
  default: {
    shadowColor: '#16292B',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
})!;

/** Colunas do painel conforme a largura da tela. */
export function colunasPara(largura: number): number {
  if (largura >= 1024) return 3;
  if (largura >= 680) return 2;
  return 1;
}

/** Largura máxima do conteúdo em telas grandes (o fundo continua ocupando tudo). */
export const LARGURA_CONTEUDO = 1180;
export const LARGURA_FORMULARIO = 960;
