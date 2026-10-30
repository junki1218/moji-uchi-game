// 英語版の問題（2026-10-27）。「もの」「うごき」の絵をそのまま使い、7文字までの短い英単語にした。
// 日本語（ひらがな）は同じ絵の日本語の問題からとる。カタカナは読み方の目安。
// 「ぶん」は英会話に親しめる形を後日考える（それまで英語版には出さない）

import { BUILTIN_QUESTIONS, type Category, type Question } from './questions';
import { customEnQuestions } from './bank';

/** 英語版のカテゴリ（えらぶ画面・設定・プリントのタブの順）。アルファベットは 2026-10-27、ようび・どうぶつは 2026-10-30 追加 */
export const EN_CATEGORY_LIST: { id: Category; label: string; emoji: string }[] = [
  { id: 'mono', label: 'もの', emoji: '🍎' },
  { id: 'doubutsu', label: 'どうぶつ', emoji: '🐘' },
  { id: 'ugoki', label: 'うごき', emoji: '🏃' },
  { id: 'alphabet', label: 'アルファベット', emoji: '🔤' },
  { id: 'youbi', label: 'ようび', emoji: '📅' },
];

/** 「もの」の絵のうち、英語では「どうぶつ」に分けるもの（2026-10-30） */
const ANIMALS = new Set(['dog', 'cat', 'fish', 'elephant', 'rabbit', 'lion', 'gorilla', 'dinosaur']);

/** [日本語の問題の id（＝絵）, 英単語, カタカナ, 日本語（文の絵を使うとき）]。文の絵は「もの」にする */
const ROWS: [string, string, string, string?][] = [
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
  // 動物（2026-10-30）: 日本語の「ぶん」「ぶん・きもち」の絵を流用。dog・cat・fish とあわせて「どうぶつ」
  ['bun_03', 'elephant', 'エレファント', 'ぞう'],
  ['bun_11', 'rabbit', 'ラビット', 'うさぎ'],
  ['bunkimochi_08', 'lion', 'ライオン', 'らいおん'],
  ['bunkimochi_14', 'gorilla', 'ゴリラ', 'ごりら'],
  ['bun_12', 'dinosaur', 'ダイナソー', 'きょうりゅう'],
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

// 曜日（2026-10-30）: 絵は素材ライブラリの Drops の曜日カード（images/youbi_mon.webp…）。
// 英語のきまりどおり頭だけ大文字（Monday）。こもじ／おおもじ の設定にかかわらずこのまま出す
const DAYS: [string, string, string, string][] = [
  ['mon', 'Monday', 'マンデー', 'げつようび'],
  ['tue', 'Tuesday', 'チューズデー', 'かようび'],
  ['wed', 'Wednesday', 'ウェンズデー', 'すいようび'],
  ['thu', 'Thursday', 'サーズデー', 'もくようび'],
  ['fri', 'Friday', 'フライデー', 'きんようび'],
  ['sat', 'Saturday', 'サタデー', 'どようび'],
  ['sun', 'Sunday', 'サンデー', 'にちようび'],
];

export const EN_QUESTIONS: Question[] = [
  ...ROWS.flatMap(([img, word, kana, ja]) => {
    const base = BUILTIN_QUESTIONS.find((q) => q.id === img);
    if (!base) return [];
    return [{
      id: `en_${img}`,
      type: 'word' as const,
      category: ANIMALS.has(word) ? 'doubutsu' as const : ja ? 'mono' as const : base.category,
      hira: word,
      emoji: base.emoji,
      builtin: true,
      lang: 'en' as const,
      img,
      ja: ja ?? base.hira,
      kana,
    }];
  }),
  ...DAYS.map(([key, word, kana, ja]) => ({
    id: `en_youbi_${key}`,
    type: 'word' as const,
    category: 'youbi' as const,
    hira: word,
    emoji: '📅',
    builtin: true,
    lang: 'en' as const,
    img: `youbi_${key}`,
    ja,
    kana,
  })),
];

/** 頭が大文字の言葉（曜日）。字の大きさの設定を当てない */
export const fixedCase = (word: string) => /[A-Z]/.test(word);

// アルファベット（2026-10-27）: 1問＝1文字。「いぬ は dog」の画面は出さない。
// ミニゲームは 小文字 → 大文字 のマッチング（a に A をあてる）。カタカナは字の名前（読み上げの英語の声に合わせる）
const LETTER_KANA = ['エー', 'ビー', 'シー', 'ディー', 'イー', 'エフ', 'ジー', 'エイチ', 'アイ', 'ジェー', 'ケー', 'エル', 'エム',
  'エヌ', 'オー', 'ピー', 'キュー', 'アール', 'エス', 'ティー', 'ユー', 'ブイ', 'ダブリュー', 'エックス', 'ワイ', 'ズィー'];

export const ALPHABET_QUESTIONS: Question[] = Array.from('abcdefghijklmnopqrstuvwxyz', (c, i) => ({
  id: `en_abc_${c}`,
  type: 'word' as const,
  category: 'alphabet' as const,
  hira: c,
  emoji: `${c.toUpperCase()}${c}`,
  builtin: false,
  lang: 'en' as const,
  kana: LETTER_KANA[i],
}));

export const isAlphabet = (q: Question) => q.category === 'alphabet';

// 字の名前の読み上げ（2026-10-27）。大文字1字（D）を渡すと iPad は「Capital D」と読むので、小文字1字を渡す
// （1字だけなら字の名前「ディー」と読む）。

/** 英語の声に渡す、字の名前 */
export const letterName = (c: string): string => c.toLowerCase();

export function enQuestions(cat?: Category): Question[] {
  // 先生が作った英語の問題も（2026-10-27）
  const all = [...EN_QUESTIONS, ...ALPHABET_QUESTIONS, ...customEnQuestions()];
  return cat ? all.filter((q) => q.category === cat) : all;
}

/** アルファベット表（ABC順、7字ずつ4段） */
export const ALPHABET_ROWS: string[][] = ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz'].map((r) => Array.from(r));
