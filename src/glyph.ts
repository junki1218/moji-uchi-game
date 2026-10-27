// 字をマスの上下の真ん中に描く（2026-10-17）。
// textBaseline: middle はフォントによって字が少し下に出る。そこで、代表的なかなの字の形を測り、
// その「上下の真ん中」がマスの真ん中に来るように描く。
// 1文字ずつの形でそろえると、ゃ・っ・ー まで真ん中に寄ってしまう（書く練習ではまちがい）ので、
// 測るのは代表の字だけ。字ごとの位置（小さい字は左下など）はフォントのとおりに残る。

const REF = Array.from('あいうえおかきくけこさしすせそたなにぬねのはまやらわ');
const cache = new Map<string, number>();

/** いまの g.font で、ベースラインから代表的な字の形の真ん中までの高さ */
function midAboveBaseline(g: CanvasRenderingContext2D): number {
  const key = g.font;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const base = g.textBaseline;
  g.textBaseline = 'alphabetic';
  const mid = REF.reduce((s, c) => {
    const m = g.measureText(c);
    return s + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  }, 0) / REF.length;
  g.textBaseline = base;
  cache.set(key, mid);
  return mid;
}

// フォントが読み込まれたら測り直す（読み込み前の代わりのフォントで測った値を捨てる）
document.fonts?.addEventListener?.('loadingdone', () => cache.clear());

/** (cx, cy) を真ん中にして字を描く。描いた位置（textAlign center・ベースライン）を返す */
export function fillCenteredAt(g: CanvasRenderingContext2D, ch: string, cx: number, cy: number): [number, number] {
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const y = cy + midAboveBaseline(g);
  g.fillText(ch, cx, y);
  return [cx, y];
}

/** w × h の真ん中に字を描く */
export function fillCentered(g: CanvasRenderingContext2D, ch: string, w: number, h: number): [number, number] {
  return fillCenteredAt(g, ch, w / 2, h / 2);
}

// ------------------------------------------------------------ 英語の4本線（2026-10-27）
// 学校の英語の4線ノートと同じきまりで書く（2026-10-27 直し）:
// - 4本の線は同じ間をあける（帯が3つ、どれも同じ高さ）
// - 大文字は 1本目〜3本目（帯2つぶん）
// - 小文字の a・o などは 2本目〜3本目（帯1つぶん）。b・d・h・k・l は 1本目まで、g・j・p・q・y は 4本目まで
// フォントの字は、そのままではこの比になっていない（a の高さに対して上や下の出っぱりが短い）。
// そこで字を 上の出っぱり／a の高さの部分／下の出っぱり の3つに切り分け、それぞれを帯の高さまでのばして描く。
// t の上や i の点は、l の高さに対する割合のまま（t は 1本目より少し低い）。
// 線の色はカラーマスと同じ色の仲間（濃いめにして見えるように）

export const EN_FONT = '"Andika", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif';
export const EN_LINE_COLORS = ['#56c1ee', '#f28cb4', '#f0c400', '#68c35a'];

const SRC = 200; // 切り分ける前の字の大きさ（px）

interface EnRef { asc: number; xh: number; desc: number; cap: number }
const enCache = new Map<string, EnRef>();
document.fonts?.addEventListener?.('loadingdone', () => enCache.clear());

let scratch: CanvasRenderingContext2D | null = null;
function scratchCtx(): CanvasRenderingContext2D {
  if (!scratch) scratch = document.createElement('canvas').getContext('2d')!;
  return scratch;
}

/** SRC px の字で測った、l の高さ・x の高さ・g の深さ・大文字の高さ */
function enRef(): EnRef {
  const hit = enCache.get(EN_FONT);
  if (hit) return hit;
  const g = scratchCtx();
  g.font = `700 ${SRC}px ${EN_FONT}`;
  const up = (s: string) => Math.max(...Array.from(s, (c) => g.measureText(c).actualBoundingBoxAscent));
  const down = (s: string) => Math.max(...Array.from(s, (c) => g.measureText(c).actualBoundingBoxDescent));
  const m = { asc: up('bdhkl'), xh: up('xzvw'), desc: down('gpqy'), cap: up('EFHILT') };
  enCache.set(EN_FONT, m);
  return m;
}

export interface EnLines {
  /** 帯1つの高さ */
  band: number;
  /** 4本の線の y（上から） */
  ys: [number, number, number, number];
}

