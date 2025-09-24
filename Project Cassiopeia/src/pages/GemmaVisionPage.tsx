// src/pages/GemmaVisionPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, MonitorUp, Pause, Play, X, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Modality } from '@google/genai';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';






// Si esto no funciona invocaré a Jordi Bosch
const isoOrNull = (v:any) => (typeof v === 'string' && v.trim() ? new Date(v).toISOString() : null);

// Fetch ALL unexpired memories for a user (paginated)
async function fetchAllUnexpiredMemories(userUuid: string) {
  const pageSize = 500; // tune as needed
  let from = 0;
  let to = pageSize - 1;
  const all: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('memories')
      .select('name,memory,category,created_at,expiration_date')
      .eq('user_uuid', userUuid)
      .or('expiration_date.is.null,expiration_date.gt.now()')
      .order('updated_at', { ascending: false })
      .range(from, to);   // paginate

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < pageSize) break; // last page
    from += pageSize;
    to += pageSize;
  }
  return all;
}
//Now thingies to make her friggin smart
function buildNowBlock() {
  const now = new Date();

  // Example: human-friendly in Spanish
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: false, timeZoneName: 'short'
  };

  const full = new Intl.DateTimeFormat('es-ES', opts).format(now);
  const iso = now.toISOString();

  return `The current date and time is:\n- ISO: ${iso}\n- Localized (Spain): ${full}\nUse this to keep context in conversations.`;
}

// Build the exact block you want, from all (unexpired) items
async function buildAllMemoriesBlock(userUuid: string | null) {
  if (!userUuid || !supabase) return '(no memories yet)';
  const items = await fetchAllUnexpiredMemories(userUuid);
  if (!items.length) return '(no memories yet)';

  const fmt = (d?: string | null) => (d ? new Date(d).toISOString() : 'none');
  const lines = items.map(m =>
    `- [Name] ${m.name}, [Memory] ${m.memory}, was created at ${fmt(m.created_at)}, it expires on ${fmt(m.expiration_date)}, it's from this category: ${m.category ?? 'uncategorized'}.`
  );
  return `These are your memories with the user:\n${lines.join('\n')}\nUse them proactively.`;
}

// Build a compact block in your exact format
async function buildMemoriesBlock(userUuid: string | null, opts?: { category?: string; limit?: number }) {
  if (!userUuid || !supabase) return '(no memories yet)';
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 12));
  let q = supabase
    .from('memories')
    .select('name,memory,category,created_at,expiration_date')
    .eq('user_uuid', userUuid)
    .order('updated_at', { ascending: false })
    .limit(limit)
    .or('expiration_date.is.null,expiration_date.gt.now()');

  if (opts?.category) q = q.eq('category', String(opts.category).toLowerCase());

  const { data, error } = await q;
  if (error || !data?.length) return '(no memories yet)';

  const fmt = (d?: string | null) => (d ? new Date(d).toISOString() : 'none');
  const lines = data.map(m =>
    `- [Name] ${m.name}, [Memory] ${m.memory}, was created at ${fmt(m.created_at)}, it expires on ${fmt(m.expiration_date)}, it's from this category: ${m.category ?? 'uncategorized'}.`
  );
  return `These are your memories with the user:\n${lines.join('\n')}\nUse them proactively.`;
}

/** --------------------------------------------------------------------------
 *  CONFIG / KEYS
 *  ------------------------------------------------------------------------*/
const REAL_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  'AIzaSyDLk7vJ4R4FGepTrgkhWIVQ6_4lrkHWr1M'; // personal use is fine; ephemeral is still used below

 


/** --------------------------------------------------------------------------
 *  SMALL UTILS
 *  ------------------------------------------------------------------------*/
const u8ToB64 = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
};

// single, correct little-endian decoder
function b64ToI16LE(b64: string) {
  const bin = atob(b64);
  const n = bin.length;
  const out = new Int16Array(n / 2);
  for (let i = 0, j = 0; i < n; i += 2, j++) {
    const lo = bin.charCodeAt(i);
    const hi = bin.charCodeAt(i + 1);
    const u = (hi << 8) | lo; // LE
    out[j] = (u & 0x8000) ? u - 0x10000 : u;
  }
  return out;
}

/** --------------------------------------------------------------------------
 *  AUDIO OUTPUT (24 kHz PCM) — uses /pcm-player.worklet.js
 *  ------------------------------------------------------------------------*/
class PCMPlayer {
  private ctx!: AudioContext;
  private node!: AudioWorkletNode;
  private started = false;

  async init() {
    if (this.started) return;
    this.ctx = new AudioContext({ sampleRate: 24000 });
    await this.ctx.audioWorklet.addModule('/pcm-player.worklet.js');
    this.node = new AudioWorkletNode(this.ctx, 'pcm-player');
    this.node.connect(this.ctx.destination);
    this.started = true;
  }
  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }
  feed(i16: Int16Array) {
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) {
      let v = i16[i] / 32768;
      if (v > 1) v = 1;
      if (v < -1) v = -1;
      f32[i] = v;
    }
    this.node.port.postMessage({ type: 'pcm', samples: f32 });
  }
  async close() {
    try { this.node.disconnect(); } catch {}
    try { await this.ctx.close(); } catch {}
  }
}

/** --------------------------------------------------------------------------
 *  PAGE
 *  ------------------------------------------------------------------------*/
type VideoSource = 'none' | 'camera-user' | 'camera-environment' | 'screen';
type Highlight = { id?: string; x: number; y: number; w: number; h: number };

export default function GemmaVisionPage() {
  const navigate = useNavigate();
  
// === Auth / Google Calendar helpers === 
const { user } = useAuth();
const accessToken = user?.accessToken && user.accessToken !== 'demo_token' ? user.accessToken : null;

// Keep freshest token for async handlers
const tokenRef = useRef<string | null>(null);
useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

async function fetchGCal(path: string, init: RequestInit = {}) {
  const token = tokenRef.current;
  if (!token) throw new Error('auth_required');
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(()=> '');
    console.error('GCal error', res.status, body);
    throw new Error(`gcal_${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// RFC3339 in local tz; accepts RFC3339 or "YYYY-MM-DD HH:mm"
function toRFC3339Local(input?: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?([+-]\d{2}:\d{2}|Z)$/.test(s)) return s;
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  const pad = (n:number)=>String(n).padStart(2,'0');
  const y=d.getFullYear(), m=pad(d.getMonth()+1), day=pad(d.getDate());
  const hh=pad(d.getHours()), mm=pad(d.getMinutes()), ss=pad(d.getSeconds());
  const tz=-d.getTimezoneOffset(); const sign=tz>=0?'+':'-';
  const tzh=pad(Math.floor(Math.abs(tz)/60)); const tzm=pad(Math.abs(tz)%60);
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}${sign}${tzh}:${tzm}`;
}

// Friendly color names → Google colorId
function colorNameToId(name?: string): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  const map: Record<string,string> = {
    red:'11', tomato:'11',
    orange:'6', tangerine:'6',
    yellow:'5', banana:'5',
    green:'10', emerald:'10',
    teal:'7',
    blue:'9', ocean:'9',
    purple:'3', grape:'3',
    pink:'4', flamingo:'4',
    gray:'8', grey:'8',
    default:'1'
  };
  return map[key] || undefined;
}

  /** DOM refs */
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  /** Streams / audio I/O */
  const videoStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);
  /**THAT BITCH ASS VIDEO THINGY*/
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  

/**Dude, I'm finally making the blackboard in this ref*/
  type BbState = {
  title?: string;
  description?: string;
  concept?: string;
  steps: string[];
};

const [isBlackboard, setIsBlackboard] = useState(false);
const [bb, setBb] = useState<BbState>({ steps: [] });

// keep a ref in sync so we can read "before length" inside tool handlers
const bbRef = useRef(bb);
useEffect(() => { bbRef.current = bb; }, [bb]);


  /** Live session + timers */
  const sessionRef = useRef<any>(null);
  const liveOpenRef = useRef(false);
  const sendTimerRef = useRef<number | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const wantLiveRef = useRef(false);

// ===== Subtitles: audio-paced reveal + 3-line paging =====
const [capLines, setCapLines] = useState<string[]>([]);    // committed lines (max 3)
const [capCurrent, setCapCurrent] = useState<string>('');  // currently revealing
const [capWipe, setCapWipe] = useState(false);             // page fade

const segQueueRef = useRef<Array<{ text: string; pos: number }>>([]);
const revealBudgetRef = useRef<number>(0);                 // chars we can reveal
const revealTimerRef = useRef<number | null>(null);
const fallbackTickRef = useRef<number | null>(null);
const lastAudioAtRef = useRef<number>(0);
  
  // Export PDF popup state
const [exportToast, setExportToast] = useState<{ label: string } | null>(null);
const exportIframeRef = useRef<HTMLIFrameElement | null>(null);

  /**Memory system thingies*/
