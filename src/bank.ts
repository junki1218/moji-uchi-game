// 問題の置き場。最初からの60問＋先生が JSON で足した問題、と「出題しない」印を iPad の中に保存する。
// 写真は photos.ts（IndexedDB）。

import { BUILTIN_QUESTIONS, CATEGORIES, MAX_CHARS, MAX_SENTENCE_CHARS, sentence, type Category, type Question } from './questions';
import { DAKUON, SEION, SMALL } from './kana';
import { blobToDataUrl, dataUrlToBlob, hasPhoto, photoBlob, removePhoto, savePhoto, shrinkImage } from './photos';

const CUSTOM_KEY = 'moji-uchi-game/custom-questions';
const DISABLED_KEY = 'moji-uchi-game/disabled-questions';
export const JSON_FORMAT = 'moji-uchi-game/questions';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくてもその場では動く
  }
}

let custom: Question[] = read<Question[]>(CUSTOM_KEY, []);
let disabled = new Set(read<string[]>(DISABLED_KEY, []));
const builtinIds = new Set(BUILTIN_QUESTIONS.map((q) => q.id));

function persist(): void {
  write(CUSTOM_KEY, custom);
  write(DISABLED_KEY, [...disabled]);
}

/** 日本語の問題（最初から＋先生が足したもの）。先生が作った英語の問題は customEnQuestions */
export function allQuestions(cat?: Category): Question[] {
  const all = [...BUILTIN_QUESTIONS, ...custom.filter((q) => q.lang !== 'en')];
  return cat ? all.filter((q) => q.category === cat) : all;
}

/** 先生が作った英語の問題（2026-10-27） */
export function customEnQuestions(cat?: Category): Question[] {
  return custom.filter((q) => q.lang === 'en' && (!cat || q.category === cat));
}

export function isEnabled(id: string): boolean {
  return !disabled.has(id);
}

export function enabledQuestions(cat: Category): Question[] {
  return allQuestions(cat).filter((q) => isEnabled(q.id));
}

export function setEnabled(ids: string[], on: boolean): void {
  for (const id of ids) (on ? disabled.delete(id) : disabled.add(id));
  persist();
}

export async function deleteCustom(id: string): Promise<void> {
  custom = custom.filter((q) => q.id !== id);
  disabled.delete(id);
  persist();
  await removePhoto(id).catch(() => undefined);
}

export async function attachPhoto(id: string, file: Blob): Promise<void> {
  await savePhoto(id, await shrinkImage(file));
}

// ------------------------------------------------------------ アプリの中で問題を作る（2026-10-27）

export interface NewQuestion {
  lang: 'ja' | 'en';
  category: Category;
  /** 日本語はひらがな・カタカナ、英語はアルファベット */
  word: string;
  /** 英語だけ: 日本語（ひらがな）・カタカナの読み方 */
  ja?: string;
  kana?: string;
  /** よみかた（なくてもよい） */
  reading?: string;
  photo?: Blob | null;
}

const EN_WORD = /^[a-z]+$/;

/** 先生が作った問題を足す。だめなら理由を返す */
export async function addCustom(n: NewQuestion): Promise<{ id: string } | { error: string }> {
  const reading = n.reading?.trim() || undefined;
  const stamp = Date.now().toString(36);
  if (n.lang === 'en') {
    const word = n.word.trim().toLowerCase();
    if (!word) return { error: 'えいごの ことばを いれてください' };
    if (!EN_WORD.test(word)) return { error: 'えいごは a〜z の字だけにしてください（スペースや記号は打てません）' };
    if (word.length > MAX_CHARS) return { error: `${MAX_CHARS}文字までです（${word.length}文字）` };
    if (n.category !== 'mono' && n.category !== 'ugoki') return { error: 'しゅるいは もの／うごき です' };
    const ja = normalizeKana(n.ja ?? '');
    if (!ja) return { error: 'にほんご（ひらがな）を いれてください（「いぬ は dog」の画面で使います）' };
    const kana = (n.kana ?? '').trim().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    const id = `c_en_${n.category}_${word}_${stamp}`;
    custom.push({ id, type: 'word', category: n.category, hira: word, emoji: '❔', builtin: false, lang: 'en', ja, kana: kana || undefined, reading });
    persist();
    if (n.photo) await attachPhoto(id, n.photo);
    return { id };
  }
  const word = normalizeKana(n.word);
  const err = checkWord(word);
  if (err) return { error: err };
  if (!['mono', 'kimochi', 'ugoki'].includes(n.category)) return { error: 'しゅるいは もの／きもち／うごき です' };
  const id = `c_${n.category}_${word}_${stamp}`;
  custom.push({ id, type: 'word', category: n.category, hira: word, emoji: '❔', builtin: false, reading });
  persist();
  if (n.photo) await attachPhoto(id, n.photo);
  return { id };
}

