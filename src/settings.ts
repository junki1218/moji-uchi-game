// 設定は端末内（localStorage）に保存する。読めない環境でも既定値で動く。

export type Script = 'hira' | 'kata';
/** trace＝なぞり（2026-10-17）。てがきと同じ書き方で、マスの中にうすい見本の字があり、それをなぞる */
export type InputMode = 'keyboard' | 'handwriting' | 'trace';
/** ① みてうつ ② きいてうつ ③ えだけ */
export type PromptMode = 'look' | 'listen' | 'picture';
export type AColumn = 'left' | 'right';
export type Volume = 'low' | 'mid' | 'high';
/** グミ・羽根は 2026-10-04 に廃止し、錠前・エアホッケーに置き換え */
export type MinigameKind = 'bubble' | 'lock' | 'hockey';
/** キーボードに出す字の数（2026-10-17）。all＝50音ぜんぶ、k25／k10＝答えの字＋ほかの字で25／10個、answer＝答えの字だけ */
export type KeySet = 'all' | 'k25' | 'k10' | 'answer';

export const VOLUME_LEVEL: Record<Volume, number> = { low: 0.3, mid: 0.6, high: 0.9 };

export interface Settings {
  script: Script;
  input: InputMode;
  prompt: PromptMode;
  aColumn: AColumn;
  sound: boolean;
  volume: Volume;
  /** 問題の前のミニゲーム */
  minigame: boolean;
  minigameKinds: MinigameKind[];
  /** 文の「が」を子どもが打つ・書くか（false＝最初から入れておく） */
  particleInput: boolean;
  /** キーボードの字の数。変えるまで同じ難しさが続く */
  keySet: KeySet;
  pin: string;
}

export const DEFAULT_PIN = '1094';
/** 前の版の初期値。保存されていたら新しい初期値に置き換える（2026-10-04） */
const OLD_DEFAULT_PIN = '1024';

const DEFAULTS: Settings = {
  script: 'hira',
  input: 'keyboard',
  prompt: 'look',
  aColumn: 'right', // 教室の50音表と同じ（右上が「あ」）
  sound: true,
  volume: 'mid',
  minigame: true,
  minigameKinds: ['bubble', 'lock', 'hockey'],
  particleInput: false,
  keySet: 'all',
  pin: DEFAULT_PIN,
};

const KEY = 'moji-uchi-game/settings';

const MINIGAME_KINDS: MinigameKind[] = ['bubble', 'lock', 'hockey'];
const KEY_SETS: KeySet[] = ['all', 'k25', 'k10', 'answer'];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s: Settings = { ...DEFAULTS, ...JSON.parse(raw) };
      // 前の版のミニゲーム（グミ・羽根）は取り除く。1つも残らなければ全種類
      const kinds = (s.minigameKinds ?? []).filter((k) => MINIGAME_KINDS.includes(k));
      s.minigameKinds = kinds.length ? kinds : [...MINIGAME_KINDS];
      if (s.pin === OLD_DEFAULT_PIN) s.pin = DEFAULT_PIN;
      if (!KEY_SETS.includes(s.keySet)) s.keySet = 'all';
      return s;
    }
  } catch {
    // プライベートブラウズ等で読めないときは既定値
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 保存できなくてもその場の設定では動く
  }
}
