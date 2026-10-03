// BGM の再生。Web Audio のループ機能で継ぎ目なく繰り返す（<audio loop> は iOS で一瞬途切れる）。
// iOS はユーザーのタップを経ないと音が出ないので、最初のタップで unlockAudio() する。
// 音源は tools/make_loop.py が作る public/audio/<name>.m4a と <name>.json（{loopEnd}）。

export type BgmName = 'bgm1_start' | 'bgm2_question';

const FADE_IN = 0.8;
const FADE_OUT = 0.5;
const DUCK_LEVEL = 0.35;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.6;

interface Playing {
  name: BgmName;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
let playing: Playing | null = null;
let wanted: BgmName | null = null;
let ducked = false; // 曲の読み込み前に読み上げが始まっても、鳴り始めから小さくするため
const buffers = new Map<BgmName, Promise<{ buf: AudioBuffer; loopEnd: number }>>();

function context(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = enabled ? volume : 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

function load(name: BgmName) {
  let p = buffers.get(name);
  if (!p) {
    const base = `${import.meta.env.BASE_URL}audio/${name}`;
    p = Promise.all([
      fetch(`${base}.m4a`).then((r) => r.arrayBuffer()).then((a) => context().decodeAudioData(a)),
      fetch(`${base}.json`).then((r) => r.json() as Promise<{ loopEnd: number }>),
    ]).then(([buf, meta]) => ({ buf, loopEnd: Math.min(meta.loopEnd, buf.duration) }));
    buffers.set(name, p);
  }
  return p;
}

/** 最初のタップで呼ぶ。止まっていた AudioContext を動かし、待っていた BGM を鳴らす */
export function unlockAudio(): void {
  const c = context();
  // iPad のマナーモード（消音スイッチ）中でも BGM と読み上げを鳴らす（Safari 16.4+）
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  void c.resume().then(() => wanted && start(wanted));
}

async function start(name: BgmName): Promise<void> {
  const c = context();
  if (c.state !== 'running' || playing?.name === name) return;
  const { buf, loopEnd } = await load(name);
  if (wanted !== name || playing?.name === name) return;
  fadeOut();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = loopEnd;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(ducked ? DUCK_LEVEL : 1, c.currentTime + FADE_IN);
  src.connect(gain).connect(master!);
  src.start();
  playing = { name, src, gain };
}

function fadeOut(): void {
  if (!playing || !ctx) return;
  const { src, gain } = playing;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
  src.stop(now + FADE_OUT + 0.05);
  playing = null;
}

/** 画面に入るたびに呼ぶ。同じ曲なら流しっぱなし（画面をまたいでも途切れない） */
export function playBgm(name: BgmName): void {
  wanted = name;
  if (ctx) void start(name);
}

export function stopBgm(): void {
  wanted = null;
  fadeOut();
}

/** 読み上げ中など、一時的に BGM を小さくする */
export function duckBgm(on: boolean): void {
  ducked = on;
  if (!playing || !ctx) return;
  const now = ctx.currentTime;
  playing.gain.gain.cancelScheduledValues(now);
  playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
  playing.gain.gain.linearRampToValueAtTime(on ? DUCK_LEVEL : 1, now + 0.25);
}

export function setSound(on: boolean, vol: number): void {
  enabled = on;
  volume = vol;
  if (master && ctx) master.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.1);
}

// ------------------------------------------------------------ ジングル
// 開発完了/ZukeiCollectApp/script.js の correctSound() / fanfaleSound() を流用（音程・長さ・音色は同じ）。
// 移植にあたり、setTimeout ではなく AudioContext の時刻で並べ、BGM と同じ音量設定（master）を通す。

export type JingleName = 'correct' | 'finish';

const JINGLES: Record<JingleName, { freqs: number[]; step: number; dur: number[] }> = {
  // correctSound(): 880Hz 0.1秒 → 0.1秒後に 1760Hz 0.4秒
  correct: { freqs: [880, 1760], step: 0.1, dur: [0.1, 0.4] },
  // fanfaleSound(): 8音を 0.15秒ずつずらし、各 0.6秒
  finish: { freqs: [523, 659, 783, 1046, 783, 1046, 1318, 1567], step: 0.15, dur: [0.6] },
};

export function playJingle(name: JingleName): void {
  if (!ctx || ctx.state !== 'running' || !master) return;
  const { freqs, step, dur } = JINGLES[name];
  const t0 = ctx.currentTime + 0.02;
  freqs.forEach((f, i) => {
    const d = dur[i] ?? dur[dur.length - 1];
    const t = t0 + i * step;
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + d);
    osc.connect(g).connect(master!);
    osc.start(t);
    osc.stop(t + d);
  });
}

// ------------------------------------------------------------ 効果音（ミニゲーム用）
// 開発材料【質感】/demos/fx.js の音を移植（その場で合成。音声ファイル不要）。
// 強さ i は 0..1 に正規化した物理量（大きさ・速さ）。master を通すので音量設定が効く。

export type SfxName = 'pop' | 'boing' | 'squelch' | 'whoosh' | 'click';

let noiseBuf: AudioBuffer | null = null;
const c01 = (v: number) => Math.max(0, Math.min(1, v || 0));

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const SFX: Record<SfxName, (c: AudioContext, out: AudioNode, i: number, opt?: number) => void> = {
  // プチッ/パン（破裂）: 強度→音量・低音成分・余韻
  pop(c, out, i) {
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = noise(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(1900 - 1300 * i, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.08 + 0.15 * i);
    const g = c.createGain();
    g.gain.setValueAtTime(0.25 + 0.5 * i, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1 + 0.25 * i);
    s.connect(bp).connect(g).connect(out);
    s.start(t); s.stop(t + 0.45);
    if (i > 0.5) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      og.gain.setValueAtTime(0.4 * i, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(og).connect(out); o.start(t); o.stop(t + 0.3);
    }
  },
  // ボヨン（弾み）: base＝基準周波数
  boing(c, out, i, base) {
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    const b = base || 140 + 160 * i;
    o.frequency.setValueAtTime(b * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(b, t + 0.07);
    g.gain.setValueAtTime(0.1 + 0.2 * i, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.45);
  },
  // ニュチャ（ぷにぷに・粘り）
  squelch(c, out, i) {
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = noise(c); s.playbackRate.value = 0.4;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(0.05 + 0.15 * i, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(lp).connect(g).connect(out);
    s.start(t); s.stop(t + 0.22);
  },
  // フワッ（風）
  whoosh(c, out, i) {
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = noise(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(300 + 200 * i, t);
    bp.frequency.linearRampToValueAtTime(700 + 500 * i, t + 0.12);
    bp.frequency.linearRampToValueAtTime(250, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 + 0.14 * i, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    s.connect(bp).connect(g).connect(out);
    s.start(t); s.stop(t + 0.35);
  },
  // カチッ（ミシミシ）
  click(c, out, i, freq) {
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.value = freq || 800 + 1600 * i;
    g.gain.setValueAtTime(0.05 + 0.12 * i, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015 + 0.02 * i);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.05);
  },
};

const lastPlayed: Record<string, number> = {};

/** 効果音。throttleMs を渡すと、その間隔より短い連打は鳴らさない（なぞり等の連続イベント用） */
export function sfx(name: SfxName, intensity: number, opt?: number, throttleMs = 0): void {
  if (!ctx || ctx.state !== 'running' || !master) return;
  if (throttleMs) {
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < throttleMs) return;
    lastPlayed[name] = now;
  }
  try {
    SFX[name](ctx, master, c01(intensity), opt);
  } catch {
    // 音が出せなくても遊びは続ける
  }
}