// ------------------------------------------------------------ JSON 読み込み

/** キーボードで打てる字だけを許す（ぁぃぅぇぉ・ゔ・漢字などは打てない） */
const TYPABLE = new Set([...SEION, ...DAKUON, ...SMALL].flat().filter((c): c is string => !!c));

const CATEGORY_ALIASES: Record<string, Category> = Object.fromEntries(
  CATEGORIES.flatMap((c) => [
    [c.id, c.id],
    [c.label, c.id],
  ]),
);

/** カタカナで書かれていてもひらがなにそろえる（ー はそのまま） */
function normalizeKana(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 打てる単語かを調べる。だめなら理由、よければ null */
function checkWord(word: string): string | null {
  const chars = Array.from(word);
  if (!chars.length) return '言葉がありません';
  if (chars.length > MAX_CHARS) return `${MAX_CHARS}文字までです（${chars.length}文字）`;
  const bad = [...new Set(chars.filter((c) => !TYPABLE.has(c)))];
  if (bad.length) return `キーボードにない字があります（${bad.join('・')}）`;
  return null;
}

interface Parsed {
  id: string;
  question: Question | null; // 最初からの問題を指すときは null（ON にするだけ）
  image?: string;
}

export interface ImportPlan {
  items: Parsed[];
  errors: string[];
}

export function parseImport(text: string): ImportPlan {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { items: [], errors: ['JSON として読めません（カンマやかっこの抜けがないか確認してください）'] };
  }
  const list = Array.isArray(data) ? data : (data as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) {
    return { items: [], errors: ['"questions" の一覧が見つかりません'] };
  }

  const items: Parsed[] = [];
  list.forEach((raw, i) => {
    const n = `${i + 1}件目`;
    if (!raw || typeof raw !== 'object') return errors.push(`${n}: 形がちがいます`);
    const r = raw as Record<string, unknown>;
    const type = r.type ?? 'word';
    if (type !== 'word' && type !== 'sentence') return errors.push(`${n}: type "${String(type)}" には対応していません（word か sentence）`);

    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const image = typeof r.image === 'string' && r.image.startsWith('data:image/') ? r.image : undefined;
    const emoji = typeof r.emoji === 'string' && r.emoji.trim() ? r.emoji.trim() : '❔';

    // 最初からの問題は id だけで指せる（書き出したファイルを別の iPad で読むとき）
    if (id && builtinIds.has(id)) {
      items.push({ id, question: null, image });
      return;
    }

    // 文「〇〇が●●」: カテゴリは「ぶん」（category に「ぶん・きもち」と書けば、ぶん・きもち）
    if (type === 'sentence') {
      const scat: Category = CATEGORY_ALIASES[String(r.category ?? '').trim()] === 'bunkimochi' ? 'bunkimochi' : 'bun';
      const subject = normalizeKana(String(r.subject ?? ''));
      const predicate = normalizeKana(String(r.predicate ?? ''));
      const label = `「${subject}が${predicate}」`;
      const e1 = checkWord(subject);
      if (e1) return errors.push(`${n}${label}: 〇〇（subject）… ${e1}`);
      const e2 = checkWord(predicate);
      if (e2) return errors.push(`${n}${label}: ●●（predicate）… ${e2}`);
      const total = Array.from(subject + predicate).length;
      if (total > MAX_SENTENCE_CHARS) return errors.push(`${n}${label}: 〇〇と●●を合わせて${MAX_SENTENCE_CHARS}文字までです（${total}文字）`);
      const sid = id || `c_${scat}_${subject}_${predicate}`;
      items.push({ id: sid, image, question: sentence(sid, subject, predicate, emoji, false, scat) });
      return;
    }

    const reading = typeof r.reading === 'string' && r.reading.trim() ? r.reading.trim() : undefined;
    // 英語（2026-10-27）: {"lang":"en","word":"taro","ja":"たろう","kana":"タロウ","category":"mono"}
    if (r.lang === 'en') {
      const w = String(r.word ?? '').trim().toLowerCase();
      const c = CATEGORY_ALIASES[String(r.category ?? '').trim()];
      const ja = normalizeKana(String(r.ja ?? ''));
      if (!EN_WORD.test(w) || w.length > MAX_CHARS) return errors.push(`${n}「${w}」: えいごは a〜z の${MAX_CHARS}文字までです`);
      if (c !== 'mono' && c !== 'ugoki') return errors.push(`${n}「${w}」: category は もの／うごき にしてください`);
      if (!ja) return errors.push(`${n}「${w}」: ja（にほんご）がありません`);
      const eid = id || `c_en_${c}_${w}`;
      items.push({ id: eid, image, question: { id: eid, type: 'word', category: c, hira: w, emoji, builtin: false, lang: 'en', ja, kana: typeof r.kana === 'string' ? r.kana.trim() || undefined : undefined, reading } });
      return;
    }

    const word = normalizeKana(String(r.word ?? r.hira ?? ''));
    const cat = CATEGORY_ALIASES[String(r.category ?? '').trim()];
    if (!word) return errors.push(`${n}: 単語（word）がありません`);
    if (!cat || cat === 'bun' || cat === 'bunkimochi') return errors.push(`${n}「${word}」: category は もの／きもち／うごき のどれかにしてください（文は type: "sentence"）`);
    const err = checkWord(word);
    if (err) return errors.push(`${n}「${word}」: ${err}`);

    const qid = id || `c_${cat}_${word}`;
    items.push({
      id: qid,
      image,
      question: {
        id: qid,
        type: 'word',
        category: cat,
        hira: word,
        emoji,
        builtin: false,
        reading,
      },
    });
  });
  return { items, errors };
}

