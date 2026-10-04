// 問題の前に遊ぶミニゲーム。次に出る問題の絵と言葉を使う（2026-10-04 作り直し）。
// 手ざわりは「開発材料【質感】」の demos を移植している。
//   bubble … 13_シャボン玉: 正解の言葉の玉だけタップで割れる（ほかはポヨンと弾むだけ）  ゴール: 3つ
//   lock   … 10_ラチェットダイヤル: 文字のダイヤルをカチカチ回して正解の言葉にそろえる   ゴール: 開く
//   hockey … 17_エアホッケー（Lv3 大理石）: 絵のパックをはじいて正解の言葉のゴールへ      ゴール: 入れる
// 数値は docs/06_5段階レベル対応表.md の値を基準にしている。

import { sfx } from './audio';
import { DAKUON, SEION } from './kana';
import type { MinigameKind } from './settings';

export type { MinigameKind };

export const MINIGAMES: { id: MinigameKind; label: string; instruction: string; goal: number }[] = [
  { id: 'bubble', label: 'シャボン玉', instruction: 'えと おなじ ことばの しゃぼんだまを みっつ わろう', goal: 3 },
  { id: 'lock', label: '錠前', instruction: 'もじを あわせて かぎを あけよう', goal: 1 },
  { id: 'hockey', label: 'エアホッケー', instruction: 'えを おなじ ことばの ゴールに いれよう', goal: 1 },
];

/** ミニゲームに渡す、次の問題の情報 */
export interface MiniQuestion {
  /** 正解の言葉（表示用。カタカナ設定ならカタカナ） */
  answer: string;
  /** 正解の字（表示用）と、最初から決まっている字（文の「が」）の位置 */
  chars: string[];
  fixed: Set<number>;
  /** まちがいの言葉（表示用。同じカテゴリのほかの問題から） */
  others: string[];
  /** 次の問題の絵（DOM）と、canvas に描くための画像 URL（なければ絵文字） */
  picture: () => HTMLElement;
  pictureUrl: () => Promise<string | null>;
  emoji: string;
  /** 見本を出すか（出題モード ① 見本あり） */
  showSample: boolean;
  /** ひらがな→表示用（カタカナ設定のとき変換） */
  toScript: (s: string) => string;
}

const TAU = Math.PI * 2;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * stage（ミニゲームの場所）にゲームを組み立てて動かす。1つ進むたびに onProgress(数) を呼ぶ。
 * 戻り値は後片付け（画面を離れるときに呼ぶ）。
 */
export function runMinigame(
  kind: MinigameKind,
  stage: HTMLElement,
  q: MiniQuestion,
  onProgress: (count: number) => void,
): () => void {
  if (kind === 'lock') return lockGame(stage, q, onProgress);
  const canvas = el('canvas', 'mini-canvas');
  if (kind === 'bubble') {
    // 上に次の問題の絵、下でシャボン玉が飛ぶ
    const pic = el('div', 'mini-pic');
    pic.append(q.picture());
    stage.append(pic, canvas);
    return canvasLoop(canvas, bubbleGame(q, onProgress));
  }
  stage.append(canvas);
  return canvasLoop(canvas, hockeyGame(q, onProgress));
}

// ------------------------------------------------------------ canvas の土台

interface Game {
  resize(w: number, h: number): void;
  step(): void;
  draw(g: CanvasRenderingContext2D): void;
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(): void;
}

function canvasLoop(canvas: HTMLCanvasElement, game: Game): () => void {
  const g = canvas.getContext('2d')!;
  let w = 0;
  let h = 0;
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = r.width;
    h = r.height;
    game.resize(w, h);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  setTimeout(fit, 0);

  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    game.down(...pos(e));
  };
  const onMove = (e: PointerEvent) => game.move(...pos(e));
  const onUp = () => game.up();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  let raf = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    if (w && h) {
      game.step();
      g.clearRect(0, 0, w, h);
      game.draw(g);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  };
}

