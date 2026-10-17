// キネティックタイポグラフィ（2026-10-17）。字を1つずつ動かして、ことばを「見て楽しい」ものにする。
// - letters(): 字を1つずつ span に分け、--i（何文字目か）を付ける。CSS 側で時間差の動きを付ける
// - burstAt(): 画面の上（canvas やステージ）の好きな位置に、字が飛び出して消える動きを出す
// 動きを減らす設定（prefers-reduced-motion）では CSS 側でほぼ止める。

export type KineticKind =
  | 'scatter' // ことばがばらばらに弾け飛ぶ（シャボン玉が割れたとき）
  | 'pop' // 字が1つずつ大きく飛び出して、ふわっと上へ消える（「ぱちん！」）
  | 'drop' // 字が上から落ちてきて弾む（「ゴール！」）
  | 'wobble'; // 小さくぷるぷる（まちがいの「ぽよん」）

const LIFE_MS: Record<KineticKind, number> = { scatter: 1100, pop: 1300, drop: 1600, wobble: 900 };

/** 字を1つずつ span にする。CSS で .kt-char の --i を使って時間差を付ける */
export function letters(text: string, cls = ''): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = `kt ${cls}`.trim();
  wrap.setAttribute('aria-label', text);
  Array.from(text).forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'kt-char';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', String(i));
    s.textContent = c === ' ' ? ' ' : c;
    wrap.append(s);
  });
  return wrap;
}

/**
 * container の中の (x, y)（container の左上からの px）に、字が動いて消える演出を出す。
 * container は position: relative か absolute であること。
 */
export function burstAt(container: HTMLElement, text: string, x: number, y: number, kind: KineticKind, size = 1): void {
  const chars = Array.from(text);
  const layer = document.createElement('div');
  layer.className = `kt-burst kt-${kind}`;
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  layer.style.setProperty('--size', String(size));
  layer.setAttribute('aria-hidden', 'true');
  const n = chars.length;
  chars.forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'kt-bchar';
    s.textContent = c;
    const off = i - (n - 1) / 2; // まんなかからの位置
    s.style.setProperty('--i', String(i));
    s.style.setProperty('--off', String(off));
    if (kind === 'scatter') {
      // まわりへ放射状に飛ぶ
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 70 + Math.random() * 60;
      s.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * dist - 20}px`);
      s.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    } else {
      s.style.setProperty('--rot', `${(Math.random() - 0.5) * 24}deg`);
    }
    layer.append(s);
  });
  container.append(layer);
  window.setTimeout(() => layer.remove(), LIFE_MS[kind] + n * 60);
}

/** canvas の座標（CSS px）で burstAt する。canvas の親を舞台にする */
export function burstOnCanvas(canvas: HTMLCanvasElement, text: string, x: number, y: number, kind: KineticKind, size = 1): void {
  const parent = canvas.parentElement;
  if (!parent) return;
  const cr = canvas.getBoundingClientRect();
  const pr = parent.getBoundingClientRect();
  burstAt(parent, text, x + cr.left - pr.left, y + cr.top - pr.top, kind, size);
}
