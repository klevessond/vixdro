// src/util/contato.ts
//
// Atalhos para falar com o cliente e chegar até a obra: WhatsApp com
// mensagem pronta e endereço no mapa. Funcionam no celular e no navegador.

import { Linking } from 'react-native';

/** Celular brasileiro para o link do WhatsApp: só dígitos, com o 55 na frente. */
export function numeroWhatsApp(celular: string | null | undefined): string | null {
  const d = (celular || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export async function abrirWhatsApp(celular: string, mensagem: string): Promise<void> {
  const numero = numeroWhatsApp(celular);
  if (!numero) throw new Error('Cliente sem celular válido.');
  await Linking.openURL(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`);
}

/** Abre o endereço no Google Maps (o aplicativo, se instalado; senão, o site). */
export async function abrirMapa(endereco: string): Promise<void> {
  const consulta = encodeURIComponent(endereco.trim());
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${consulta}`);
}

/** Endereço numa linha só, a partir dos campos do cliente. */
export function enderecoEmLinha(e: {
  rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string;
}): string {
  const rua = [e.rua, e.numero].filter(Boolean).join(', ') + (e.complemento ? ` - ${e.complemento}` : '');
  const cidade = [e.cidade, e.estado].filter(Boolean).join('/');
  return [rua, e.bairro, cidade].filter((p) => p && p.trim()).join(' - ');
}
