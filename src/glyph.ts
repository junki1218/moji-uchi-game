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
