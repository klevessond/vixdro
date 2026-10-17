// src/api/agenda.ts
//
// Agenda de medições, instalações e visitas, ligada ao cliente e ao projeto.

import { ApiError, apiFetch } from './auth';

export type TipoCompromisso = 'medicao' | 'instalacao' | 'visita' | 'outro';

export const TIPOS_COMPROMISSO: { valor: TipoCompromisso; rotulo: string; icone: string }[] = [
  { valor: 'medicao', rotulo: 'Medição', icone: 'tape-measure' },
  { valor: 'instalacao', rotulo: 'Instalação', icone: 'tools' },
  { valor: 'visita', rotulo: 'Visita', icone: 'account-voice' },
  { valor: 'outro', rotulo: 'Outro', icone: 'calendar-blank-outline' },
];

export function infoTipo(t: TipoCompromisso) {
  return TIPOS_COMPROMISSO.find((x) => x.valor === t) ?? TIPOS_COMPROMISSO[3];
}

export type Compromisso = {
  id?: string;
  tipo: TipoCompromisso;
  cliente: string | null;
  cliente_nome?: string | null;
  cliente_celular?: string | null;
  projeto: string | null;
  projeto_nome?: string | null;
  projeto_numero?: number | null;
  inicio: string; // ISO 8601
  duracao_min?: number;
  endereco: string;
  observacoes: string;
  concluido?: boolean;
};

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

/** Data local no formato do servidor: 2026-10-16. */
export function dataISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function listarAgenda(de: Date, ate: Date, projeto?: string): Promise<Compromisso[]> {
  const params = new URLSearchParams({ de: dataISO(de), ate: dataISO(ate) });
  if (projeto) params.set('projeto', projeto);
  return ler(await apiFetch(`/agenda/?${params}`), 'Não foi possível carregar a agenda.');
}

export async function obterCompromisso(id: string): Promise<Compromisso> {
  return ler(await apiFetch(`/agenda/${id}/`), 'Não foi possível abrir o compromisso.');
}

export async function salvarCompromisso(c: Compromisso): Promise<Compromisso> {
  const corpo = JSON.stringify({
    tipo: c.tipo,
    cliente: c.cliente,
    projeto: c.projeto,
    inicio: c.inicio,
    duracao_min: c.duracao_min ?? 60,
    endereco: c.endereco.trim(),
    observacoes: c.observacoes.trim(),
  });
  const res = c.id
    ? await apiFetch(`/agenda/${c.id}/`, { method: 'PATCH', body: corpo })
    : await apiFetch('/agenda/', { method: 'POST', body: corpo });
  return ler(res, 'Não foi possível salvar o compromisso.');
}

export async function excluirCompromisso(id: string): Promise<void> {
  const res = await apiFetch(`/agenda/${id}/`, { method: 'DELETE' });
  if (!res.ok) await ler(res, 'Não foi possível excluir.');
}

export async function concluirCompromisso(id: string, concluido: boolean): Promise<Compromisso> {
  const res = await apiFetch(`/agenda/${id}/concluir/`, { method: 'POST', body: JSON.stringify({ concluido }) });
  return ler(res, 'Não foi possível atualizar.');
}

// ---------- Datas em português ----------

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function hora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "hoje", "amanhã" ou "sexta, 17/10". */
export function diaRelativo(d: Date): string {
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  if (mesmoDia(d, hoje)) return 'hoje';
  if (mesmoDia(d, amanha)) return 'amanhã';
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nomeDiaCurto(d: Date): string {
  return DIAS[d.getDay()].slice(0, 3);
}