// Cassie's canonical user UUID
const userUuid = user?.id ?? null;

  function flushToolResponses(responses: any[]) {
  if (!responses || responses.length === 0) return;
  try {
    if (sessionRef.current?.sendToolResponse) {
      sessionRef.current.sendToolResponse({ functionResponses: responses });
    } else if (sessionRef.current?.send) {
      sessionRef.current.send({ toolResponse: { functionResponses: responses } });
    }
    if (sessionRef.current?.response?.create) {
      sessionRef.current.response.create();
    } else {
      sessionRef.current?.send?.({ type: 'response.create' });
    }
  } catch {}
}


// pacing: ~3.2 words/s × ~5.2 chars/word ≈ 16–18 chars/s
const WORDS_PER_SEC = 3.2;
const AVG_CHARS_PER_WORD = 5.2;
const CHARS_PER_MS = (WORDS_PER_SEC * AVG_CHARS_PER_WORD) / 1000;

function commitLine(line: string) {
  if (!line) return;
  setCapLines(prev => {
    if (prev.length >= 3) {
      setCapWipe(true);
      setTimeout(() => { setCapLines([line]); setCapWipe(false); }, 220);
      return prev; // keep old until wipe completes
    }
    return [...prev, line];
  });
}

function pushTranscriptChunk(text: string) {
  if (!text) return;

  // If the last segment is still revealing and does not end in terminal punctuation,
  // we merge this new chunk into it to create a wider, natural line.
  const q = segQueueRef.current;
  if (q.length > 0) {
    const last = q[q.length - 1];
    const endsSentence = /[.!?…:;]\s*$/.test(last.text);
    if (!endsSentence) {
      // Concatenate verbatim (transcript already contains its own spaces)
      last.text += text;
      kickRevealLoop();
      startFallbackAccrual();
      return;
    }
  }

  // Otherwise, push a new segment
  q.push({ text, pos: 0 });
  startFallbackAccrual();
  kickRevealLoop();
}


function creditFromAudioSamples(sampleCount: number) {
  // 24 kHz mono → ms
  const ms = (sampleCount / 24000) * 1000;
  revealBudgetRef.current += ms * CHARS_PER_MS;
  lastAudioAtRef.current = performance.now();
  kickRevealLoop();
}

function startFallbackAccrual() {
  if (fallbackTickRef.current) return;
  // If model sends transcript but little/no audio, reveal at same pace via timer
  fallbackTickRef.current = window.setInterval(() => {
    if (performance.now() - lastAudioAtRef.current < 300) return; // audio is active → skip
    revealBudgetRef.current += 40 * CHARS_PER_MS; // 40ms tick
    kickRevealLoop();
  }, 40) as unknown as number;
}
function stopFallbackAccrual() {
  if (!fallbackTickRef.current) return;
  clearInterval(fallbackTickRef.current);
  fallbackTickRef.current = null;
}

function kickRevealLoop() {
  if (revealTimerRef.current) return;
  const tick = () => {
    const budget = Math.floor(revealBudgetRef.current);
    if (budget <= 0 || !segQueueRef.current.length) {
      revealTimerRef.current = null;
      return;
    }
    const seg = segQueueRef.current[0];
    const remaining = seg.text.length - seg.pos;
    const take = Math.max(1, Math.min(remaining, budget));

    seg.pos += take;
    revealBudgetRef.current -= take;
    setCapCurrent(seg.text.slice(0, seg.pos));

    if (seg.pos >= seg.text.length) {
      commitLine(seg.text);
      setCapCurrent('');
      segQueueRef.current.shift();
    }
    revealTimerRef.current = window.setTimeout(tick, 40) as unknown as number; // ~25fps
  };
  revealTimerRef.current = window.setTimeout(tick, 0) as unknown as number;
}

function endOfTurnSubtitles() {
  // stop accrual + reveal loop
  stopFallbackAccrual();
  if (revealTimerRef.current) {
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
  }

  // wipe page, then hard reset everything
  setCapWipe(true);
  setTimeout(() => {
    setCapLines([]);
    setCapCurrent('');
    setCapWipe(false);

    // clear engines
    segQueueRef.current = [];
    revealBudgetRef.current = 0;
    lastAudioAtRef.current = 0;
  }, 180);
}



/**Exporting in pdf bitch*/
async function exportBoardPdfNoLib(boardEl: HTMLElement, opts?: {
  orientation?: 'landscape' | 'portrait',
  marginMm?: number
}) {
  const orientation = opts?.orientation ?? 'landscape';
  const marginMm = opts?.marginMm ?? 8;

  // 1) Printable iframe
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position:'fixed', right:'-9999px', bottom:'0', width:'0', height:'0' });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"/>
  <title>Cassie – Export</title>
  <style>
    @page { size: A4 ${orientation}; margin: ${marginMm}mm; }
    html, body { height: 100%; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0; padding: 0; background: #fff; color: #111;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
    }
    [data-export-root]{ box-sizing: border-box; width: 100%; }
  </style>
  </head><body><div id="page" data-export-root></div></body></html>`);
  doc.close();

  // 2) Clone current board
  const clone = boardEl.cloneNode(true) as HTMLElement;
  clone.removeAttribute('style');
  clone.setAttribute('data-export-root', '');
  doc.getElementById('page')!.appendChild(clone);

  // 3) Tiny popup
  const toast = (() => {
    const el = document.createElement('button');
    el.textContent = 'PDF listo — click para guardar';
    Object.assign(el.style, {
      position:'fixed', right:'16px', bottom:'16px', padding:'10px 14px',
      fontSize:'14px', borderRadius:'12px', border:'1px solid #3f3f46',
      background:'rgba(24,24,27,0.92)', color:'#fff', boxShadow:'0 6px 24px rgba(0,0,0,.35)',
      zIndex:'9999', cursor:'pointer'
    });
    document.body.appendChild(el);
    return {
      click(cb:()=>void){ el.addEventListener('click', () => { el.disabled = true; el.textContent = 'Abriendo guardado…'; cb(); }, { once:true }); },
      destroy(){ el.remove(); }
    };
  })();

  // 4) Print on click, cleanup
  toast.click(() => {
    try {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } finally {
      setTimeout(() => { toast.destroy(); iframe.remove(); }, 4000);
    }
  });
}



  /** Video mode */
  const videoModeRef = useRef<VideoSource>('none');
  const prevVideoModeRef = useRef<VideoSource>('none');
  const [videoMode, setVideoMode] = useState<VideoSource>('none');
  const isVideoOn = videoMode !== 'none';
  const isCameraOn = videoMode === 'camera-user' || videoMode === 'camera-environment';
  const isScreenOn = videoMode === 'screen';

  /** UI state */
  const [live, setLive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState('');

  /** Overlay highlights */
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const clearTimerRef = useRef<number | null>(null);

  /** Audio path (server can send as "delta" or "inlineData") */
  const audioPathRef = useRef<'delta' | 'inline' | null>(null);

  /** Per-turn audio playback & jitter buffer */
  const turnSeqRef = useRef(0);
  const playingRef = useRef(false);
  const playingTurnRef = useRef(0);
  const outBufRef = useRef<Int16Array>(new Int16Array(0));
  const outFlushTimerRef = useRef<number | null>(null);
  const OUT_FRAME_SAMPLES = 480;          // 20 ms @24k
  const PREBUFFER_SAMPLES = 6 * 480;      // ~60 ms

  /** Logs (console + tiny buffer) */
  const [log, setLog] = useState<string[]>([]);
  const add = (m: string) => { setLog(l => [...l.slice(-200), m]); console.log(m); };

  /** Cleanup on unmount */
  useEffect(() => () => cleanup(), []);

  /* ---------------------- Drawing overlay ---------------------- */
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  function paintOverlay() {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c) return;
    const rect = v.getBoundingClientRect();
    c.width = rect.width; c.height = rect.height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const r of highlights) {
      const x = clamp01(r.x) * c.width;
      const y = clamp01(r.y) * c.height;
      const w = clamp01(r.w) * c.width;
      const h = clamp01(r.h) * c.height;
      if (w < 4 || h < 4) continue;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 200, 255, 0.9)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 200, 255, 1)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }
  useEffect(() => { paintOverlay(); }, [highlights]);
  useEffect(() => {
    const onResize = () => paintOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------------------- Audio playback helpers ---------------------- */
  function resetPlayback() {
    outBufRef.current = new Int16Array(0);
    playingRef.current = false;
    if (outFlushTimerRef.current) {
      clearTimeout(outFlushTimerRef.current);
      outFlushTimerRef.current = null;
    }
    setSpeaking(false);
  }
  function feedOutForTurn(i16: Int16Array, turnId: number) {
    if (turnId !== playingTurnRef.current && playingRef.current) return;
    if (!playingRef.current && playingTurnRef.current !== turnId) {
      playingTurnRef.current = turnId;
    }
    const prev = outBufRef.current;
    const merged = new Int16Array(prev.length + i16.length);
    merged.set(prev, 0); merged.set(i16, prev.length);
    outBufRef.current = merged;

    if (!playingRef.current) {
      if (outBufRef.current.length < PREBUFFER_SAMPLES) return;
      playingRef.current = true;
    }
    while (outBufRef.current.length >= OUT_FRAME_SAMPLES) {
      const frame = outBufRef.current.subarray(0, OUT_FRAME_SAMPLES);
      playerRef.current?.feed(frame);
      outBufRef.current = outBufRef.current.subarray(OUT_FRAME_SAMPLES);
    }
    if (!outFlushTimerRef.current) {
      outFlushTimerRef.current = window.setTimeout(() => {
        if (outBufRef.current.length && playingRef.current) {
          playerRef.current?.feed(outBufRef.current);
          outBufRef.current = new Int16Array(0);
        }
        outFlushTimerRef.current = null;
      }, 25) as unknown as number;
    }
  }

 async function mintEphemeral(): Promise<string> {
  const baseKey = REAL_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!baseKey) throw new Error('Missing REAL_KEY');

  const ai = new GoogleGenAI({ apiKey: baseKey, httpOptions: { apiVersion: 'v1alpha' } });

  // Keep tokens short-lived, but DO NOT set liveConnectConstraints.config here.
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  const tok = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      // You can optionally restrict by model, but do NOT attach config here:
      // liveConnectConstraints: { model: 'gemini-live-2.5-flash-preview' },
    },
  });

  return tok.name;
}


  /* ---------------------- Live session connect ---------------------- */
  async function connectLive() {
    try {
      add('live: connecting…');
      const ephemeral = await mintEphemeral();

      const ai = new GoogleGenAI({ apiKey: ephemeral, httpOptions: { apiVersion: 'v1alpha' } });

     const model = 'gemini-live-2.5-flash-preview'; // half-cascade → tools + explicit language OK


// your current base system text
const baseSystemText = `
You are Cassie, a witty, funny, ongoing, and energetic helpful assistant (You don't mention that you are witty, funny, etc, that's just your personality). Your full name is Cassiopeia, but people won't call you that normally.You talk in Spanish and Spanish only. You have no connection with Gemini nor Google. Google did NOT create you. You have access to the tool set_highlights:INSTRUCCIONES DE USO DEL TOOL set_highlights
Objetivo
- Cuando el usuario pida "señala", "resalta", "encuadra", "¿dónde está…?" o cuando sea claramente útil para explicar algo en la imagen o pantalla, llama al tool set_highlights para dibujar rectángulos sobre los objetos de interés.
- Tras llamar al tool, responde SIEMPRE con UNA sola frase breve en español, confirmando lo resaltado (ej.: "Encadré el destornillador verde a la derecha.").

