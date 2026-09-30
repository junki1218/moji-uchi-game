// 設定は端末内（localStorage）に保存する。読めない環境でも既定値で動く。

export type Script = 'hira' | 'kata';
export type InputMode = 'keyboard' | 'handwriting';
/** ① みてうつ ② きいてうつ ③ えだけ */
export type PromptMode = 'look' | 'listen' | 'picture';
export type AColumn = 'left' | 'right';
export type Volume = 'low' | 'mid' | 'high';

export const VOLUME_LEVEL: Record<Volume, number> = { low: 0.3, mid: 0.6, high: 0.9 };

export interface Settings {
  script: Script;
  input: InputMode;
  prompt: PromptMode;
  aColumn: AColumn;
  sound: boolean;
  volume: Volume;
  pin: string;
}

export const DEFAULT_PIN = '1024';

const DEFAULTS: Settings = {
  script: 'hira',
  input: 'keyboard',
  prompt: 'look',
  aColumn: 'right', // 教室の50音表と同じ（右上が「あ」）
  sound: true,
  volume: 'mid',
  pin: DEFAULT_PIN,
};

const KEY = 'moji-uchi-game/settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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
