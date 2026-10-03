// 問題の前に遊ぶミニゲーム。開発材料【質感】の demos を移植し、子ども向けに大きく・短く・ゴールつきにした。
//   bubble  … 13_シャボン玉（タップで割る。Lv4: 1回で割れる）      ゴール: 3つ割る
//   gummy   … 01_グミ質感（タップでプチッ、長押しで膨らんで弾ける） ゴール: 3回弾けさせる
//   feather … 26_羽根の舞い（なぞった気流で舞い上がる。Lv4 綿毛）   ゴール: 3枚を雲まで飛ばす
// 物理の数値は docs/06_5段階レベル対応表.md の値を基準にしている。

import { sfx } from './audio';

import type { MinigameKind } from './settings';

export type { MinigameKind };

export const MINIGAMES: { id: MinigameKind; label: string; instruction: string }[] = [
  { id: 'bubble', label: 'シャボン玉', instruction: 'しゃぼんだまを みっつ わろう' },
  { id: 'gummy', label: 'グミ', instruction: 'ぐみを タッチして みっつ はじけさせよう' },
  { id: 'feather', label: '羽根', instruction: 'ゆびで なぞって はねを くもまで とばそう' },
];

export const GOAL = 3;

const TAU = Math.PI * 2;

/** ミニゲーム1回分。canvas の大きさは呼び出し側が決め、resize() で知らせる */
interface Game {
  resize(w: number, h: number): void;
  step(): void; // 1フレーム進める
  draw(g: CanvasRenderingContext2D): void;
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(): void;
}

/**
 * canvas にミニゲームを走らせる。ゴールの数に届いたら onProgress(GOAL) を呼んで止まる。
 * 戻り値は後片付け（画面を離れるときに呼ぶ）。
 */
