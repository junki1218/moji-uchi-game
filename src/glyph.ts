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
// 英語は「真ん中」ではなく線にのせて書く。上から 1本目＝大文字・d の上、2本目＝a・o の上、
// 3本目＝字をのせる線（ベースライン）、4本目＝g・y の下。線の高さはフォントの字の形を測って決めるので、
// どのフォントでも字が帯にぴったり入る。線の色はカラーマスと同じ色の仲間（濃いめにして見えるように）

export const EN_FONT = '"Andika", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif';
export const EN_LINE_COLORS = ['#56c1ee', '#f28cb4', '#f0c400', '#68c35a'];

const enCache = new Map<string, { asc: number; xh: number; desc: number }>();
document.fonts?.addEventListener?.('loadingdone', () => enCache.clear());

/** 100px の字で測った、上の線までの高さ・a の高さ・下の線までの深さ */
function enMetrics(g: CanvasRenderingContext2D): { asc: number; xh: number; desc: number } {
  const hit = enCache.get(EN_FONT);
  if (hit) return hit;
  const font = g.font;
  g.font = `700 100px ${EN_FONT}`;
  const up = (s: string) => Math.max(...Array.from(s, (c) => g.measureText(c).actualBoundingBoxAscent));
  const down = (s: string) => Math.max(...Array.from(s, (c) => g.measureText(c).actualBoundingBoxDescent));
  const m = { asc: up('bdhklABDH'), xh: up('acemnorsuvwxz'), desc: down('gjpqy') };
  g.font = font;
  enCache.set(EN_FONT, m);
  return m;
}

export interface EnLines {
  /** 字の大きさ（px） */
  size: number;
  /** 4本の線の y（上から） */
  ys: [number, number, number, number];
}

/** 高さ h のマスの4本線の位置と、そこに入る字の大きさ */
export function enLines(g: CanvasRenderingContext2D, h: number, top = 0): EnLines {
  const m = enMetrics(g);
  const span = m.asc + m.desc;
  const k = (h * 0.8) / span; // 上下に 1割ずつ余白
  const y1 = top + h * 0.1;
  const base = y1 + m.asc * k;
  return { size: 100 * k, ys: [y1, base - m.xh * k, base, base + m.desc * k] };
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

/** 字を4本線にのせて、横は真ん中に描く（g.font はここで決める）。描いた位置を返す */
export function fillOnLines(g: CanvasRenderingContext2D, ch: string, cx: number, L: EnLines): [number, number] {
  g.font = `700 ${L.size}px ${EN_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText(ch, cx, L.ys[2]);
  return [cx, L.ys[2]];
}
