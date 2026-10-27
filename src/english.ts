// 英語版の問題（2026-10-27）。「もの」「うごき」の絵をそのまま使い、7文字までの短い英単語にした。
// 日本語（ひらがな）は同じ絵の日本語の問題からとる。カタカナは読み方の目安。
// 「ぶん」は英会話に親しめる形を後日考える（それまで英語版には出さない）

import { BUILTIN_QUESTIONS, type Category, type Question } from './questions';

/** 英語版で出すカテゴリ */
export const EN_CATEGORIES: Category[] = ['mono', 'ugoki'];

/** [日本語の問題の id（＝絵）, 英単語, カタカナ] */
const ROWS: [string, string, string][] = [
  ['mono_01', 'apple', 'アップル'],
  ['mono_02', 'dog', 'ドッグ'],
  ['mono_03', 'cat', 'キャット'],
  ['mono_04', 'car', 'カー'],
  ['mono_05', 'train', 'トレイン'],
  ['mono_06', 'bus', 'バス'],
  ['mono_10', 'plane', 'プレイン'],
  ['mono_11', 'ship', 'シップ'],
  ['mono_12', 'banana', 'バナナ'],
  ['mono_14', 'clock', 'クロック'],
  ['mono_16', 'shoes', 'シューズ'],
  ['mono_17', 'cap', 'キャップ'],
  ['mono_18', 'fish', 'フィッシュ'],
  ['mono_20', 'cake', 'ケーキ'],
  ['ugoki_01', 'run', 'ラン'],
  ['ugoki_02', 'walk', 'ウォーク'],
  ['ugoki_03', 'eat', 'イート'],
  ['ugoki_04', 'drink', 'ドリンク'],
  ['ugoki_05', 'sleep', 'スリープ'],
  ['ugoki_07', 'swim', 'スイム'],
  ['ugoki_08', 'throw', 'スロー'],
  ['ugoki_09', 'kick', 'キック'],
  ['ugoki_10', 'draw', 'ドロー'],
  ['ugoki_11', 'read', 'リード'],
  ['ugoki_12', 'wash', 'ウォッシュ'],
  ['ugoki_13', 'sit', 'シット'],
  ['ugoki_14', 'stand', 'スタンド'],
  ['ugoki_15', 'sing', 'シング'],
  ['ugoki_16', 'dance', 'ダンス'],
  ['ugoki_17', 'jump', 'ジャンプ'],
  ['ugoki_18', 'brush', 'ブラッシュ'],
  ['ugoki_19', 'climb', 'クライム'],
];

export const EN_QUESTIONS: Question[] = ROWS.flatMap(([img, word, kana]) => {
  const base = BUILTIN_QUESTIONS.find((q) => q.id === img);
  if (!base) return [];
  return [{
    id: `en_${img}`,
    type: 'word' as const,
    category: base.category,
    hira: word,
    emoji: base.emoji,
    builtin: true,
    lang: 'en' as const,
    img,
    ja: base.hira,
    kana,
  }];
});

export function enQuestions(cat?: Category): Question[] {
  return cat ? EN_QUESTIONS.filter((q) => q.category === cat) : EN_QUESTIONS;
}

/** アルファベット表（ABC順、7字ずつ4段） */
export const ALPHABET_ROWS: string[][] = ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz'].map((r) => Array.from(r));
