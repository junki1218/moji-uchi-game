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
