// 最初から入っている問題。単語60問（IMAGE_SPEC.md 4章）＋文20問（IMAGE_SPEC_SENTENCE.md）＋文・きもち20問。表記はすべてひらがな。
// emoji は画像が届くまでの仮表示。画像は src/images/{id}.webp（tools/sync_images.py が作る）。
// 先生が JSON で足す問題は bank.ts が扱う。

export type Category = 'mono' | 'kimochi' | 'ugoki' | 'bun' | 'bunkimochi';

/** 単語1つの長さの上限（打つキーの数。ゃ・ー も1字） */
export const MAX_CHARS = 10;

/**
 * 問題の種類。
 * word     … 単語1つ（もの／きもち／うごき）
 * sentence … 「〇〇が●●」の文（ぶん／ぶん・きもち）。〇〇 → ●● の2段階で打つ。「が」は最初から出ている
 */
export type QuestionType = 'word' | 'sentence';

/** 文の〇〇＋●●の合計の上限（画面に収めるため。各語は MAX_CHARS まで） */
export const MAX_SENTENCE_CHARS = 12;

/** 文の真ん中に入る助詞（打たせない） */
export const PARTICLE = 'が';

export interface Question {
  id: string;
  type: QuestionType;
  category: Category;
  /** 読み上げ・見本に使う全体（文なら「いぬがはしる」） */
  hira: string;
  /** 文のときだけ: [〇〇, ●●] */
  parts?: [string, string];
  emoji: string;
  /** 最初から入っている問題（削除できない。画像は src/images/{id}.webp） */
  builtin: boolean;
}

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'mono', label: 'もの', emoji: '🍎' },
  { id: 'kimochi', label: 'きもち', emoji: '😊' },
  { id: 'ugoki', label: 'うごき', emoji: '🏃' },
  { id: 'bun', label: 'ぶん', emoji: '📝' },
  { id: 'bunkimochi', label: 'ぶん・きもち', emoji: '💬' },
];

/** 文の問題を作る（id は bun_01… / bunkimochi_01…） */
export function sentence(id: string, subject: string, predicate: string, emoji: string, builtin: boolean, category: Category = 'bun'): Question {
  return {
    id,
    type: 'sentence',
    category,
    hira: subject + PARTICLE + predicate,
    parts: [subject, predicate],
    emoji,
    builtin,
  };
}

const q = (category: Category, rows: [string, string][]): Question[] =>
  rows.map(([hira, emoji], i) => ({
    id: `${category}_${String(i + 1).padStart(2, '0')}`,
    type: 'word' as const,
    category,
    hira,
    emoji,
    builtin: true,
  }));