/** 円の中に収まる大きさで言葉を書く */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, maxSize: number, color: string): void {
  const n = Array.from(text).length;
  const size = Math.max(14, Math.min(maxSize, (maxW / Math.max(n, 1)) * 1.05));
  g.font = `bold ${size}px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size * 0.18);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

// ------------------------------------------------------------ シャボン玉（正解の言葉だけ割れる）

function bubbleGame(q: MiniQuestion, onProgress: (n: number) => void): Game {
  let W = 0;
  let H = 0;
  let t = 0;
  let unit = 1;
  let count = 0;
  interface Bubble { x: number; y: number; r: number; vx: number; hue: number; phase: number; squish: number; squishV: number; word: string; ok: boolean }
  let bubbles: Bubble[] = [];
  let rings: { x: number; y: number; r: number; life: number; hue: number }[] = [];
  let drops: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const words = [q.answer, ...q.others.slice(0, 3)];

  const spawn = (y?: number) => {
    // 正解の玉が画面に少ないときは、正解を出しやすくする（待たせない）
    const okOnScreen = bubbles.filter((b) => b.ok).length;
    const ok = okOnScreen === 0 || Math.random() < 0.4;
    const word = ok ? q.answer : words[1 + Math.floor(Math.random() * (words.length - 1))] ?? q.answer;
    const r = (62 + Math.random() * 18) * unit;
    bubbles.push({
      x: r + Math.random() * Math.max(1, W - 2 * r), y: y ?? H + r, r,
      vx: (Math.random() - 0.5) * 0.5, hue: Math.random() * 360, phase: Math.random() * TAU,
      squish: 0, squishV: 0, word, ok: word === q.answer,
    });
  };

  return {
    resize(w, h) {
      W = w; H = h;
      unit = Math.min(w, h * 1.6) / 700;
      if (!bubbles.length) for (let k = 0; k < 3; k++) spawn(H * (0.35 + k * 0.25));
    },
    step() {
      t++;
      if (t % 50 === 0 && bubbles.length < 6) spawn();
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= (0.75 + Math.sin(b.phase + t * 0.02) * 0.15) * unit;
        b.x += b.vx + Math.sin(b.phase + t * 0.017) * 0.4;
        b.vx *= 0.98;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x));
        b.squishV += -0.12 * b.squish - 0.1 * b.squishV;
        b.squish += b.squishV;
        if (b.y < -b.r - 20) bubbles.splice(i, 1);
      }
      rings = rings.filter((r) => r.life-- > 0);
      for (const r of rings) r.r += 4 * unit;
      drops = drops.filter((d) => d.life-- > 0);
      for (const d of drops) { d.vy += 0.25; d.x += d.vx; d.y += d.vy; }
    },
    draw(g) {
      for (const b of bubbles) {
        const wob = Math.sin(t * 0.1 + b.phase) * 0.06 + b.squish * 0.5;
        g.save();
        g.translate(b.x, b.y);
        g.scale(1 + wob, 1 - wob);
        const grad = g.createRadialGradient(0, 0, b.r * 0.55, 0, 0, b.r);
        grad.addColorStop(0, 'rgba(255,255,255,0.55)');
        grad.addColorStop(0.8, `hsla(${b.hue + t}, 80%, 75%, 0.35)`);
        grad.addColorStop(0.95, `hsla(${b.hue + t + 90}, 85%, 62%, 0.7)`);
        grad.addColorStop(1, 'rgba(120,160,210,0.9)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.ellipse(-b.r * 0.4, -b.r * 0.45, b.r * 0.18, b.r * 0.1, -0.6, 0, TAU); g.fill();
        fitText(g, b.word, 0, b.r * 0.05, b.r * 1.55, b.r * 0.5, '#2b2b2b');
        g.restore();
      }
      for (const r of rings) {
        g.strokeStyle = `hsla(${r.hue}, 70%, 60%, ${r.life / 18})`;
        g.lineWidth = 4;
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
      }
      g.fillStyle = '#8cc4f0';
      for (const d of drops) {
        g.globalAlpha = d.life / 30;
        g.beginPath(); g.arc(d.x, d.y, 4 * unit, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    },
    down(x, y) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (Math.hypot(x - b.x, y - b.y) > b.r * 1.15) continue;
        if (!b.ok) {
          // まちがいの玉は割れない: ポヨンと弾く（13_シャボン玉 の「まだ割れない」動き）
          b.squishV += 0.35;
          const a = Math.atan2(b.y - y, b.x - x);
          b.vx += Math.cos(a) * 2.5;
          b.y += Math.sin(a) * 6;
          sfx('boing', 0.15, 340 + b.r);
          return;
        }
        bubbles.splice(i, 1);
        rings.push({ x: b.x, y: b.y, r: b.r * 0.8, life: 18, hue: b.hue });
        for (let k = 0; k < 9; k++) {
          const a = Math.random() * TAU;
          drops.push({ x: b.x + Math.cos(a) * b.r * 0.6, y: b.y + Math.sin(a) * b.r * 0.6, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 30 });
        }
        sfx('pop', 0.35);
        count++;
        onProgress(count);
        return;
      }
    },
    move() {},
    up() {},
  };
}

// ------------------------------------------------------------ エアホッケー（絵のパックを正解のゴールへ）

function hockeyGame(q: MiniQuestion, onProgress: (n: number) => void): Game {
  // 17_エアホッケー Lv3（大理石）。子ども向けにパックを大きく
  const C = { friction: 0.988, wallBounce: 0.92, stopSpeed: 0.04 };
  let W = 0;
  let H = 0;
  let R = 50;
  let done = false;
  let t = 0;
  const puck = { x: 0, y: 0, vx: 0, vy: 0, rot: 0 };
  let held = false;
  let hist: { x: number; y: number }[] = [];
  let img: HTMLImageElement | null = null;
  void q.pictureUrl().then((url) => {
    if (!url) return;
    const im = new Image();
    im.onload = () => { img = im; };
    im.src = url;
  });
  const labels = shuffle([q.answer, ...q.others.slice(0, 2)]);
  interface Goal { x: number; w: number; word: string; ok: boolean; flash: number }
  let goals: Goal[] = [];
  const goalH = () => H * 0.2;

  const reset = () => {
    puck.x = W / 2; puck.y = H - R * 1.6; puck.vx = puck.vy = 0;
  };

  return {
    resize(w, h) {
      W = w; H = h;
      R = Math.min(w, h) * 0.11;
      const gap = W * 0.03;
      const gw = (W - gap * (labels.length + 1)) / labels.length;
      goals = labels.map((word, i) => ({ x: gap + i * (gw + gap), w: gw, word, ok: word === q.answer, flash: 0 }));
      if (!puck.x) reset();
    },
    step() {
      t++;
      for (const g of goals) g.flash *= 0.9;
      if (done) {
        // 正解のゴールに吸い込まれる
        const g = goals.find((x) => x.ok)!;
        puck.x += (g.x + g.w / 2 - puck.x) * 0.15;
        puck.y += (goalH() / 2 - puck.y) * 0.15;
        puck.rot += 0.1;
        return;
      }
      if (held) return;
      puck.x += puck.vx; puck.y += puck.vy;
      puck.vx *= C.friction; puck.vy *= C.friction;
      if (Math.hypot(puck.vx, puck.vy) < C.stopSpeed) puck.vx = puck.vy = 0;
      const hit = (sp: number) => { if (sp > 1.5) sfx('click', Math.min(sp / 20, 1), 700, 70); };
      if (puck.x < R) { puck.x = R; hit(Math.abs(puck.vx)); puck.vx *= -C.wallBounce; }
      if (puck.x > W - R) { puck.x = W - R; hit(Math.abs(puck.vx)); puck.vx *= -C.wallBounce; }
      if (puck.y > H - R) { puck.y = H - R; hit(Math.abs(puck.vy)); puck.vy *= -C.wallBounce; }
      // 上の段（ゴール）に届いたか
      if (puck.y - R < goalH()) {
        const g = goals.find((x) => puck.x >= x.x && puck.x <= x.x + x.w);
        if (g?.ok) {
          done = true;
          sfx('pop', 0.5);
          onProgress(1);
        } else {
          // まちがいのゴール（またはすき間）: 跳ね返るだけ
          if (g) { g.flash = 1; sfx('boing', 0.3, 260); } else hit(Math.abs(puck.vy));
          puck.y = goalH() + R;
          puck.vy = Math.abs(puck.vy) * C.wallBounce + 1;
        }
      }
    },
    draw(g) {
      // ゴール
      for (const z of goals) {
        g.fillStyle = z.flash > 0.05 ? `rgba(255,190,120,${0.4 + z.flash * 0.4})` : 'rgba(255,255,255,0.85)';
        g.strokeStyle = '#9fb7d6';
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(z.x, 8, z.w, goalH() - 8, 18);
        g.fill(); g.stroke();
        fitText(g, z.word, z.x + z.w / 2, goalH() / 2 + 4, z.w * 0.85, goalH() * 0.42, '#2b2b2b');
      }
      // 中央線と、はじく場所の目印
      g.strokeStyle = 'rgba(120,150,190,0.35)';
      g.lineWidth = 3;
      g.setLineDash([14, 12]);
      g.beginPath(); g.moveTo(0, H * 0.55); g.lineTo(W, H * 0.55); g.stroke();
      g.setLineDash([]);
      // パック（次の問題の絵）
      g.save();
      g.translate(puck.x, puck.y);
      g.rotate(puck.rot);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.arc(4, 6, R, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.clip();
      if (img) g.drawImage(img, -R * 0.9, -R * 0.9, R * 1.8, R * 1.8);
      else {
        g.font = `${R}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(q.emoji, 0, 4);
      }
      g.restore();
      g.strokeStyle = '#ff9f1c';
      g.lineWidth = Math.max(4, R * 0.1);
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      g.restore();
      // はじき方のヒント（最初だけ）
      if (!done && !held && t < 240 && puck.vx === 0 && puck.vy === 0) {
        g.globalAlpha = 0.5 + Math.sin(t * 0.1) * 0.3;
        g.fillStyle = '#ff9f1c';
        const ax = puck.x, ay = puck.y - R * 1.4;
        g.beginPath(); g.moveTo(ax, ay - 26); g.lineTo(ax - 20, ay); g.lineTo(ax + 20, ay); g.fill();
        g.globalAlpha = 1;
      }
    },
    down(x, y) {
      if (done) return;
      if (Math.hypot(x - puck.x, y - puck.y) < R * 1.6) {
        held = true;
        hist = [{ x, y }];
        puck.vx = puck.vy = 0;
      }
    },
    move(x, y) {
      if (!held) return;
      // 持っている間は下半分だけ動かせる（ゴールに手で置けないように）
      puck.x = Math.max(R, Math.min(W - R, x));
      puck.y = Math.max(H * 0.55, Math.min(H - R, y));
      hist.push({ x: puck.x, y: puck.y });
      if (hist.length > 5) hist.shift();
    },
    up() {
      if (!held) return;
      held = false;
      if (hist.length >= 2) {
        let vx = 0, vy = 0;
        for (let i = 1; i < hist.length; i++) { vx += hist[i].x - hist[i - 1].x; vy += hist[i].y - hist[i - 1].y; }
        // 子どもの弱いはじきでも届くよう、少し強める
        puck.vx = (vx / (hist.length - 1)) * 1.4;
        puck.vy = (vy / (hist.length - 1)) * 1.4;
      }
    },
  };
}