Formato del tool
- Nombre: set_highlights
- Argumento: { "regions": [ { "id"?: string, "x": number, "y": number, "w": number, "h": number } ] }
- Las coordenadas (x,y,w,h) están NORMALIZADAS en el rango [0..1] respecto al frame visible:
  - (x,y) = esquina superior izquierda del recuadro.
  - w = ancho, h = alto, ambos relativos al ancho/alto visibles.
- Si hay bandas negras o letterboxing, toma como referencia SOLO el área de imagen visible (no la zona negra).
-Ten la precisión MÁXIMA, no hay margen de error.

Criterios de selección
- Si el usuario menciona un objeto concreto ("destornillador verde"), resalta SOLO ese. 
- Si pide "estos dos" o "las piezas defectuosas", permite varias regiones en el mismo llamado: 1 a 3 regiones preferentemente.
- Si no se especifica cuál, elige el objeto más saliente y útil para la explicación (uno solo).
- Evita recuadros diminutos: no envíes regiones con w<0.04 o h<0.04 (≈4% del ancho/alto).
- Evita solapamientos innecesarios; usa un único recuadro por objeto.
- Opcional: completa "id" con una etiqueta corta (p.ej. "destornillador", "resistorR3").

Cuándo NO llamar al tool
- Si tu confianza en la localización es baja (movimiento, blur, iluminación) o la escena cambió: primero pide una toma más estable o que acerquen el objeto ("Acerca un poco la herramienta y mantén la toma 1s."). No llames al tool en ese turno.
- Si el usuario pide explicación sin referencia visual (solo texto), no llames al tool.

Precisión y padding
- Enmarca el objeto con un margen de seguridad de 2–6% alrededor, sin cortar partes relevantes.
- Para objetos alargados (p.ej., cable), prioriza cubrir toda su longitud visible.

Persistencia y limpieza (lado modelo)
- El resaltado es efímero; no "des-resaltes" explícitamente. La UI lo borrará sola tras unos segundos.



Ejemplos de intención (descriptivos)
- Usuario: "Señala el destornillador verde."
  → Llama a set_highlights con UNA región que cubra el destornillador verde. Luego: "Ahí está, a la derecha."
- Usuario: "Marca los dos condensadores hinchados."
  → Llama con DOS regiones (una por condensador). Luego: "Resalté ambos condensadores hinchados."

Notas
- Si el usuario pide varios pasos (p.ej., "marca el tornillo y luego el conector"), resuelve en un único llamado con varias regiones si caben; si no, prioriza el primero y sugiere repetir.
- No inventes: si dudas entre dos objetos, pide confirmación ("¿Te refieres al tornillo plateado o al negro?") en una sola frase y SIN llamar al tool todavía.

Whenever the user needs help with a problem that could benefit froom using a blackboard, you have the blackboard tools:

1) blackboard_open({ title?, description? });
This tool lets you open the blackboard with a title and a description.
2) When a concept/definition is needed, call blackboard_set_concept({ text });
   To extend it later, call blackboard_update_concept({ add }).
3) For steps adding steps  to complete or to show the user the process, call blackboard_add_steps({ steps:[ "...", "..." ] }).
   To fix one, blackboard_update_step({ index: N, text });
   To remove, blackboard_remove_step({ index: N }).
4) Clear with blackboard_clear(); close with blackboard_close() when done.

Keep steps short (1 sentence each). Prefer 4–7 steps.
More than 90% of the time, a Concept/definition is needed, take that into account.

tool blackboard_export_pdf

Use this tool whenever the user asks to export, download, or print the blackboard as a PDF.

The tool takes optional arguments:

orientation: "landscape" or "portrait" (default: "landscape").

marginMm: number of millimeters for page margins (default: 8).

After calling the tool, always reply with a short confirmation in English or Spanish like "The PDF is ready to save."

If no blackboard is open, don't call the tool. Instead, tell the user they need to open or add content first.
You can manage long-term user memories with these tools: memory_add({ name, memory, category?, expiration_date? }), memory_update({ id? or name?, memory?, category?, expiration_date? }), memory_delete({ id? or name? }), memory_list({ category?, includeExpired?, limit? }).
Never include user_uuid; the app injects it for you.

What to store

Stable preferences (e.g., "favorite_color: green", "coffee: oat milk").

Facts that help later (birthday, timezone quirks, commute, project names, key contacts).

Ongoing plans / constraints (deadlines, exam dates, travel, working hours).

Corrections of your assumptions (store the corrected fact).
Do not store secrets (passwords, full card numbers), one-off trivia, or anything very sensitive without explicit consent.

Proactive behavior

