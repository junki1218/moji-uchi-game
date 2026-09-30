// 最初から入っている60問（IMAGE_SPEC.md 4章の単語表と対応）。表記はすべてひらがな。
// emoji は画像が届くまでの仮表示。画像は public/images/{id}.webp（tools/sync_images.py が作る）。
// 先生が JSON で足す問題は bank.ts が扱う。

export type Category = 'mono' | 'kimochi' | 'ugoki';

/** 単語1つの長さの上限（打つキーの数。ゃ・ー も1字） */
export const MAX_CHARS = 10;

/**
 * 問題の種類。いまは単語だけ。
 * 将来の「〇〇が〇〇」（名詞＋助詞＋動詞を2段階で打つ）モードは 'sentence' として足す予定で、
 * 読み込み時に知らない type は取り込まずに知らせる。
 */
export type QuestionType = 'word';

export interface Question {
  id: string;
  type: QuestionType;
  category: Category;
  hira: string;
  emoji: string;
  /** 最初から入っている問題（削除できない。画像は public/images/{id}.webp） */
  builtin: boolean;
}

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'mono', label: 'もの', emoji: '🍎' },
  { id: 'kimochi', label: 'きもち', emoji: '😊' },
  { id: 'ugoki', label: 'うごき', emoji: '🏃' },
];

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
];