export function runMinigame(
  kind: MinigameKind,
  canvas: HTMLCanvasElement,
  onProgress: (count: number) => void,
): () => void {
  let count = 0;
  const score = () => {
    count++;
    onProgress(count);
  };
  const game = kind === 'bubble' ? bubbleGame(score) : kind === 'gummy' ? gummyGame(score) : featherGame(score);
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

// ------------------------------------------------------------ シャボン玉

function bubbleGame(score: () => void): Game {
  let W = 0;
  let H = 0;
  let t = 0;
  let unit = 1; // 画面の大きさに合わせた倍率
  interface Bubble { x: number; y: number; r: number; vx: number; hue: number; phase: number; squish: number; squishV: number }
  let bubbles: Bubble[] = [];
  let rings: { x: number; y: number; r: number; life: number; hue: number }[] = [];
  let drops: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  const spawn = () => {
    const r = (55 + Math.random() * 30) * unit;
    bubbles.push({
      x: r + Math.random() * (W - 2 * r),
      y: H + r,
      r,
      vx: (Math.random() - 0.5) * 0.5,
      hue: Math.random() * 360,
      phase: Math.random() * TAU,
      squish: 0,
      squishV: 0,
    });
  };

  return {
    resize(w, h) {
      W = w;
      H = h;
      unit = Math.min(w, h) / 600;
      if (!bubbles.length) for (let k = 0; k < 3; k++) { spawn(); bubbles[k].y = H * (0.45 + k * 0.18); }
    },
    step() {
      t++;
      // 画面に玉が少なくならないよう補充（すぐ割れるので、待たせない）
      if (t % 45 === 0 && bubbles.length < 6) spawn();
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= (0.9 + Math.sin(b.phase + t * 0.02) * 0.2) * unit;
        b.x += b.vx + Math.sin(b.phase + t * 0.017) * 0.4;
        b.vx *= 0.98;
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
        const wob = Math.sin(t * 0.1 + b.phase) * 0.1 + b.squish * 0.5;
        g.save();
        g.translate(b.x, b.y);
        g.scale(1 + wob, 1 - wob);
        const grad = g.createRadialGradient(0, 0, b.r * 0.55, 0, 0, b.r);
        grad.addColorStop(0, 'rgba(255,255,255,0.15)');
        grad.addColorStop(0.8, `hsla(${b.hue + t}, 80%, 72%, 0.35)`);
        grad.addColorStop(0.95, `hsla(${b.hue + t + 90}, 85%, 62%, 0.7)`);
        grad.addColorStop(1, 'rgba(120,160,210,0.9)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.ellipse(-b.r * 0.35, -b.r * 0.4, b.r * 0.2, b.r * 0.11, -0.6, 0, TAU); g.fill();
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
        if (Math.hypot(x - b.x, y - b.y) < b.r * 1.3) {
          bubbles.splice(i, 1);
          rings.push({ x: b.x, y: b.y, r: b.r * 0.8, life: 18, hue: b.hue });
          for (let k = 0; k < 9; k++) {
            const a = Math.random() * TAU;
            drops.push({ x: b.x + Math.cos(a) * b.r * 0.6, y: b.y + Math.sin(a) * b.r * 0.6, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 30 });
          }
          sfx('pop', 0.15 + b.r / unit / 160);
          score();
          return;
        }
      }
    },
    move() {},
    up() {},
  };
}

// ------------------------------------------------------------ グミ

function gummyGame(score: () => void): Game {
  // 01_グミ質感 の Lv3（標準グミ）。長押し破裂は子ども向けに 2000ms → 1200ms
  const C = {
    vertexCount: 20, stiffness: 0.04, damping: 0.065, spread: 0.2, pressure: 2.0,
    comStiffFactor: 1.6, comDampFactor: 0.7, comMaxOffset: 26,
    tapMaxMs: 300, pokeImpulse: 7, pokeRange: 1.6, fingerR: 46,
    holdBurstMs: 1200, maxInflate: 1.8, particleGravity: 0.22, particleDrag: 0.985, particleLife: 42, respawnMs: 600,
  };
  let W = 0;
  let H = 0;
  let R = 90; // 基本半径（画面に合わせる）
  const blob = { x: 0, y: 0, cx: 0, cy: 0, cvx: 0, cvy: 0, alive: true, inflate: 1, verts: [] as { ang: number; r: number; v: number }[] };
  let particles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
  let shake = 0;
  const pointer = { down: false, x: 0, y: 0, downTime: 0, downX: 0, downY: 0, moved: 0 };
  let restArea = 0;

  const init = () => {
    blob.x = W / 2; blob.y = H / 2; blob.alive = true; blob.inflate = 1;
    blob.cx = blob.cy = blob.cvx = blob.cvy = 0;
    blob.verts = Array.from({ length: C.vertexCount }, (_, i) => ({ ang: (i / C.vertexCount) * TAU, r: R, v: 0 }));
    restArea = Math.sin(TAU / C.vertexCount) * 0.5 * C.vertexCount * R * R;
  };
  const center = () => ({ x: blob.x + blob.cx, y: blob.y + blob.cy });
  const inside = (px: number, py: number) => {
    const c = center();
    return Math.hypot(px - c.x, py - c.y) < R * blob.inflate * 1.2;
  };
  const poke = (px: number, py: number, strength: number) => {
    const c = center();
    const ang = Math.atan2(py - c.y, px - c.x);
    for (const v of blob.verts) {
      let d = Math.abs((((v.ang - ang) % TAU) + TAU) % TAU);
      if (d > Math.PI) d = TAU - d;
      if (d < C.pokeRange) v.v -= strength * Math.exp(-(d * d) / 0.3);
    }
    const rigid = strength * (0.35 + C.stiffness * 5);
    blob.cvx -= Math.cos(ang) * rigid * 0.35;
    blob.cvy -= Math.sin(ang) * rigid * 0.35;
  };
  const burst = (n: number, power: number) => {
    const c = center();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (2 + Math.random() * 5) * power;
      particles.push({
        x: c.x + Math.cos(a) * R * blob.inflate * 0.7, y: c.y + Math.sin(a) * R * blob.inflate * 0.7,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: C.particleLife, size: (3 + Math.random() * 6) * (R / 90),
      });
    }
  };
  const pop = (big: boolean) => {
    if (!blob.alive) return;
    blob.alive = false;
    burst(big ? 48 : 18, big ? 2.2 : 1.2);
    sfx('pop', big ? Math.min(blob.inflate / C.maxInflate, 1) : 0.35);
    if (big) shake = 7;
    score();
    setTimeout(() => { init(); blob.inflate = 0.1; }, C.respawnMs);
  };
  const area = () => {
    const vs = blob.verts, n = vs.length;
    let a = 0;
    for (let i = 0; i < n; i++) a += vs[i].r * vs[(i + 1) % n].r;
    return a * Math.sin(TAU / n) * 0.5;
  };

  return {
    resize(w, h) {
      W = w; H = h;
      R = Math.min(w, h) * 0.24;
      init();
    },
    step() {
      if (pointer.down && blob.alive && inside(pointer.downX, pointer.downY)) {
        const held = performance.now() - pointer.downTime;
        if (held > C.tapMaxMs) {
          const t = Math.min((held - C.tapMaxMs) / C.holdBurstMs, 1);
          blob.inflate = 1 + (C.maxInflate - 1) * (1 - (1 - t) * (1 - t));
          if (t > 0.6) {
            poke(pointer.x, pointer.y, Math.random() * 1.5);
            sfx('click', t * 0.3, 200, 200);
          }
          if (t >= 1) pop(true);
        }
      }
      if (pointer.down && blob.alive) {
        const c = center();
        for (const v of blob.verts) {
          const vx = c.x + Math.cos(v.ang) * v.r * blob.inflate;
          const vy = c.y + Math.sin(v.ang) * v.r * blob.inflate;
          const d = Math.hypot(vx - pointer.x, vy - pointer.y);
          if (d < C.fingerR) v.v -= ((C.fingerR - d) * 0.11) / Math.max(C.stiffness * 10, 0.4);
        }
      }
      if (!pointer.down && blob.alive && blob.inflate > 1) blob.inflate += (1 - blob.inflate) * 0.15;
      if (blob.alive && blob.inflate < 1) blob.inflate += (1 - blob.inflate) * 0.1;

      const vs = blob.verts, n = vs.length;
      const pressureForce = C.pressure * ((restArea - area()) / restArea);
      for (const v of vs) v.v += -C.stiffness * (v.r - R) - C.damping * v.v + pressureForce;
      for (let i = 0; i < n; i++) vs[i].v += ((vs[(i - 1 + n) % n].r + vs[(i + 1) % n].r) / 2 - vs[i].r) * C.spread;
      for (const v of vs) v.r += v.v;

      const kC = Math.min(C.stiffness * C.comStiffFactor, 0.3);
      const dC = C.damping * C.comDampFactor;
      blob.cvx += -kC * blob.cx - dC * blob.cvx;
      blob.cvy += -kC * blob.cy - dC * blob.cvy;
      blob.cx = Math.max(-C.comMaxOffset, Math.min(C.comMaxOffset, blob.cx + blob.cvx));
      blob.cy = Math.max(-C.comMaxOffset, Math.min(C.comMaxOffset, blob.cy + blob.cvy));

      particles = particles.filter((p) => p.life-- > 0);
      for (const p of particles) {
        p.vy += C.particleGravity;
        p.vx *= C.particleDrag; p.vy *= C.particleDrag;
        p.x += p.vx; p.y += p.vy;
      }
      shake *= 0.85;
    },
    draw(g) {
      g.save();
      g.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
      if (blob.alive) {
        const c = center();
        const vs = blob.verts, n = vs.length;
        const px = (i: number) => c.x + Math.cos(vs[(i + n) % n].ang) * vs[(i + n) % n].r * blob.inflate;
        const py = (i: number) => c.y + Math.sin(vs[(i + n) % n].ang) * vs[(i + n) % n].r * blob.inflate;
        g.beginPath();
        g.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
        for (let i = 1; i <= n; i++) g.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
        g.closePath();
        const strain = Math.min((blob.inflate - 1) / (C.maxInflate - 1), 1);
        const grad = g.createRadialGradient(c.x - R * 0.33, c.y - R * 0.44, 10, c.x, c.y, R * blob.inflate * 1.3);
        grad.addColorStop(0, `hsl(${350 - strain * 10}, ${70 + strain * 30}%, ${72 - strain * 15}%)`);
        grad.addColorStop(1, `hsl(${340 - strain * 10}, ${75 + strain * 25}%, ${52 - strain * 12}%)`);
        g.fillStyle = grad;
        g.fill();
        g.beginPath();
        g.ellipse(c.x - R * 0.35 * blob.inflate - blob.cvx * 2, c.y - R * 0.45 * blob.inflate - blob.cvy * 2, R * 0.22 * blob.inflate, R * 0.13 * blob.inflate, -0.5, 0, TAU);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fill();
      }
      for (const p of particles) {
        g.globalAlpha = Math.max(p.life / C.particleLife, 0);
        g.fillStyle = '#ef6a85';
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    },
    down(x, y) {
      Object.assign(pointer, { down: true, downTime: performance.now(), x, y, downX: x, downY: y, moved: 0 });
      if (blob.alive && inside(x, y)) poke(x, y, C.pokeImpulse * 0.8);
    },
    move(x, y) {
      if (!pointer.down) return;
      const sp = Math.hypot(x - pointer.x, y - pointer.y);
      pointer.moved += sp;
      pointer.x = x; pointer.y = y;
      if (blob.alive && inside(x, y)) {
        poke(x, y, Math.min(sp * 0.6, C.pokeImpulse));
        if (sp > 4) sfx('squelch', Math.min(sp / 30, 0.5), undefined, 120);
      }
    },
    up() {
      if (!pointer.down) return;
      pointer.down = false;
      const dt = performance.now() - pointer.downTime;
      // タップ（短く押して、あまり動かさない）でプチッと弾ける
      if (blob.alive && inside(pointer.downX, pointer.downY) && dt < C.tapMaxMs && pointer.moved < 20) {
        blob.inflate *= 1.12;
        setTimeout(() => pop(false), 50);
      }
    },
  };
}

// ------------------------------------------------------------ 羽根

function featherGame(score: () => void): Game {
  // 26_羽根の舞い の Lv4（綿毛）を基準に、子ども向けに 風の届く範囲と強さを大きくした
  const C = { gravity: 0.05, drag: 0.985, turb: 0.3, flutter: 0.3, blowRadius: 230, blowForce: 2.2 };
  let W = 0;
  let H = 0;
  let unit = 1;
  let t = 0;
  interface Feather { x: number; y: number; vx: number; vy: number; rot: number; vrot: number; phase: number; freq: number; color: string; done: boolean }
  let feathers: Feather[] = [];
  let sparkles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  let hist: { x: number; y: number; t: number }[] = [];
  let holding = false;
  const COLORS = ['#ff8fa3', '#ffd43b', '#74c0fc'];

  const floorY = () => H - 50 * unit;
  const goalY = () => H * 0.2;

  const blowVector = () => {
    if (hist.length < 2) return null;
    const a = hist[0], b = hist[hist.length - 1];
    const dt = Math.max(b.t - a.t, 1);
    const vx = ((b.x - a.x) / dt) * 16.6, vy = ((b.y - a.y) / dt) * 16.6;
    const speed = Math.hypot(vx, vy);
    return speed < 0.6 ? null : { x: b.x, y: b.y, vx, vy, speed };
  };

  return {
    resize(w, h) {
      W = w; H = h;
      unit = Math.min(w, h) / 600;
      if (!feathers.length) {
        feathers = COLORS.map((color, i) => ({
          x: W * (0.3 + i * 0.2), y: floorY(), vx: 0, vy: 0,
          rot: (Math.random() - 0.5) * 0.6, vrot: 0, phase: Math.random() * TAU, freq: 0.02 + Math.random() * 0.02, color, done: false,
        }));
      }
    },
    step() {
      t++;
      const blow = holding ? blowVector() : null;
      if (blow) sfx('whoosh', Math.min(blow.speed / 18, 1), undefined, 260);
      const R = C.blowRadius * unit;
      for (const p of feathers) {
        if (p.done) continue;
        p.vy += C.gravity * 0.5 * unit;
        p.vx *= C.drag; p.vy *= C.drag;
        const n = Math.sin(p.x * 0.01 + t * 0.02 + p.phase) * 0.6 + Math.sin(p.y * 0.015 - t * 0.015) * 0.4;
        p.vx += n * C.turb * 0.05;
        p.vx += Math.sin(t * p.freq + p.phase) * C.flutter * 0.06;
        if (blow) {
          const d = Math.hypot(p.x - blow.x, p.y - blow.y);
          if (d < R) {
            const k = 1 - d / R;
            p.vx += blow.vx * k * C.blowForce * 0.06;
            // どの向きになぞっても少し上へ（子どもが「下から上」を知らなくても舞い上がる）
            p.vy += blow.vy * k * C.blowForce * 0.06 - k * (0.6 + blow.speed * 0.04) * unit;
            p.vrot += (Math.random() - 0.5) * k * 0.08;
          }
        }
        p.x += p.vx; p.y += p.vy;
        p.rot += p.vrot + Math.sin(t * p.freq + p.phase) * 0.01;
        p.vrot *= 0.95;
        if (p.x < 30 * unit) { p.x = 30 * unit; p.vx = Math.abs(p.vx); }
        if (p.x > W - 30 * unit) { p.x = W - 30 * unit; p.vx = -Math.abs(p.vx); }
        if (p.y > floorY()) { p.y = floorY(); p.vy = 0; p.vx *= 0.9; }
        if (p.y < goalY()) {
          // 雲に届いた: キラキラして消える
          p.done = true;
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * TAU;
            sparkles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 32, color: p.color });
          }
          sfx('boing', 0.4, 520);
          score();
        }
      }
      sparkles = sparkles.filter((s) => s.life-- > 0);
      for (const s of sparkles) { s.x += s.vx; s.y += s.vy; s.vy += 0.05; }
    },
    draw(g) {
      // 雲（ゴール）
      const gy = goalY();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (const [dx, r] of [[-0.18, 0.07], [-0.06, 0.1], [0.07, 0.085], [0.18, 0.065]] as const) {
        g.beginPath(); g.arc(W / 2 + dx * W, gy - 10 * unit, r * Math.min(W, H) * 1.1, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(150,180,220,0.6)';
      g.setLineDash([12 * unit, 10 * unit]);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
      g.setLineDash([]);
      // 地面
      g.fillStyle = '#cfe8b8';
      g.fillRect(0, floorY() + 26 * unit, W, H);
      // 羽根
      for (const p of feathers) {
        if (p.done) continue;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        const L = 60 * unit, Wd = 22 * unit;
        g.fillStyle = p.color;
        g.beginPath(); g.ellipse(0, 0, Wd, L, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 3 * unit;
        g.beginPath(); g.moveTo(0, -L * 0.9); g.lineTo(0, L * 1.25); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 1.5 * unit;
        for (let k = -3; k <= 3; k++) {
          g.beginPath(); g.moveTo(0, k * L * 0.22); g.lineTo(Wd * 0.85, k * L * 0.22 - L * 0.12); g.stroke();
          g.beginPath(); g.moveTo(0, k * L * 0.22); g.lineTo(-Wd * 0.85, k * L * 0.22 - L * 0.12); g.stroke();
        }
        g.restore();
      }
      for (const s of sparkles) {
        g.globalAlpha = s.life / 32;
        g.fillStyle = s.color;
        g.beginPath(); g.arc(s.x, s.y, 5 * unit, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      // 指でなぞった風の見える化
      if (holding && hist.length > 1) {
        g.strokeStyle = 'rgba(120,170,230,0.35)';
        g.lineWidth = 28 * unit;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(hist[0].x, hist[0].y);
        for (const p of hist) g.lineTo(p.x, p.y);
        g.stroke();
      }
    },
    down(x, y) {
      holding = true;
      hist = [{ x, y, t: performance.now() }];
    },
    move(x, y) {
      if (!holding) return;
      hist.push({ x, y, t: performance.now() });
      if (hist.length > 5) hist.shift();
    },
    up() {
      holding = false;
      hist = [];
    },
  };
}