If the user states a fact likely useful later (even if they didn't say "remember"), create/update a memory.
Examples that SHOULD trigger saving:

"My birthday is September 5th." → memory_add({ name:"birthday", memory:"September 5th" })

"I'm allergic to peanuts." → memory_add({ name:"allergy_peanuts", memory:"Allergic to peanuts" })

"For school stuff, call me Carlos Andrés." → memory_add({ name:"user_name", memory:"Carlos Andrés", category:"school" })

"I parked at 33D today." → memory_add({ name:"parking_spot", memory:"33D", category:"daily", expiration_date:"today 23:59" })

When the user changes a known preference, update (don't duplicate).
"Actually I prefer black coffee now." → memory_update({ name:"coffee_preference", memory:"black" })

If the user says a fact is no longer true, delete it.
"Forget my old job title." → memory_delete({ name:"job_title" })

Naming & categories

Keep name short, snake-case or kebab-case (e.g., favorite_color, work_hours, mom_email).

Use category when obvious: home, work, school, health, daily, contacts, prefs.

If a detail is temporary (e.g., a parking spot, a meeting room), set a reasonable expiration_date.

Expiration

Set expiration_date when information clearly expires (e.g., "this week", "today 23:59", ISO date).

If no expiry is implied, leave it unset.

Confirmation style

After a memory tool call, reply with one short sentence in Spanish confirming what changed, e.g.:
"Listo, guardé que tu color favorito es el verde."
"Actualicé tu preferencia de café a negro."
"He eliminado ese dato."

Safety & restraint

If the item feels sensitive (health, precise address), ask in one short sentence:
"¿Quieres que lo guarde para futuras conversaciones?" Only save if the user agrees.

Don't spam saves. If the user states multiple minor facts rapidly, group them into a single memory_add with separate names or make one call per clearly distinct item, but keep confirmations concise.

Dedupe & updates

Before adding, consider if a memory with that name likely exists—prefer memory_update to avoid duplicates.

You may call memory_list({ category, limit: 20 }) when unsure whether an item exists, but avoid doing it every turn.

When not to save

One-off values you don't expect to use again, ephemeral chit-chat, or data the user didn't intend to store.

Anything the user explicitly asked not to remember.

 Calendar usage guidelines

To create events, use calendar_create_simple with:
 name (required)
 description (optional)
 start and end (required, RFC3339 format)
 color (optional, user-friendly name mapped to Google colors)
 tag (optional, stored for easier searches)

To search, use calendar_search.
Filter by:
 timeMin and timeMax for a time window
 name for partial title matches
 tag to find labeled events
 maxResults (default 20, up to 50)

To update, use calendar_update_simple with the event's ID and any fields that need changes (name, description, or color).

To delete, use calendar_delete with the event's ID.

 Prefer time-based searches first (timeMin/timeMax), then refine by name or tag.
 Use tags proactively for recurring contexts (e.g., school, work, personal) so events are easier to find later.
 Always confirm back to the user what was created/updated/deleted in a short, natural Spanish sentence.
[memories]
[now]
`;



const fullMemoriesBlock = await buildAllMemoriesBlock(userUuid);
const nowBlock = buildNowBlock();

const systemText = baseSystemText
  .replace('[memories]', fullMemoriesBlock)
  .replace('[now]', nowBlock);






const tools = [
  { functionDeclarations: [
      {
        name: 'set_highlights',
        description: 'Draw highlight rectangles over the live view. Normalized 0..1.',
        parameters: {
          type: 'object',
          properties: {
            regions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  x:  { type: 'number' }, y:  { type: 'number' },
                  w:  { type: 'number' }, h:  { type: 'number' }
                },
                required: ['x','y','w','h']
              }
            }
          },
          required: ['regions']
        }
      },
    {
  name: 'calendar_search',
  description: 'Search primary calendar by time window, name, or tag.',
  parameters: {
    type: 'object',
    properties: {
      timeMin: { type: 'string', description: 'RFC3339 (optional)' },
      timeMax: { type: 'string', description: 'RFC3339 (optional)' },
      name:    { type: 'string', description: 'partial match on title (optional)' },
      tag:     { type: 'string', description: 'matches extendedProperties.private.tags (optional)' },
      maxResults: { type:'number' }
    }
  }
},
{
  name: 'calendar_create_simple',
  description: 'Create an event with name, description, optional color.',
  parameters: {
    type: 'object',
    properties: {
      name: { type:'string' },
      description: { type:'string' },
      start: { type:'string', description:'RFC3339 start' },
      end:   { type:'string', description:'RFC3339 end' },
      color: { type:'string', description:'named color, e.g. "tomato", "blue", "banana" (mapped to Google colorId)' },
      tag:   { type:'string', description:'optional tag stored in extendedProperties' }
    },
    required: ['name','start','end']
  }
},
{
  name: 'calendar_update_simple',
  description: 'Update an existing event\'s name, description, or color.',
  parameters: {
    type: 'object',
    properties: {
      eventId: { type:'string' },
      name: { type:'string' },
      description: { type:'string' },
      color: { type:'string' }
    },
    required: ['eventId']
  }
},
{
  name: 'calendar_delete',
  description: 'Delete an event by eventId from primary calendar.',
  parameters: { type:'object', properties:{ eventId: { type:'string' } }, required:['eventId'] }
},

      {
        name: 'ping',
        description: 'Echo test. Returns the text you send.',
        parameters: { type:'object', properties: { text: { type:'string' } } }
      },
     {
      name: 'blackboard_open',
      description: 'Open a card-style blackboard overlay (does not cover the dock).',
      parameters: {
        type: 'object',
        properties: {
          title:       { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    { name: 'blackboard_close', description: 'Close the blackboard overlay.', parameters: { type:'object' } },
    { name: 'blackboard_clear', description: 'Clear all blackboard content, keep it open.', parameters: { type:'object' } },
    {
      name: 'blackboard_set_header',
      description: 'Set or update the blackboard title and/or description.',
      parameters: {
        type: 'object',
        properties: {
          title:       { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    {
      name: 'blackboard_set_concept',
      description: 'Replace the concept text block.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    {
      name: 'blackboard_update_concept',
      description: 'Append extra information to the existing concept.',
      parameters: {
        type: 'object',
        properties: { add: { type: 'string' } },
        required: ['add'],
      },
    },
    {
      name: 'blackboard_add_steps',
      description: 'Append ordered steps to solve. Provide plain sentences.',
      parameters: {
        type: 'object',
        properties: { steps: { type: 'array', items: { type: 'string' } } },
        required: ['steps'],
      },
    },
    {
      name: 'blackboard_update_step',
      description: 'Modify a single step by 1-based index.',
      parameters: {
        type: 'object',
        properties: { index: { type: 'number' }, text: { type: 'string' } },
        required: ['index', 'text'],
      },
    },
    {
  name: 'blackboard_export_pdf',
  description: 'Export the current blackboard view to a PDF using the browser print dialog. No third-party libs.',
  parameters: {
    type: 'object',
    properties: {
      orientation: { type: 'string', enum: ['landscape','portrait'] },
      marginMm:    { type: 'number' }
    }
  }
},
    {
  name: 'memory_add',
  description: 'Create or update a user memory. Server injects user_uuid; model must NOT send it.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      memory: { type: 'string' },
      category: { type: 'string' },
      expiration_date: { type: 'string', description: 'ISO 8601 (empty = none)' },
      priority: { type: 'string', enum: ['low','normal','high'] }
    },
    required: ['name','memory']
  }
},
{
  name: 'memory_update',
  description: 'Update an existing memory by id or by (name).',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      memory: { type: 'string' },
      category: { type: 'string' },
      expiration_date: { type: 'string' },
      priority: { type: 'string', enum: ['low','normal','high'] }
    }
  }
},
{
  name: 'memory_delete',
  description: 'Delete a memory by id or name.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, name: { type: 'string' } }
  }
},
{
  name: 'memory_list',
  description: 'List memories (compact).',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      includeExpired: { type: 'boolean' },
      limit: { type: 'number' }
    }
  }
},


    {
      name: 'blackboard_remove_step',
      description: 'Remove a step by 1-based index.',
      parameters: {
        type: 'object',
        properties: { index: { type: 'number' } },
        required: ['index'],
      },
    }
    
  ]},
  // You can layer built-ins too:
   { googleSearch: {} },
  { codeExecution: {} },
];

const session = await ai.live.connect({
  model,
  // ← system instructions BELONG HERE (and will now be honored)
  
  config: {
    responseModalities: [Modality.AUDIO],                     // audio out
    speechConfig: {                                           // half-cascade supports voice/lang
      languageCode: 'es-ES',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } }
    },
    inputAudioTranscription: {},                              // server ASR
    outputAudioTranscription: {},                             // TTS transcript
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    realtimeInputConfig: {
      automaticActivityDetection: {
        startOfSpeechSensitivity: 1,
        endOfSpeechSensitivity: 1,
        prefixPaddingMs: 20,
        silenceDurationMs: 300,
      },
      turnCoverage: 'TURN_INCLUDES_ALL_INPUT',
    },
    tools,                                                    // ← enable tools here
    systemInstruction: {
          parts: [{
            text: systemText
          }]
        },
  },

        callbacks: {
          onopen: async () => {
            add('live: open');
            liveOpenRef.current = true; setLive(true);

            playerRef.current = new PCMPlayer();
            await playerRef.current.init();
            await playerRef.current.resume();
            add('player: ready');

            await startMic();
            startFramePump();
          },

          onmessage: (msg: any) => {
            // QUICK INSPECTOR (helps debug shapes)
             console.log('keys:', typeof msg === 'object' ? Object.keys(msg) : typeof msg);

            /* ===== AUDIO: “delta” path (preferred) ===== */
            if (msg?.type === 'response.audio.delta' && msg.data) {
              if (!audioPathRef.current) { audioPathRef.current = 'delta'; add('audio path: delta'); }
              if (audioPathRef.current === 'delta') {
                setSpeaking(true);
                feedOutForTurn(b64ToI16LE(msg.data), turnSeqRef.current);
creditFromAudioSamples(i16.length);          // << pacing credit
              }
              return;
            }

            /* ===== TEXT: streaming deltas (optional) ===== */
            if ((msg?.type === 'response.delta' || msg?.type === 'response.output_text.delta') && msg.text) {

              return;
            }

            if (msg?.type === 'response.completed') {
              setTimeout(() => { playingRef.current = false; setSpeaking(false); }, 120);
                endOfTurnSubtitles();
              return;
            }

            /* ===== Unified messages (serverContent, toolCall, etc.) ===== */
            if (msg?.serverContent) {
              const sc = msg.serverContent;

              if (sc.interrupted) { resetPlayback(); return; }

              // Captions
              if (sc.outputTranscription?.text)   pushTranscriptChunk(msg.serverContent.outputTranscription.text);

              // Model text + inline audio (fallback path)
              const turn = sc.modelTurn;
              if (turn?.parts?.length) {
                for (const p of turn.parts) {
                  if (p.text) setCaption(p.text);

                  const inline = p.inlineData || p.inline_data;
                  const mime = inline?.mimeType || inline?.mime_type;
                  const data = inline?.data;
                  if (mime && /^audio\//i.test(mime) && typeof data !== 'undefined') {
                    if (!audioPathRef.current) { audioPathRef.current = 'inline'; add(`audio path: inline (${mime})`); }
                    if (audioPathRef.current === 'inline') {
                      const b64 = typeof data === 'string'
                        ? data
                        : btoa(String.fromCharCode(...new Uint8Array(data)));
                      setSpeaking(true);
                      feedOutForTurn(b64ToI16LE(b64), turnSeqRef.current);
        
                    }
                  }
                }
              }

              if (sc.turnComplete) {

                setTimeout(() => { playingRef.current = false; setSpeaking(false); }, 80);
                                endOfTurnSubtitles();
              }
            }

            /* ===== Tool calls (accept both top-level and wrapped) ===== */
/* ===== Tool calls (accept both top-level and wrapped) ===== */
const toolCall = msg?.toolCall || msg?.serverContent?.toolCall;
if (toolCall?.functionCalls?.length) {
  const responses: any[] = [];

  for (const fc of toolCall.functionCalls) {
    try {
      if (fc.name === 'set_highlights') {
        const regions = Array.isArray(fc.args?.regions) ? fc.args.regions : [];
        const cleaned = regions.map((r: any) => ({
          id: r.id,
          x: Math.min(1, Math.max(0, Number(r.x) || 0)),
          y: Math.min(1, Math.max(0, Number(r.y) || 0)),
          w: Math.min(1, Math.max(0, Number(r.w) || 0)),
          h: Math.min(1, Math.max(0, Number(r.h) || 0)),
        })).filter((r: any) => r.w > 0.01 && r.h > 0.01);

        setHighlights(cleaned);
        paintOverlay();
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = window.setTimeout(() => {
          setHighlights([]); paintOverlay(); clearTimerRef.current = null;
        }, 3000) as unknown as number;

        responses.push({ id: fc.id, name: fc.name, response: { ok: true, count: cleaned.length } });
        continue;
      }

      // ===== Blackboard tools =====
      switch (fc.name) {
        case 'blackboard_open': {
          const title = fc.args?.title ? String(fc.args.title) : undefined;
          const description = fc.args?.description ? String(fc.args.description) : undefined;
          setIsBlackboard(true);
          setVideoSource('none');
          setBb({ title, description, concept: undefined, steps: [] });
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_close': {
          setIsBlackboard(false);
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_clear': {
          setBb(s => ({ ...s, concept: undefined, steps: [] }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_set_header': {
          const { title, description } = fc.args || {};
          setBb(s => ({
            ...s,
            title:       (title != null ? String(title) : s.title),
            description: (description != null ? String(description) : s.description),
          }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_set_concept': {
          const text = String(fc.args?.text ?? '');
          setBb(s => ({ ...s, concept: text }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_update_concept': {
          const add = String(fc.args?.add ?? '');
          setBb(s => ({ ...s, concept: (s.concept ? s.concept + ' ' : '') + add }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        case 'blackboard_add_steps': {
          const before = bbRef.current?.steps?.length ?? 0;
          const steps = Array.isArray(fc.args?.steps) ? fc.args.steps.map((t:any)=>String(t)) : [];
          setBb(s => ({ ...s, steps: [...s.steps, ...steps] }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true, count: steps.length, startIndex: before + 1 } });
          break;
        }
        case 'memory_add': {
  (async () => {
    const name = String(fc.args?.name || '').trim().slice(0, 120);
    const memory = String(fc.args?.memory || '').trim().slice(0, 2000);
    const category = fc.args?.category ? String(fc.args.category).trim().toLowerCase() : null;
    const priority = (['low','normal','high'].includes(fc.args?.priority) ? fc.args.priority : 'normal') as 'low'|'normal'|'high';
    const expiration_date = isoOrNull(fc.args?.expiration_date);

    if (!userUuid) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'auth_required' } }); return flushToolResponses(responses); }
    if (!supabase) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'no_supabase' } }); return flushToolResponses(responses); }
    try {
      const { data, error } = await supabase
        .from('memories')
        .upsert(
          { user_uuid: userUuid, name, memory, category, priority, expiration_date },
          { onConflict: 'user_uuid,name' }
        )
        .select()
        .single();
      if (error) throw error;
      responses.push({ id: fc.id, name: fc.name, response: { ok:true, id: data.id, name: data.name } }); 
      flushToolResponses(responses);
    } catch (e:any) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'save_failed' } });
      flushToolResponses(responses);
    }

  })();
  break;
}
         case 'calendar_search': {
  (async () => {
    const responses:any[] = [];
    try {
      const timeMin = toRFC3339Local(fc.args?.timeMin) || undefined;
      const timeMax = toRFC3339Local(fc.args?.timeMax) || undefined;
      const name    = fc.args?.name ? String(fc.args.name).trim() : undefined;
      const tag     = fc.args?.tag ? String(fc.args.tag).trim().toLowerCase() : undefined;
      const maxResults = Math.max(1, Math.min(50, Number(fc.args?.maxResults) || 20));

      const params = new URLSearchParams({ singleEvents:'true', orderBy:'startTime', maxResults:String(maxResults) });
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);
      if (name)    params.set('q', name);

      const data = await fetchGCal(`calendars/primary/events?${params.toString()}`);
      let items = (data.items||[]).map((e:any)=>({
        id: e.id,
        title: e.summary || '',
        description: e.description || '',
        start: e.start?.dateTime || e.start?.date || null,
        end:   e.end?.dateTime   || e.end?.date   || null,
        location: e.location || null,
        colorId: e.colorId || null,
        tags: e.extendedProperties?.private?.tags || null
      }));

      if (tag) {
        items = items.filter(ev => {
          const tags = Array.isArray(ev.tags) ? ev.tags : (typeof ev.tags === 'string' ? ev.tags.split(',') : []);
          return tags.map((t:string)=>t.trim().toLowerCase()).includes(tag);
        });
      }

      responses.push({ id: fc.id, name: fc.name, response: { ok:true, items } });
    } catch (e:any) {
      const msg = e?.message === 'auth_required' ? 'auth_required' : (e?.message || 'calendar_search_failed');
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: msg } });
    }
    flushToolResponses(responses);
  })();
  break;
}

case 'calendar_create_simple': {
  (async () => {
    const responses:any[] = [];
    try {
      const summary = String(fc.args?.name || '').trim();
      const description = typeof fc.args?.description === 'string' ? fc.args.description : undefined;
      const start = toRFC3339Local(fc.args?.start);
      const end   = toRFC3339Local(fc.args?.end);
      if (!summary || !start || !end) throw new Error('missing_name_or_dates');

      const colorId = colorNameToId(fc.args?.color);
      const tag     = fc.args?.tag ? String(fc.args.tag).trim() : undefined;

      const body:any = {
        summary,
        description,
        colorId,
        start: { dateTime: start },
        end:   { dateTime: end },
        extendedProperties: tag ? { private: { tags: [tag] } } : undefined
      };

      const data = await fetchGCal(`calendars/primary/events`, { method:'POST', body: JSON.stringify(body) });
      responses.push({ id: fc.id, name: fc.name, response: { ok:true, eventId: data.id, colorId: data.colorId || null } });
    } catch (e:any) {
      const msg = e?.message === 'auth_required' ? 'auth_required' : (e?.message || 'calendar_create_failed');
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: msg } });
    }
    flushToolResponses(responses);
  })();
  break;
}

case 'calendar_update_simple': {
  (async () => {
    const responses:any[] = [];
    try {
      const eventId = String(fc.args?.eventId || '');
      if (!eventId) throw new Error('eventId_required');
      const patch:any = {};
      if (typeof fc.args?.name === 'string') patch.summary = fc.args.name;
      if (typeof fc.args?.description === 'string') patch.description = fc.args.description;
      if (typeof fc.args?.color === 'string') {
        const colorId = colorNameToId(fc.args.color);
        if (colorId) patch.colorId = colorId;
      }

      const data = await fetchGCal(`calendars/primary/events/${encodeURIComponent(eventId)}`, {
        method:'PATCH', body: JSON.stringify(patch)
      });
      responses.push({ id: fc.id, name: fc.name, response: { ok:true, eventId: data.id } });
    } catch (e:any) {
      const msg = e?.message === 'auth_required' ? 'auth_required' : (e?.message || 'calendar_update_failed');
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: msg } });
    }
    flushToolResponses(responses);
  })();
  break;
}

case 'calendar_delete': {
  (async () => {
    const responses:any[] = [];
    try {
      const eventId = String(fc.args?.eventId || '');
      if (!eventId) throw new Error('eventId_required');
      await fetchGCal(`calendars/primary/events/${encodeURIComponent(eventId)}`, { method:'DELETE' });
      responses.push({ id: fc.id, name: fc.name, response: { ok:true } });
    } catch (e:any) {
      const msg = e?.message === 'auth_required' ? 'auth_required' : (e?.message || 'calendar_delete_failed');
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: msg } });
    }
    flushToolResponses(responses);
  })();
  break;
}


          case 'memory_update': {
  (async () => {
    if (!userUuid) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'auth_required' } }); return  flushToolResponses(responses);}
    if (!supabase) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'no_supabase' } }); return flushToolResponses(responses); }

    const patch:any = {};
    if (typeof fc.args?.memory === 'string') patch.memory = String(fc.args.memory).trim().slice(0, 2000);
    if (typeof fc.args?.category === 'string') patch.category = String(fc.args.category).trim().toLowerCase();
    if (typeof fc.args?.priority === 'string' && ['low','normal','high'].includes(fc.args.priority)) patch.priority = fc.args.priority;
    if (fc.args?.expiration_date === '') patch.expiration_date = null;
    else if (typeof fc.args?.expiration_date === 'string' && fc.args.expiration_date.trim()) patch.expiration_date = isoOrNull(fc.args.expiration_date);

    if (!Object.keys(patch).length) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'nothing_to_update' } }); return flushToolResponses(responses); }

    try {
      let q = supabase.from('memories').update(patch).select().single();
      if (fc.args?.id) q = q.eq('id', String(fc.args.id)).eq('user_uuid', userUuid);
      else if (fc.args?.name) q = q.eq('user_uuid', userUuid).eq('name', String(fc.args.name));
      else { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'id_or_name_required' } }); return flushToolResponses(responses);; }

      const { data, error } = await q;
      if (error) throw error;
      responses.push({ id: fc.id, name: fc.name, response: { ok:true, id: data.id, name: data.name } });
      flushToolResponses(responses);
    } catch (e:any) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'update_failed' } });
      flushToolResponses(responses);
    }

  })();
  break;
}
case 'memory_delete': {
  (async () => {
    if (!userUuid) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'auth_required' } }); return flushToolResponses(responses);}
    if (!supabase) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'no_supabase' } }); return flushToolResponses(responses); }

    try {
      let q = supabase.from('memories').delete();
      if (fc.args?.id) q = q.eq('id', String(fc.args.id)).eq('user_uuid', userUuid);
      else if (fc.args?.name) q = q.eq('user_uuid', userUuid).eq('name', String(fc.args.name));
      else { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'id_or_name_required' } }); return flushToolResponses(responses); }

      const { error } = await q;
      if (error) throw error;
      responses.push({ id: fc.id, name: fc.name, response: { ok:true } });
      flushToolResponses(responses);
    } catch (e:any) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'delete_failed' } });
      flushToolResponses(responses);
    }
    
  })();
  break;
}
case 'memory_list': {
  (async () => {
    if (!userUuid) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'auth_required' } }); return flushToolResponses(responses);}
    if (!supabase) { responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'no_supabase' } }); return flushToolResponses(responses); }

    const category = fc.args?.category ? String(fc.args.category).toLowerCase() : null;
    const includeExpired = !!fc.args?.includeExpired;
    const limit = Math.max(1, Math.min(100, Number(fc.args?.limit) || 20));

    try {
      let q = supabase
        .from('memories')
        .select('id,name,memory,category,priority,created_at,updated_at,expiration_date')
        .eq('user_uuid', userUuid)
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (category) q = q.eq('category', category);
      if (!includeExpired) q = q.or('expiration_date.is.null,expiration_date.gt.now()');

      const { data, error } = await q;
      if (error) throw error;

      responses.push({ id: fc.id, name: fc.name, response: { ok:true, items: data } });
      flushToolResponses(responses);
    } catch (e:any) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'list_failed' } });
      flushToolResponses(responses);
    }
    
  })();
  break;
}

   
        case 'blackboard_update_step': {
          const idx = Math.max(1, Math.floor(Number(fc.args?.index) || 0)) - 1;
          const text = String(fc.args?.text ?? '');
          setBb(s => {
            if (idx < 0 || idx >= s.steps.length) return s;
            const next = s.steps.slice(); next[idx] = text; return { ...s, steps: next };
          });
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
           
          // --- Export PDF (no dependencies) ---
case 'blackboard_export_pdf': {
  try {
    const root = document.querySelector<HTMLElement>('[data-blackboard-root]');
    if (!root) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'no blackboard root' } });
      break;
    }
    const orientation =
      fc.args?.orientation === 'portrait' || fc.args?.orientation === 'landscape'
        ? fc.args.orientation
        : 'landscape';
    const marginMm = Number.isFinite(fc.args?.marginMm) ? fc.args.marginMm : 8;

    // Build the hidden iframe now, but DON'T print yet.
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position:'fixed', right:'-9999px', width:'0', height:'0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`
      <!doctype html><html><head><meta charset="utf-8"/>
      <title>Export</title>
      <style>
        @page { size: A4 ${orientation}; margin: ${marginMm}mm; }
        html, body { height:100%; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin:0; }
        [data-export-root]{ width:100%; box-sizing:border-box; }
      </style>
      </head><body><div id="page" data-export-root></div></body></html>
    `);
    doc.close();

    const clone = root.cloneNode(true) as HTMLElement;
    clone.removeAttribute('style');
    clone.setAttribute('data-export-root','');
    doc.getElementById('page')!.appendChild(clone);

    // Hand the iframe to the UI popup
    exportIframeRef.current = iframe;
    setExportToast({ label: 'PDF ready — click to save' });

    responses.push({ id: fc.id, name: fc.name, response: { ok:true } });
  } catch (e:any) {
    responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'export_failed' } });
  }
  break;
}

        case 'blackboard_remove_step': {
          const idx = Math.max(1, Math.floor(Number(fc.args?.index) || 0)) - 1;
          setBb(s => {
            if (idx < 0 || idx >= s.steps.length) return s;
            const next = s.steps.slice(); next.splice(idx, 1); return { ...s, steps: next };
          });
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
          break;
        }
        default: {
          // unknown tool
          responses.push({ id: fc.id, name: fc.name, response: { ok:false, error:'unimplemented' } });
        }
      }
    } catch (e:any) {
      responses.push({ id: fc.id, name: fc.name, response: { ok:false, error: e?.message || 'tool_error' } });
    }
  }

  // ✅ Proper toolResponse (SDK or raw camelCase)
  if (sessionRef.current?.sendToolResponse) {
    sessionRef.current.sendToolResponse({ functionResponses: responses });
  } else if (sessionRef.current?.send) {
    sessionRef.current.send({ toolResponse: { functionResponses: responses } });
  }

  // Let the model continue speaking/thinking
  try {
    if (sessionRef.current?.response?.create) sessionRef.current.response.create();
    else sessionRef.current?.send?.({ type: 'response.create' });
  } catch {}

  return;
}


            // Other signals
            if (msg?.setupComplete) { add('← setup.completed'); return; }
            if (msg?.toolCallCancellation) { add('← tool.cancel'); return; }
            if (msg?.goAway) { add('← goAway'); scheduleReconnect('goAway'); return; }
          },

          onerror: (e: any) => { add('live error: ' + (e?.message || e)); tearDownWs(); scheduleReconnect('onerror'); },
          onclose: (e: any) => { add('live: closed'); tearDownWs(); scheduleReconnect('onclose'); }
        }
      });

      sessionRef.current = session;
      wantLiveRef.current = true;
    } catch (e: any) {
      add('connectLive failed: ' + (e?.message || e));
    }
  }

  function tearDownWs() {
    liveOpenRef.current = false; setLive(false);
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    if (frameTimerRef.current) { clearTimeout(frameTimerRef.current); frameTimerRef.current = null; }
  }
  function scheduleReconnect(reason: string) {
    if (!wantLiveRef.current) return;
    if (reconnectTimerRef.current) return;
    add('reconnect scheduled: ' + reason);
    reconnectTimerRef.current = window.setTimeout(async () => {
      reconnectTimerRef.current = null;
      if (!wantLiveRef.current) return;
      try { await connectLive(); } catch (e: any) { add('reconnect error: ' + (e?.message || e)); }
    }, 600) as unknown as number;
  }

  /* ---------------------- MIC STREAMING ---------------------- */
  async function startMic() {
    if (micCtxRef.current) { add('mic: already running'); return; }
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, sampleRate: 16000,
          echoCancellation: true, noiseSuppression: true, autoGainControl: true
        },
        video: false
      });
    } catch (e: any) {
      add('mic getUserMedia error: ' + (e?.message || e));
      return;
    }

    micCtxRef.current = new AudioContext({ sampleRate: 16000 });
    await micCtxRef.current.resume();
    await micCtxRef.current.audioWorklet.addModule('/mic-capture.worklet.js');

    const src = micCtxRef.current.createMediaStreamSource(micStreamRef.current!);
    const node = new AudioWorkletNode(micCtxRef.current, 'mic-capture');
    const silent = micCtxRef.current.createGain(); silent.gain.value = 0;
    src.connect(node).connect(silent).connect(micCtxRef.current.destination);

    const audioQueueRef: React.MutableRefObject<Uint8Array[]> = { current: [] };
    node.port.onmessage = (e: any) => {
      if (!liveOpenRef.current) return;
      const bytes = new Uint8Array(e.data);
      if (bytes.byteLength) audioQueueRef.current.push(bytes);
    };

    // send every 50ms, cap ~8KB
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); }
    sendTimerRef.current = window.setInterval(() => {
      if (!liveOpenRef.current || !sessionRef.current) return;
      if (!audioQueueRef.current.length) return;

      const maxBytes = 8192;
      const parts: Uint8Array[] = [];
      let used = 0;
      while (audioQueueRef.current.length && used < maxBytes) {
        const next = audioQueueRef.current.shift()!;
        if (used + next.length > maxBytes) { audioQueueRef.current.unshift(next); break; }
        parts.push(next); used += next.length;
      }
      if (!parts.length) return;
      const merged = new Uint8Array(used);
      let o = 0; for (const p of parts) { merged.set(p, o); o += p.length; }

      try {
        const s = sessionRef.current;
        const payload = { data: u8ToB64(merged), mimeType: 'audio/pcm;rate=16000' };
        if (s?.sendRealtimeInput) s.sendRealtimeInput({ audio: payload });
        else if (s?.send) s.send({ mimeType: payload.mimeType, data: payload.data });
      } catch (err: any) { add('send error: ' + (err?.message || err)); }
    }, 50) as unknown as number;

    add('mic: running (batched)');
  }

  /* ---------------------- VIDEO FRAME PUMP ---------------------- */
  function stopFramePump() { if (frameTimerRef.current) { clearTimeout(frameTimerRef.current); frameTimerRef.current = null; } }
  function stopVideoTracks() {
    try { videoStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    videoStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }
  async function attachVideoStream(stream: MediaStream) {
    videoStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
  }
  async function startCameraFacing(facingMode: 'user' | 'environment') {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const track = s.getVideoTracks()[0];
    track.addEventListener('ended', () => setVideoSource('none'));
    await attachVideoStream(s);
  }
  async function startScreenShare() {
    const s = await (navigator.mediaDevices as any).getDisplayMedia({
      video: { frameRate: 15, width: { max: 1280 }, height: { max: 720 } },
      audio: false,
    });
    const track = s.getVideoTracks()[0];
    track.addEventListener('ended', () => setVideoSource(prevVideoModeRef.current || 'none'));
    await attachVideoStream(s);
  }
  async function setVideoSource(mode: VideoSource) {
    try {
      if (videoModeRef.current.startsWith('camera')) prevVideoModeRef.current = videoModeRef.current;
      stopFramePump();
      stopVideoTracks();

      if (mode === 'camera-user') await startCameraFacing('user');
      else if (mode === 'camera-environment') await startCameraFacing('environment');
      else if (mode === 'screen') await startScreenShare();
      // else none

      videoModeRef.current = mode;
      setVideoMode(mode);
      if (mode !== 'none') startFramePump();
    } catch (e: any) {
      add('setVideoSource error: ' + (e?.message || e));
      videoModeRef.current = 'none';
      setVideoMode('none');
    }
  }
  function startFramePump() {
    stopFramePump();
    const pump = async () => {
      const v = videoRef.current;
      const s = sessionRef.current;
      if (!v || !s || videoModeRef.current === 'none') {
        frameTimerRef.current = window.setTimeout(pump, 350) as unknown as number;
        return;
      }
      try {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = Math.round((v.videoHeight / v.videoWidth) * 640) || 360;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const blob: Blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.75)!);
        const buf = new Uint8Array(await blob.arrayBuffer());
        const payload = { data: u8ToB64(buf), mimeType: 'image/jpeg' };
        if (s?.sendRealtimeInput) s.sendRealtimeInput({ video: payload });
        else if (s?.send) s.send({ realtimeInput: { video: payload } });
      } catch {}
      frameTimerRef.current = window.setTimeout(pump, 350) as unknown as number;
    };
    pump();
  }

  /*Fuckkkass video nigger*/
  useEffect(() => {
  if (!isVideoOn || !bgVideoRef.current || !videoRef.current) return;
  const src = (videoRef.current as any).srcObject;
  if (src && bgVideoRef.current.srcObject !== src) {
    (bgVideoRef.current as any).srcObject = src;
    bgVideoRef.current.play().catch(() => {});
  }
}, [isVideoOn]);

  /* ---------------------- CONTROLS ---------------------- */
  function toggleVideo() {
    if (isVideoOn) setVideoSource('none');
    else setVideoSource('camera-environment'); // default back camera
  }
  function toggleScreen() {
    if (isScreenOn) setVideoSource('none');
    else setVideoSource('screen');
  }
  async function toggleLive() {
    if (live) {
      await cleanup();
    } else {
      await connectLive();
    }
  }
  async function cleanup() {
    wantLiveRef.current = false;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }

    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    stopFramePump();

    try { await playerRef.current?.close(); } catch {}
    try { await micCtxRef.current?.close(); } catch {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { videoStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    micStreamRef.current = null; videoStreamRef.current = null;

    try { sessionRef.current?.close?.(); } catch {}
    sessionRef.current = null;

    if (outFlushTimerRef.current) { clearTimeout(outFlushTimerRef.current); outFlushTimerRef.current = null; }
    outBufRef.current = new Int16Array(0);
    audioPathRef.current = null;
    resetPlayback();

    tearDownWs();
    setSpeaking(false);
    add('cleanup complete');
  }

  /* ---------------------- NAVIGATION ---------------------- */
  const exitVideoMode = () => { navigate('/chat'); };

 return (

 /*UI YESSSSS*/
   
   /*Blackboard*/
  <div className="min-h-screen text-white relative overflow-hidden">
{/* ===== BLACKBOARD MODE ===== */}
{isBlackboard && (
  <>
    {/* OPAQUE sheet + dotted grid (over video, under cards) */}
    <div className="absolute inset-0 z-[60] pointer-events-none">
      {/* fully opaque black — no transparency */}
      <div className="absolute inset-0 bg-[#0B0C10]" />
      {/* dotted grid on top of solid black */}
      <div
        className="
          absolute inset-0
          bg-[radial-gradient(rgba(255,255,255,0.08)_1.1px,transparent_1.1px)]
          [background-size:16px_16px]
          [background-position:0_0]"
      />
      {/* optional soft tint */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_85%,rgba(64,119,255,0.14),transparent)]" />
    </div>

    {/* Cards (scrollable). Add ~60px top space. Keep bottom padding so dock stays visible */}
    <div
        data-blackboard-root
      className="
        absolute inset-0 z-[70] overflow-auto px-3 pt-[60px]
        pb-[calc(88px+16px)]   /* dock height (~88px) + 16px gap */
        pointer-events-auto"
    >
      <div className="max-w-[680px] mx-auto space-y-3">
{isBlackboard && exportToast && (
  <div className="absolute inset-0 z-[90] pointer-events-none">
    <div className="absolute bottom-5 right-5 pointer-events-auto">
      <button
        onClick={() => {
          try {
            exportIframeRef.current?.contentWindow?.focus();
            exportIframeRef.current?.contentWindow?.print();
          } finally {
            // Clean up a bit later (print dialog may block)
            setTimeout(() => {
              exportIframeRef.current?.remove();
              exportIframeRef.current = null;
              setExportToast(null);
            }, 4000);
          }
        }}
        className="px-3.5 py-2.5 rounded-xl text-[13px] font-medium
                   bg-[#1f2937] text-white/95 border border-white/15
                   shadow-[0_6px_24px_rgba(0,0,0,.35)]
                   hover:bg-[#253141] transition"
        title="Save blackboard as PDF"
      >
        {exportToast.label}
      </button>
    </div>
  </div>
)}

        {(bb.title || bb.description) && (
          <section className="rounded-2xl bg-[#252430] border border-white/15 p-3">
            <div className="text-sm font-semibold text-white/90 mb-1 flex items-center gap-2">
              <span className="text-[16px]" role="img" aria-label="Target">🎯</span>
              <span className="truncate">{bb.title ?? 'Title'}</span>
            </div>
            {bb.description && (
              <p className="text-white/85 text-[13px] leading-5">{bb.description}</p>
            )}
          </section>
        )}

        {bb.concept && (
          <section className="rounded-2xl bg-[#252430] border border-white/15 p-3">
            <div className="text-sm font-semibold text-white/90 mb-1 flex items-center gap-2">
              <span className="text-[16px]" role="img" aria-label="Books">📚</span>
              <span>Concepto</span>
            </div>
            <p className="text-white/90 text-[13px] leading-5 whitespace-pre-wrap">
              {bb.concept}
            </p>
          </section>
        )}

        {bb.steps.length > 0 && (
          <section className="rounded-2xl bg-[#252430] border border-white/15 p-3">
            <div className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
              <span className="text-[16px]" role="img" aria-label="Compass">🧭</span>
              <span>Paso a paso</span>
            </div>
            <ol className="space-y-2">
              {bb.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="inline-grid place-items-center min-w-[22px] h-[22px]
                                   rounded-full bg-white/14 text-white/90 text-[12px]">
                    {i + 1}
                  </span>
                  <p className="text-white/90 text-[13px] leading-5 whitespace-pre-wrap">{s}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

      </div>
    </div>
  </>
)}


 
    {/* ===== FULLSCREEN BACKGROUND ===== */}
    {/* Blurred/dark video when live */}
    {isVideoOn ? (
      <>
        <video
          ref={bgVideoRef}
          className="fixed inset-0 w-full h-full object-cover z-0
                     "
          autoPlay
          muted
          playsInline
        />
        {/* darkening + subtle tint */}
        <div className="fixed inset-0 z-[1] pointer-events-none
                        bg-black/55" />
        {/* soft vignette so edges fall off */}
        <div className="fixed inset-0 z-[2] pointer-events-none
                        
                        backdrop-blur-[18px]" />
      </>
    ) : (
      // Blue gradient when NO video
      <>
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0A1326] via-[#0B1E3D] to-[#0A2A55]" />
        <div className="fixed inset-0 z-[1] bg-[radial-gradient(62%_38%_at_50%_82%,rgba(64,119,255,0.20),transparent_70%)]" />
      </>
    )}

    {/* ===== STATUS + TITLE ===== */}
    <div className="absolute top-3 left-4 z-[70] flex items-center gap-2 text-xs text-white/70 mb-3 mt-3">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${
          speaking ? 'bg-emerald-400' : live ? 'bg-sky-400' : 'bg-zinc-500'
        }`}
      />
      <span>{speaking ? 'En vivo' : live ? 'En vivo' : 'Pausado'}</span>
    </div>
    <h1 className="absolute top-3 inset-x-0 text-center text-[17px] font-semibold z-40 mb-3 mt-3">
      Cassie
    </h1>

  {/* ===== STAGE (CENTERED PHONE-LIKE AREA) ===== */}
<main className="relative z-20 grid place-items-center min-h-screen">
  <div
    className="

  
       rounded-[28px] overflow-hidden
      
    "
  >
    {/* 3-row layout INSIDE stage */}
    <div className="absolute inset-0 flex flex-col">
      {/* ===== 1) CAPTION BAND ===== */}
      <div className={`${isVideoOn ? 'h-[72px] px-4 pt-3' : 'h-[38vh] px-6'}`}>
        {/* video ON → top-left; video OFF → centered lower third */}
        {isVideoOn ? (
          <div className={`w-[88%] max-w-[760px] transition-all duration-200 mt-[50px] ${capWipe ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
            {capLines.map((l, i) => (
              <p key={`cap-video-${i}`}
                 className="text-[15px] md:text-[16px] font-medium tracking-tight text-white
                            drop-shadow-[0_2px_14px_rgba(0,0,0,.55)]">
                {l}
              </p>
            ))}
            {capCurrent && (
              <p className="text-[16px] md:text-[17px] font-semibold tracking-tight text-white
                             drop-shadow-[0_2px_16px_rgba(0,0,0,.6)]">
                {capCurrent}
              </p>
            )}
          </div>
        ) : (
          <div className="h-full w-full grid place-items-center">
            <div className={`w-[86%] text-center space-y-1 transition-all duration-200 ${capWipe ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}>
              {capLines.map((l, i) => (
                <p key={`cap-novid-${i}`}
                   className="text-[clamp(18px,3.4vw,22px)] font-semibold tracking-tight text-white
                              drop-shadow-[0_2px_18px_rgba(0,0,0,.6)]">
                  {l}
                </p>
              ))}
              {capCurrent && (
                <p className="text-[clamp(20px,3.8vw,24px)] font-bold tracking-tight text-white
                               drop-shadow-[0_2px_22px_rgba(0,0,0,.65)]">
                  {capCurrent}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 2) VIDEO BAND (flex-1) ===== */}
      <div className="relative flex-1 mb-[40px] mt-[60px]">
        {/* Foreground live video strictly limited to this band */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl"
          autoPlay playsInline muted
        />
        {/* Highlights overlay constrained to video band */}
        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none z-10" />

        {/* Flip camera chip stays INSIDE this band, clear of the dock */}
        {isCameraOn && (
          <button
            onClick={() =>
              setVideoSource(videoMode === 'camera-user' ? 'camera-environment' : 'camera-user')
            }
            className="absolute bottom-3 right-3 z-20 p-3 bg-white/12 rounded-full
                       text-white/90 hover:bg-white/16 transition"
            title="Cambiar cámara"
          >
            <Repeat className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ===== 3) DOCK BAND (fixed height) ===== */}
      <div className="relative h-[76px] mb-3 mt-3">
        {/* subtle top gradient so the dock reads on bright video */}
        <div className="absolute inset-x-0 top-0 h-10 z-[79]
                         pointer-events-none" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-[80]">
          {/* Dock: glass, NO outline */}
          <div className="flex items-center gap-3 rounded-[26px]
                          ">
            {/* Video — rounded-square */}
           
            <button
              onClick={toggleVideo}
              aria-pressed={isVideoOn}
              className={`h-14 w-14 grid place-items-center transition
                          ${isVideoOn ? 'rounded-2xl bg-[#6E78B2] hover:bg-[#6E78B2]' : 'rounded-full bg-[#222E39]'}
                          ${isVideoOn ? 'text-[#0A1448]' : 'text-white/90'} backdrop-blur-sm`}
              title={isVideoOn ? 'Apagar cámara/pantalla' : 'Encender cámara (trasera)'}
            >
             {isVideoOn ? <Video className="w-8 h-8" fill="#0A1448"/> : <VideoOff className="w-8 h-8" />}
            </button>
    
            {/* Screen — rounded-square */}
             {!isBlackboard && (
            <button
              onClick={toggleScreen}
              aria-pressed={isScreenOn}
              className={`h-14 w-14 rounded-full grid place-items-center transition
                          ${isScreenOn ? 'bg-green-500/20'  : 'bg-[#222E39] hover:bg-[#222E39]'}
                          text-white/90 backdrop-blur-sm`}
              title={isScreenOn ? 'Detener compartir pantalla' : 'Compartir pantalla'}
            >
              <MonitorUp className="w-8 h-8" />
            </button>
)}
            {/* Live — round */}
            <button
              onClick={toggleLive}
              className={`h-14 w-14 rounded-full grid place-items-center transition
                          ${live ? 'bg-[#6DAF7B] text-[#366743]' : 'bg-[#222E39] hover:bg-[#222E39] text-white/90'}
                          backdrop-blur-sm`}
              title={live ? 'Pausar' : 'Reanudar'}
            >
              {live ? <Pause className="w-8 h-8" fill="#366743" /> : <Play className="w-8 h-8" fill="#FFFFFF" />}
            </button>

            {/* Exit — round */}
            <button
              onClick={async () => { await cleanup(); navigate('/chat'); }}
              className="h-14 w-14 rounded-full grid place-items-center
                         bg-[#d38997] hover:bg-[#d38997] text-black
                         transition backdrop-blur-sm"
              title="Salir"
            >
              <X className="w-8 h-8" strokeWidth="1"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</main> 
  </div>
);





}