/**
 * add     … 今の問題に足す（同じ id は上書き）。読み込んだ問題は出題 ON にする
 * replace … 読み込んだ問題だけを出題する。足した問題のうち読み込みに無いものは消す（最初からの60問は OFF にするだけ）
 */
export async function applyImport(plan: ImportPlan, mode: 'add' | 'replace'): Promise<number> {
  const incoming = new Set(plan.items.map((p) => p.id));
  if (mode === 'replace') {
    // 先生が作った英語の問題は、日本語の読み込みでは消さない
    for (const q of custom) if (!incoming.has(q.id) && q.lang !== 'en') await removePhoto(q.id).catch(() => undefined);
    custom = custom.filter((q) => q.lang === 'en');
    disabled = new Set(BUILTIN_QUESTIONS.map((q) => q.id).filter((id) => !incoming.has(id)));
  }
  for (const p of plan.items) {
    if (p.question) {
      custom = custom.filter((q) => q.id !== p.id);
      custom.push(p.question);
    }
    disabled.delete(p.id);
    if (p.image) await savePhoto(p.id, await dataUrlToBlob(p.image)).catch(() => undefined);
  }
  persist();
  return plan.items.length;
}

// ------------------------------------------------------------ JSON 書き出し

/** 出題 ON の問題を書き出す。写真も含めるので、そのまま別の iPad で読み込める */
export async function exportJson(): Promise<Blob> {
  const questions = [];
  for (const q of [...allQuestions(), ...customEnQuestions()].filter((x) => isEnabled(x.id))) {
    const blob = hasPhoto(q.id) ? await photoBlob(q.id) : null;
    questions.push({
      id: q.id,
      type: q.type,
      category: q.category,
      ...(q.type === 'sentence' && q.parts ? { subject: q.parts[0], predicate: q.parts[1] } : { word: q.hira }),
      ...(q.builtin ? {} : { emoji: q.emoji }),
      ...(q.lang === 'en' ? { lang: 'en', ja: q.ja, kana: q.kana } : {}),
      ...(q.reading ? { reading: q.reading } : {}),
      ...(blob ? { image: await blobToDataUrl(blob) } : {}),
    });
  }
  const body = { format: JSON_FORMAT, version: 1, questions };
  return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
}
