import type { Script } from './settings';

/** ひらがな → カタカナ（ー などひらがな以外はそのまま） */
export function toKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function inScript(s: string, script: Script): string {
  return script === 'kata' ? toKata(s) : s;
}

/** 1文字ずつに分ける（ゃ・ー も1文字＝1キー） */
export function chars(s: string): string[] {
  return Array.from(s);
}

// 50音キーボードの配列。列＝行（あ行・か行…）、上から あいうえお の段。
// null は空きマス。
type Col = (string | null)[];

export const SEION: Col[] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, 'を', null, 'ん'],
];

export const DAKUON: Col[] = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];

export const SMALL: Col[] = [['ゃ', 'ゅ', 'ょ', 'っ', 'ー']];