export const BUILTIN_QUESTIONS: Question[] = [
  ...q('mono', [
    ['りんご', '🍎'],
    ['いぬ', '🐶'],
    ['ねこ', '🐱'],
    ['くるま', '🚗'],
    ['でんしゃ', '🚃'],
    ['ばす', '🚌'],
    ['しょうぼうしゃ', '🚒'],
    ['ぱとかー', '🚓'],
    ['きょうりゅう', '🦖'],
    ['ひこうき', '✈️'],
    ['ふね', '🚢'],
    ['ばなな', '🍌'],
    ['いちご', '🍓'],
    ['とけい', '⏰'],
    ['かさ', '☂️'],
    ['くつ', '👟'],
    ['ぼうし', '🧢'],
    ['さかな', '🐟'],
    ['ぞう', '🐘'],
    ['けーき', '🍰'],
  ]),
  ...q('kimochi', [
    ['うれしい', '😄'],
    ['かなしい', '😢'],
    ['たのしい', '😆'],
    ['おこる', '😠'],
    ['こわい', '😨'],
    ['びっくり', '😲'],
    ['いたい', '🤕'],
    ['ねむい', '😪'],
    ['さむい', '🥶'],
    ['あつい', '🥵'],
    ['おいしい', '😋'],
    ['まずい', '😖'],
    ['はずかしい', '😳'],
    ['さびしい', '😔'],
    ['くやしい', '😣'],
    ['こまる', '😟'],
    ['つかれた', '😩'],
    ['どきどき', '💓'],
    ['いやだ', '🙅'],
    ['げんき', '💪'],
  ]),
  ...q('ugoki', [
    ['はしる', '🏃'],
    ['あるく', '🚶'],
    ['たべる', '🍙'],
    ['のむ', '🥛'],
    ['ねる', '🛌'],
    ['おきる', '🌅'],
    ['およぐ', '🏊'],
    ['なげる', '⚾'],
    ['ける', '⚽'],
    ['かく', '🖍️'],
    ['よむ', '📖'],
    ['あらう', '🧼'],
    ['すわる', '🪑'],
    ['たつ', '🧍'],
    ['うたう', '🎤'],
    ['おどる', '💃'],
    ['とぶ', '🤸'],
    ['みがく', '🪥'],
    ['のぼる', '🧗'],
    ['きがえる', '👕'],
  ]),
  // 文（〇〇が●●）。●●は うごき の言葉だけ（2026-10-02 ユーザー決定）
  sentence('bun_01', 'いぬ', 'はしる', '🐕', true),
  sentence('bun_02', 'ねこ', 'ねる', '🐈', true),
  sentence('bun_03', 'ぞう', 'あるく', '🐘', true),
  sentence('bun_04', 'さかな', 'およぐ', '🐟', true),
  sentence('bun_05', 'ひこうき', 'とぶ', '✈️', true),
  sentence('bun_06', 'でんしゃ', 'はしる', '🚃', true),
  sentence('bun_07', 'ふね', 'すすむ', '🚢', true),
  sentence('bun_08', 'ばす', 'とまる', '🚌', true),
  sentence('bun_09', 'いぬ', 'たべる', '🐕', true),
  sentence('bun_10', 'ねこ', 'のむ', '🐈', true),
  sentence('bun_11', 'うさぎ', 'とぶ', '🐇', true),
  sentence('bun_12', 'きょうりゅう', 'あるく', '🦖', true),
  sentence('bun_13', 'くるま', 'はしる', '🚗', true),
  // bun_14〜20 は修学旅行カドタンの絵を流用（2026-10-04 ユーザー決定。tools/kadotan_from_library.py）
  sentence('bun_14', 'かどたん', 'のむ', '🟢', true),
  sentence('bun_15', 'かどたん', 'たべる', '🟢', true),
  sentence('bun_16', 'かどたん', 'ねる', '🟢', true),
  sentence('bun_17', 'かどたん', 'あるく', '🟢', true),
  sentence('bun_18', 'かどたん', 'よむ', '🟢', true),
  sentence('bun_19', 'かどたん', 'あらう', '🟢', true),
  sentence('bun_20', 'かどたん', 'すわる', '🟢', true),
  // ぶん・きもち（2026-10-05）: 絵は素材ライブラリの表情から（tools/bunkimochi_from_library.py）。
  // ●● は きもちカテゴリの言葉。ヒントの2回目で、その言葉のきもちの絵が浮かび上がる
  sentence('bunkimochi_01', 'うさぎ', 'うれしい', '🐇', true, 'bunkimochi'),
  sentence('bunkimochi_02', 'ぞう', 'うれしい', '🐘', true, 'bunkimochi'),
  sentence('bunkimochi_03', 'かどたん', 'うれしい', '🟢', true, 'bunkimochi'),
  sentence('bunkimochi_04', 'おんなのこ', 'うれしい', '👧', true, 'bunkimochi'),
  sentence('bunkimochi_05', 'おとこのこ', 'かなしい', '👦', true, 'bunkimochi'),
  sentence('bunkimochi_06', 'おんなのこ', 'おこる', '👧', true, 'bunkimochi'),
  sentence('bunkimochi_07', 'ともだち', 'おこる', '🧒', true, 'bunkimochi'),
  sentence('bunkimochi_08', 'らいおん', 'こまる', '🦁', true, 'bunkimochi'),
  sentence('bunkimochi_09', 'おとこのこ', 'こまる', '👦', true, 'bunkimochi'),
  sentence('bunkimochi_10', 'おんなのこ', 'こまる', '👧', true, 'bunkimochi'),
  sentence('bunkimochi_11', 'かどたん', 'こまる', '🟢', true, 'bunkimochi'),
  sentence('bunkimochi_12', 'おとこのこ', 'びっくり', '👦', true, 'bunkimochi'),
  sentence('bunkimochi_13', 'おんなのこ', 'びっくり', '👧', true, 'bunkimochi'),
  sentence('bunkimochi_14', 'ごりら', 'たのしい', '🦍', true, 'bunkimochi'),
  sentence('bunkimochi_15', 'うさぎ', 'たのしい', '🐇', true, 'bunkimochi'),
  sentence('bunkimochi_16', 'らいおん', 'たのしい', '🦁', true, 'bunkimochi'),
  sentence('bunkimochi_17', 'かどたん', 'たのしい', '🟢', true, 'bunkimochi'),
  sentence('bunkimochi_18', 'ごりら', 'ねむい', '🦍', true, 'bunkimochi'),
  sentence('bunkimochi_19', 'みみ', 'いたい', '👂', true, 'bunkimochi'),
  sentence('bunkimochi_20', 'おなか', 'いたい', '🟢', true, 'bunkimochi'),
];
