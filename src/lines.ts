// せんの れんしゅう（2026-10-27）。一筆書きで終わる図形を20こ、やさしい順に。
// 図形は 0〜1 の四角の中の点の並び（左上が 0,0）。1本目の点が書きはじめ。
// 直線は点を細かく足し、曲線は式から点をとる（ヒントのアニメ・なぞりの当たり判定・プリントで同じ点を使う）

import type { Question } from './questions';

export type Pt = [number, number];

/** 直線をつないだ形（点のあいだを細かく区切る） */
function poly(...pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.01));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** 式で描く形（t は 0〜1） */
function curve(f: (t: number) => Pt, n = 240): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}

const TAU = Math.PI * 2;

/** 正多角形・星の角（上から始めて、左回り） */
function corners(n: number, r: number, step = 1, cy = 0.5): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = -Math.PI / 2 - (i * step * TAU) / n;
    return [0.5 + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

export interface LineShape {
  id: string;
  name: string;
  pts: Pt[];
}

const SHAPES: [string, Pt[]][] = [
  ['よこせん', poly([0.12, 0.5], [0.88, 0.5])],
  ['たてせん', poly([0.5, 0.12], [0.5, 0.88])],
  ['ななめせん', poly([0.16, 0.16], [0.84, 0.84])],
  ['かぎせん', poly([0.22, 0.14], [0.22, 0.84], [0.84, 0.84])],
  ['やま', poly([0.12, 0.8], [0.5, 0.2], [0.88, 0.8])],
  ['ジグザグ', poly([0.1, 0.68], [0.26, 0.32], [0.42, 0.68], [0.58, 0.32], [0.74, 0.68], [0.9, 0.32])],
  ['なみせん', curve((t) => [0.1 + 0.8 * t, 0.5 - 0.17 * Math.sin(t * TAU * 2)])],
  ['かいだん', poly([0.12, 0.84], [0.12, 0.64], [0.37, 0.64], [0.37, 0.44], [0.62, 0.44], [0.62, 0.24], [0.88, 0.24])],
  // まるは、上から左回り（ひらがなの「の」「あ」と同じむき）
  ['まる', curve((t) => [0.5 - 0.36 * Math.sin(t * TAU), 0.5 - 0.36 * Math.cos(t * TAU)])],
  ['さんかく', poly([0.5, 0.14], [0.13, 0.82], [0.87, 0.82], [0.5, 0.14])],
  ['しかく', poly([0.18, 0.18], [0.18, 0.82], [0.82, 0.82], [0.82, 0.18], [0.18, 0.18])],
  ['ひしがた', poly([0.5, 0.1], [0.2, 0.5], [0.5, 0.9], [0.8, 0.5], [0.5, 0.1])],
  ['ろっかくけい', poly(...corners(6, 0.38))],
  ['くるくる', curve((t) => [0.17 + 0.62 * t - 0.09 * Math.sin(t * TAU * 4), 0.52 - 0.17 * Math.cos(t * TAU * 4)], 400)],
  ['うずまき', curve((t) => {
    const a = -Math.PI / 2 - t * TAU * 3;
    const r = 0.38 - 0.33 * t;
    return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
  }, 400)],
  ['いなずま', poly([0.62, 0.08], [0.3, 0.54], [0.56, 0.5], [0.36, 0.92])],
  ['ハート', curve((t) => {
    const a = t * TAU;
    const x = 16 * Math.sin(a) ** 3;
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    return [0.5 - x / 40, 0.47 - y / 40];
  }, 300)],
  ['ほし', poly(...corners(5, 0.4, 2, 0.54))],
  ['むげん', curve((t) => {
    const a = t * TAU;
    const d = 1 + Math.sin(a) ** 2;
    return [0.5 + (0.4 * Math.cos(a)) / d, 0.5 - (0.4 * Math.sin(a) * Math.cos(a)) / d];
  }, 300)],
  ['くも', curve((t) => {
    const a = -Math.PI / 2 - t * TAU;
    const r = 0.3 + 0.07 * Math.abs(Math.sin(a * 3.5));
    return [0.5 + r * 1.2 * Math.cos(a), 0.52 + r * 0.95 * Math.sin(a)];
  }, 400)],
];

export const LINE_SHAPES: LineShape[] = SHAPES.map(([name, pts], i) => ({ id: `line_${String(i + 1).padStart(2, '0')}`, name, pts }));

export const lineShape = (id: string): LineShape | undefined => LINE_SHAPES.find((s) => s.id === id);

/** 問題としての形（ラウンド・プリントの選ぶ画面で使う） */
export const LINE_QUESTIONS: Question[] = LINE_SHAPES.map((s) => ({
  id: s.id,
  type: 'word' as const,
  category: 'line' as const,
  hira: s.name,
  emoji: '〰️',
  builtin: false,
}));

/** 形のすじ道を g に入れる（beginPath から。x, y, size は描く四角） */
export function tracePath(g: CanvasRenderingContext2D, pts: Pt[], x: number, y: number, size: number, upTo = pts.length): void {
  g.beginPath();
  g.moveTo(x + pts[0][0] * size, y + pts[0][1] * size);
  for (let i = 1; i < Math.min(upTo, pts.length); i++) g.lineTo(x + pts[i][0] * size, y + pts[i][1] * size);
}

/** 形の長さ（0〜1 の四角の中で） */
export function pathLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** 形の小さな絵（プリントの選ぶ画面・カード）。書きはじめに緑の点 */
export function shapeThumb(pts: Pt[], px = 200): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#555';
  g.lineWidth = px * 0.035;
  tracePath(g, pts, 0, 0, px);
  g.stroke();
  g.fillStyle = '#4caf50';
  g.beginPath();
  g.arc(pts[0][0] * px, pts[0][1] * px, px * 0.045, 0, TAU);
  g.fill();
  return c;
}
