// src/util/datas.ts
//
// Datas digitadas no formato brasileiro (dd/mm/aaaa) e convertidas para o
// formato do servidor (aaaa-mm-dd).

const p2 = (n: number) => String(n).padStart(2, '0');

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Máscara enquanto digita: "17102026" -> "17/10/2026". */
export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "17/10/2026" -> "2026-10-17", ou null se a data não existir (ex: 31/02). */
export function textoParaISO(texto: string): string | null {
  const [dd, mm, aa] = texto.split('/').map(Number);
  if (!dd || !mm || !aa || aa < 2000) return null;
  const d = new Date(aa, mm - 1, dd);
  if (d.getDate() !== dd || d.getMonth() !== mm - 1) return null;
  return `${aa}-${p2(mm)}-${p2(dd)}`;
}

/** "2026-10-17" -> "17/10/2026". */
export function isoParaTexto(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Data local de hoje (ou daqui a N dias) em "aaaa-mm-dd". */
export function hojeISO(dias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Mesmo dia, N meses depois, em "aaaa-mm-dd" (31/01 + 1 mês = 28/02). */
export function somarMesesISO(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return `${alvo.getFullYear()}-${p2(alvo.getMonth() + 1)}-${p2(Math.min(d, ultimo))}`;
}