// ------------------------------------------------------------ 錠前（文字のダイヤルをそろえる）

const DIAL_CHARS = [...SEION, ...DAKUON].flat().filter((c): c is string => !!c);
const CLICK_HZ = 1400; // 10_ラチェットダイヤル Lv3 の音

function lockGame(stage: HTMLElement, q: MiniQuestion, onProgress: (n: number) => void): () => void {
  stage.classList.add('lock-stage');
  const pic = el('div', 'mini-pic lock-pic');
  pic.append(q.picture());

  const lock = el('div', 'lock');
  const shackle = el('div', 'lock-shackle');
  const body = el('div', 'lock-body');
  const sample = el('div', 'lock-sample', q.showSample ? q.answer : '');
  const wheelsRow = el('div', 'lock-wheels');
  body.append(sample, wheelsRow);
  lock.append(shackle, body);
  stage.append(pic, lock);

  let opened = false;
  const wheels = q.chars.map((ch, i) => {
    const wheel = el('div', 'dial');
    if (q.fixed.has(i)) {
      // 文の「が」: 最初からそろっていて回らない
      wheel.classList.add('fixed', 'ok');
      wheel.append(el('div', 'dial-face', ch));
      wheelsRow.append(wheel);
      return { ok: () => true };
    }
    // 正解＋ほかの字3つ。最初は正解以外から始める
    const pool = shuffle(DIAL_CHARS.map(q.toScript).filter((c) => c !== ch)).slice(0, 3);
    const options = shuffle([ch, ...pool]);
    let idx = (options.indexOf(ch) + 1 + Math.floor(Math.random() * (options.length - 1))) % options.length;
    const face = el('div', 'dial-face');
    const up = el('button', 'dial-btn', '▲');
    const down = el('button', 'dial-btn', '▼');
    const paint = () => {
      face.textContent = options[idx];
      wheel.classList.toggle('ok', options[idx] === ch);
    };
    const turn = (d: number) => {
      if (opened) return;
      idx = (idx + d + options.length) % options.length;
      face.classList.remove('tick-up', 'tick-down');
      void face.offsetWidth;
      face.classList.add(d < 0 ? 'tick-up' : 'tick-down');
      sfx('click', 0.5, CLICK_HZ);
      paint();
      check();
    };
    up.addEventListener('click', () => turn(-1));
    down.addEventListener('click', () => turn(1));
    // 上下になぞっても回る（30px ごとに1カチ）
    let startY = 0;
    let dragging = false;
    face.addEventListener('pointerdown', (e) => { dragging = true; startY = e.clientY; face.setPointerCapture(e.pointerId); e.preventDefault(); });
    face.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) >= 30) { turn(dy > 0 ? 1 : -1); startY = e.clientY; }
    });
    face.addEventListener('pointerup', () => { dragging = false; });
    face.addEventListener('pointercancel', () => { dragging = false; });
    wheel.append(up, face, down);
    wheelsRow.append(wheel);
    paint();
    return { ok: () => options[idx] === ch };
  });

  const check = () => {
    if (opened || !wheels.every((w) => w.ok())) return;
    opened = true;
    lock.classList.add('open');
    sfx('click', 0.9, 2000);
    setTimeout(() => sfx('boing', 0.4, 520), 120);
    setTimeout(() => onProgress(1), 500);
  };

  return () => {
    opened = true;
  };
}