/** 高さ h のマスの4本線の位置（上下に 1割ずつ余白、線は同じ間） */
export function enLines(_g: CanvasRenderingContext2D, h: number, top = 0): EnLines {
  const band = (h * 0.8) / 3;
  const y1 = top + h * 0.1;
  return { band, ys: [y1, y1 + band, y1 + band * 2, y1 + band * 3] };
}

/** 4本線を引く（x から幅 w）。lw は線の太さ。3本目（字をのせる線）だけ少し太く */
export function drawEnLines(g: CanvasRenderingContext2D, x: number, w: number, L: EnLines, lw: number): void {
  g.save();
  g.setLineDash([]);
  L.ys.forEach((y, i) => {
    g.strokeStyle = EN_LINE_COLORS[i];
    g.lineWidth = i === 2 ? lw * 1.8 : lw;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
  });
  g.restore();
}

const isUpper = (ch: string) => ch >= 'A' && ch <= 'Z';

/** 横の倍率（大文字は大文字の高さ、小文字は x の高さで決める） */
function enScaleX(ch: string, L: EnLines): number {
  const r = enRef();
  return isUpper(ch) ? (L.band * 2) / r.cap : L.band / r.xh;
}

/** 4本線に書いたときの字の幅 */
export function enGlyphWidth(ch: string, L: EnLines): number {
  const g = scratchCtx();
  g.font = `700 ${SRC}px ${EN_FONT}`;
  return g.measureText(ch).width * enScaleX(ch, L);
}

/**
 * 字を4本線のきまりどおりに描く（横は cx が真ん中）。色は g.fillStyle。
 * stroke＞0 は字のふちを太らせる、erase＞0 はふちを削る（なぞりの見本の太さ・当たり判定。target の px）
 */
export function drawEnGlyph(g: CanvasRenderingContext2D, ch: string, cx: number, L: EnLines, opt: { stroke?: number; erase?: number } = {}): [number, number] {
  const r = enRef();
  const kx = enScaleX(ch, L);
  const extra = Math.max(opt.stroke ?? 0, opt.erase ?? 0) / kx; // 元の字の px で
  const pad = Math.ceil(SRC * 0.15 + extra);
  const src = document.createElement('canvas');
  const s = src.getContext('2d')!;
  s.font = `700 ${SRC}px ${EN_FONT}`;
  const adv = s.measureText(ch).width;
  const B = pad + SRC * 1.2; // 元の字のベースライン
  src.width = Math.ceil(adv + pad * 2);
  src.height = Math.ceil(B + SRC * 0.5 + pad);
  s.font = `700 ${SRC}px ${EN_FONT}`;
  s.textAlign = 'left';
  s.textBaseline = 'alphabetic';
  s.lineJoin = 'round';
  s.fillStyle = g.fillStyle;
  s.strokeStyle = g.fillStyle;
  s.fillText(ch, pad, B);
  if (opt.stroke && opt.stroke > 0) {
    s.lineWidth = opt.stroke / kx;
    s.strokeText(ch, pad, B);
  } else if (opt.erase && opt.erase > 0) {
    s.globalCompositeOperation = 'destination-out';
    s.lineWidth = opt.erase / kx;
    s.strokeText(ch, pad, B);
  }

  const base = L.ys[2];
  const dx = cx - (pad + adv / 2) * kx;
  const dw = src.width * kx;
  const kDown = L.band / r.desc;
  if (isUpper(ch)) {
    // 大文字: 1本目〜3本目
    const k = (L.band * 2) / r.cap;
    g.drawImage(src, 0, 0, src.width, B, dx, base - B * k, dw, B * k + 0.5);
  } else {
    const xTop = B - r.xh;
    const kTop = L.band / (r.asc - r.xh);
    // 上の出っぱり（x の高さより上）: 2本目の線から上へ
    g.drawImage(src, 0, 0, src.width, xTop, dx, L.ys[1] - xTop * kTop, dw, xTop * kTop + 0.5);
    // a の高さの部分: 2本目〜3本目
    g.drawImage(src, 0, xTop, src.width, r.xh, dx, L.ys[1], dw, L.band + 0.5);
  }
  // 下の出っぱり: 3本目から下へ
  g.drawImage(src, 0, B, src.width, src.height - B, dx, base, dw, (src.height - B) * kDown);
  return [cx, base];
}
