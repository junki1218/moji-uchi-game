import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CATEGORIES, MAX_CHARS, type Category, type Question, withParticle, spokenText, type Particle } from './questions';
import { addCustom, allQuestions, applyImport, attachPhoto, deleteCustom, enabledQuestions, exportJson, isEnabled, parseImport, setEnabled, type ImportPlan } from './bank';
import { hasPhoto, loadPhotoIndex, photoUrl, removePhoto } from './photos';
import { DEFAULT_SHEET, pageCount, savePdf, worksheetPages, worksheetPdf, type SheetItem, type SheetOptions, type SheetSize } from './worksheet-pdf';
import { clearWritings, deleteWriting, exportWritings, listWritings, MAX_WRITINGS, saveWriting } from './writings';
import { chars, DAKUON, inScript, SEION, SMALL } from './kana';
import { loadSettings, saveSettings, VOLUME_LEVEL, type KeySet, type Settings, type Weight, type ParticleMode } from './settings';
import { duckBgm, playBgm, playJingle, setSound, sfx, stopBgm, unlockAudio } from './audio';
import { currentEnglishVoice, englishVoices, setEnglishVoice, speak, stopSpeech, unlockSpeech, type SpeechLang } from './speech';
import { MINIGAMES, runMinigame, type MiniQuestion, type MinigameKind } from './minigames';
import { letters } from './kinetic';
import { drawEnGlyph, drawEnLines, enLines, fillCentered } from './glyph';
import { LINE_QUESTIONS, LINE_SHAPES, lineShape, pathLength, shapeThumb, tracePath, type Pt } from './lines';
import { ALPHABET_QUESTIONS, ALPHABET_ROWS, EN_CATEGORIES, EN_QUESTIONS, enQuestions, isAlphabet, letterName } from './english';

// 新しい版が届いたら、ゲームの途中ではなくスタート画面に戻ったときに読み込み直す
// （古いプログラムと新しい絵が混ざって、絵と問題が食い違うのを防ぐ）
let updateReady = false;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true;
    // いまスタート画面なら、その場で切り替える（開いた直後に届いたとき、古い版のまま遊び始めないように）
    if (document.querySelector('.screen.start')) {
      updateReady = false;
      void updateSW(true);
    }
  },
  onRegisteredSW(_url, reg) {
    // ホーム画面のアプリは開きっぱなしになりやすいので、1時間ごとに新しい版を確かめる
    if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
  },
});

// 絵は src/images/ に置き、Vite が版ごとの印付きの名前（例 bun_14-AbC123.webp）にする。
// 古いプログラムが新しい絵を取りにいくことがなくなる
const IMAGE_URLS = import.meta.glob('./images/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imageUrl = (name: string): string | null => IMAGE_URLS[`./images/${name}.webp`] ?? null;

// iOS は最初のタップまで音を出せない。どこをタップしても解錠する
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

const ROUND_SIZE = 10;
const HANAMARU_MS = 1500;
const HINT_AFTER_MISSES = 2;

const app = document.getElementById('app')!;
let settings = loadSettings();

// 英語版（2026-10-27）。「はじめる」のあとで ひらがな・カタカナ／えいご を選ぶ
/** line＝せんの れんしゅう（2026-10-27） */
type Lang = 'ja' | 'en' | 'line';
let lang: Lang = 'ja';

/** 字の見せ方: 日本語はひらがな／カタカナの設定、英語は小文字／大文字の設定 */
function disp(s: string, l: Lang = lang): string {
  if (l === 'en') return settings.letterCase === 'upper' ? s.toUpperCase() : s;
  return inScript(s, settings.script);
}

/** その問題の字の見せ方（プリントは日本語と英語がまざることがある） */
const dispQ = (q: Question, s: string) => disp(s, q.lang === 'en' ? 'en' : 'ja');

/** 英語の字の大きさ・位置（4本線）。日本語はマスの真ん中 */
function placeGlyph(g: CanvasRenderingContext2D, ch: string, w: number, hh: number): [number, number] {
  if (lang === 'en') return drawEnGlyph(g, ch, w / 2, enLines(g, hh));
  return fillCentered(g, ch, w, hh);
}
setSound(settings.sound, VOLUME_LEVEL[settings.volume]);
setEnglishVoice(settings.enVoice);

// ------------------------------------------------------------ 小さな道具

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

function show(screen: HTMLElement): void {
  app.replaceChildren(screen);
}

/** 画像があれば画像、なければ仮表示（絵文字など）。画像を置けばコードを変えずに差し替わる。 */
function picture(name: string, fallback: () => Node, cls = ''): HTMLElement {
  const box = h('div', { class: `picture ${cls}` });
  const url = imageUrl(name);
  if (!url) return h('div', { class: `picture ${cls}` }, fallback());
  const img = h('img', { src: url, alt: '', draggable: 'false' });
  img.addEventListener('error', () => box.replaceChildren(fallback()));
  box.append(img);
  return box;
}

const emoji = (e: string) => () => h('span', { class: 'emoji' }, e);

/** 問題の絵。先生が付けた写真 → 最初からの絵（src/images/{id}.webp）→ 絵文字 の順に使う */
function questionPicture(q: Question, cls = ''): HTMLElement {
  if (isAlphabet(q)) return abcPicture(q, cls);
  if (q.category === 'line') {
    const s = lineShape(q.id);
    return h('div', { class: `picture ${cls} line-pic` }, s ? shapeThumb(s.pts) : null);
  }
  const pid = q.img ?? q.id;
  if (hasPhoto(pid)) {
    const box = h('div', { class: `picture ${cls}` });
    void photoUrl(pid).then((url) => {
      if (url) box.replaceChildren(h('img', { src: url, alt: '', draggable: 'false' }));
      else box.replaceChildren(emoji(q.emoji)());
    });
    return box;
  }
  if (q.builtin) return picture(pid, emoji(q.emoji), cls);
  return h('div', { class: `picture ${cls}` }, emoji(q.emoji)());
}

/** 問題の絵の URL（canvas に描くとき。ミニゲーム・プリント） */
async function questionImageUrl(q: Question): Promise<string | null> {
  const pid = q.img ?? q.id;
  if (hasPhoto(pid)) return photoUrl(pid);
  return q.builtin ? imageUrl(pid) : null;
}

// ボタン・題名などの UI の文言は、設定がカタカナでもひらがなのまま（読めない操作ボタンを作らない）

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hanamaruSvg(): SVGSVGElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg viewBox="0 0 200 200" class="hanamaru-svg" aria-hidden="true">
    <g fill="none" stroke="#E5484D" stroke-width="9" stroke-linecap="round">
      ${Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return `<circle cx="${100 + Math.cos(a) * 68}" cy="${100 + Math.sin(a) * 68}" r="22"/>`;
      }).join('')}
      <path d="M100 100 m-4 0 a4 4 0 1 1 8 0 a12 12 0 1 1 -24 0 a20 20 0 1 1 40 0 a28 28 0 1 1 -56 0 a36 36 0 1 1 72 0"/>
    </g></svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}

function hanamaru(cls = ''): HTMLElement {
  return picture('hanamaru', hanamaruSvg, cls);
}

// ------------------------------------------------------------ スタート

function startScreen(): void {
  stopSpeech();
  const screen = h(
      'main',
      { class: 'screen start' },
      h('h1', { class: 'title' }, letters('がっくんの こくご', 'kt-wave')),
      h(
        'div',
        { class: 'start-buttons' },
        h('div', { class: 'start-col' },
          h('button', { class: 'big-btn primary', onclick: () => { unlockSpeech(); langScreen(); } },
            'はじめる'),
          h('button', { class: 'big-btn ehon', onclick: ehonScreen }, 'えほん')),
        h('div', { class: 'start-col' },
          h('button', { class: 'big-btn print', onclick: printScreen }, 'プリント'),
          h('button', { class: 'big-btn secondary', onclick: pinScreen }, 'せってい')),
      ),
  );
  // 背景はがっくんの絵（なければ無地）。まんなかのがっくんを隠さないよう、題名は上・ボタンは下の左右に置く
  const bg = imageUrl('start_bg');
  if (bg) screen.style.backgroundImage = `url(${bg})`;
  show(screen);
  playBgm('bgm1_start');
  // 新しい版が届いていたら切り替えて読み込み直す（画面は先に描いておくので、切り替わらなくても真っ白にならない）
  if (updateReady) {
    updateReady = false;
    void updateSW(true);
  }
}

// ------------------------------------------------------------ えほん（がっくんの えほん）
// Google スライドの絵本を、アプリの中でそのままスライドショーで見せる（2026-10-05）。
// 発表用の埋め込みプレーヤー（/embed）を全画面で出す。ネットが必要。
// スライドは「リンクを知っている全員が閲覧可」にしておく（iPad は Google にログインしていないため）。
// 2026-10-27: 本を選べるように（1 くろまる がっくん／2 がっくんと はっちゃん）。
//   本を足すときは EHON_BOOKS に1行足す（id は Google スライドの URL の /d/ と /edit の間）

interface EhonBook {
  no: number;
  title: string;
  /** Google スライドの ID */
  id: string;
  /** 表紙の印（格助詞）。が＝がっくん（黒い丸）、は＝はっちゃん（白い丸） */
  marks: ('が' | 'は')[];
}

const EHON_BOOKS: EhonBook[] = [
  { no: 1, title: 'くろまる がっくん', id: '1HCh2Wph8ASZyXvOPRZkWTAEZGIR5-iPDqGPenowOpWs', marks: ['が'] },
  { no: 2, title: 'がっくんと はっちゃん', id: '1pY8s9pXFCIncA9JIyFNpmtcK3g1VaZ8LTVid7oPyw8E', marks: ['が', 'は'] },
];

const ehonUrl = (b: EhonBook) => `https://docs.google.com/presentation/d/${b.id}/embed?start=false&loop=false&delayms=60000`;

/** 本を選ぶ */
function ehonScreen(): void {
  stopBgm();
  stopSpeech();
  show(
    h(
      'main',
      { class: 'screen ehon-pick' },
      backButton(startScreen),
      h('h2', {}, letters('えほん', 'kt-wave')),
      h('div', { class: 'ehon-books' },
        ...EHON_BOOKS.map((b) =>
          h('button', { class: 'ehon-book', onclick: () => ehonView(b) },
            h('span', { class: 'ehon-no' }, String(b.no)),
            h('span', { class: 'ehon-marks' }, ...b.marks.map((m) => h('span', { class: `ehon-mark mark-${m === 'が' ? 'ga' : 'ha'}` }, m))),
            h('span', { class: 'ehon-title' }, b.title)))),
    ),
  );
}

/** えらんだ本をスライドショーで見せる */
function ehonView(b: EhonBook): void {
  const body = navigator.onLine
    ? h('iframe', { class: 'ehon-frame', src: ehonUrl(b), allowfullscreen: 'true', title: b.title })
    : h('p', { class: 'ehon-offline' }, 'えほんは インターネットに つないで みてね');
  show(h('main', { class: 'screen ehon-screen' }, backButton(ehonScreen), body));
}

// ------------------------------------------------------------ ことば（ひらがな・カタカナ／えいご）

function langScreen(): void {
  playBgm('bgm1_start');
  const choose = (l: Lang) => {
    lang = l;
    // 英語の字（Andika）を先に読み込んでおく（キャンバスに描く字が代わりのフォントにならないように）
    if (l === 'en') void document.fonts?.load(`700 40px Andika`).catch(() => undefined);
    // せんの れんしゅう はカテゴリなし。すぐ始める
    if (l === 'line') startLineRound();
    else categoryScreen();
  };
  show(
    h(
      'main',
      { class: 'screen lang-pick' },
      backButton(startScreen),
      h('div', { class: 'lang-grid' },
        h('button', { class: 'lang-btn', onclick: () => choose('ja') },
          h('span', { class: 'lang-sample' }, 'あ ア'),
          h('span', { class: 'lang-label' }, letters('ひらがな カタカナ', 'kt-pop'))),
        h('button', { class: 'lang-btn en', onclick: () => choose('en') },
          h('span', { class: 'lang-sample' }, settings.letterCase === 'upper' ? 'ABC' : 'abc'),
          h('span', { class: 'lang-label' }, letters('えいご', 'kt-pop'))),
        h('button', { class: 'lang-btn line', disabled: !LINE_QUESTIONS.some((q) => isEnabled(q.id)), onclick: () => choose('line') },
          h('span', { class: 'lang-sample line-sample' }, shapeThumb(LINE_SHAPES[6].pts)),
          h('span', { class: 'lang-label' }, letters('せんの れんしゅう', 'kt-pop')))),
    ),
  );
}

// ------------------------------------------------------------ カテゴリ

/** 英語版のカテゴリ（もの・うごき・アルファベット） */
function enCategories(): { id: Category; label: string; emoji: string }[] {
  return [...CATEGORIES.filter((c) => EN_CATEGORIES.includes(c.id)), { id: 'alphabet', label: 'アルファベット', emoji: '🔤' }];
}

function categoryScreen(): void {
  playBgm('bgm1_start');
  // 英語版は「もの」「うごき」だけ（「ぶん」は後日）
  const cats = lang === 'en' ? enCategories() : CATEGORIES;
  show(
    h(
      'main',
      { class: `screen category ${lang === 'en' ? 'en' : ''}` },
      backButton(langScreen),
      lang === 'en' ? h('h2', { class: 'category-title' }, letters('えいご', 'kt-wave')) : null,
      h(
        'div',
        { class: 'category-grid' },
        ...cats.map((c) => {
          // 出題する問題が1つもないカテゴリは押せない
          const empty = (lang === 'en' ? enQuestions(c.id).filter((q) => isEnabled(q.id)) : enabledQuestions(c.id)).length === 0;
          return h(
            'button',
            { class: `category-btn ${empty ? 'disabled' : ''}`, disabled: empty, onclick: () => startRound(c.id) },
            c.id === 'alphabet' ? h('div', { class: 'picture category-pic abc-cat' }, h('span', { class: 'abc-cat-text' }, 'Aa')) : picture(`cat_${c.id}`, emoji(c.emoji), 'category-pic'),
            h('span', { class: 'category-label' }, letters(c.label, 'kt-pop')),
          );
        }),
      ),
    ),
  );
}

function backButton(to: () => void, label = 'もどる'): HTMLElement {
  return h('button', { class: 'back-btn', onclick: to }, label);
}

// ------------------------------------------------------------ ゲーム

interface Round {
  questions: Question[];
  index: number;
  /** 英語版: 「いぬ は dog」を見せ終えた問題の番号 */
  introAt?: number;
  /** 直前のミニゲーム（同じものが続かないように） */
  lastMini?: MinigameKind;
}

function startRound(cat: Category): void {
  const pool = lang === 'en' ? enQuestions(cat).filter((q) => isEnabled(q.id)) : enabledQuestions(cat);
  const round: Round = { questions: applyParticles(shuffle(pool).slice(0, ROUND_SIZE), true), index: 0 };
  try {
    localStorage.setItem(LAST_ROUND_KEY, JSON.stringify(round.questions.map((q) => q.id)));
  } catch {
    // 覚えられなくても遊べる
  }
  if (lang === 'en') void (document.fonts?.load(`700 40px Andika`) ?? Promise.resolve()).catch(() => undefined).finally(() => questionScreen(round));
  else questionScreen(round);
}

/**
 * ぶん・きもちの助詞を設定に合わせる（2026-10-27）。が・は のときは1問ずつ交代
 * （random＝どちらから始めるかをばらす。プリントは「が」から）
 */
function applyParticles(qs: Question[], random = false): Question[] {
  let k = random && Math.random() < 0.5 ? 1 : 0;
  return qs.map((q) => {
    if (q.category !== 'bunkimochi' || q.type !== 'sentence') return q;
    const p: Particle = settings.particleMode === 'ha' ? 'は' : settings.particleMode === 'mix' ? (k++ % 2 ? 'は' : 'が') : 'が';
    return withParticle(q, p);
  });
}

/** せんの れんしゅう: 20この形から10こ、やさしい順に */
function startLineRound(): void {
  const pool = LINE_QUESTIONS.filter((q) => isEnabled(q.id));
  const picked = shuffle(pool.length ? pool : LINE_QUESTIONS).slice(0, settings.lineCount).sort((a, b) => a.id.localeCompare(b.id));
  const round: Round = { questions: picked, index: 0 };
  try {
    localStorage.setItem(LAST_ROUND_KEY, JSON.stringify(picked.map((q) => q.id)));
  } catch {
    // 覚えられなくても遊べる
  }
  questionScreen(round);
}

function progress(round: Round): HTMLElement {
  return h(
    'div',
    { class: 'progress', 'aria-label': `${round.index + 1} / ${round.questions.length}` },
    ...round.questions.map((_, i) =>
      h('span', { class: `dot ${i < round.index ? 'done' : i === round.index ? 'now' : ''}` }),
    ),
  );
}

function quitButton(): HTMLElement {
  return h('button', { class: 'back-btn', onclick: confirmQuit }, 'やめる');
}

function confirmQuit(): void {
  const overlay = h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'dialog' },
      h('p', {}, 'やめますか？'),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', { class: 'big-btn secondary', onclick: () => overlay.remove() }, 'つづける'),
        h('button', { class: 'big-btn primary', onclick: () => { stopActiveMini(); startScreen(); } }, 'やめる'),
      ),
    ),
  );
  app.append(overlay);
}

const READ_PAUSE_MS = 250; // 読み終えてから元の大きさに戻すまで
const READ_GAP_MS = 200; // 次の字に移るまで
const READ_MAX_MS = 2500; // 読み上げが終わらない（声がない）ときの打ち切り

const SMALL_TO_BIG: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ', ャ: 'や', ュ: 'ゆ', ョ: 'よ', ッ: 'つ' };

/** 1文字だけを読むときの読み方（小さい字・のばす棒は、そのままだと伝わりにくい） */
function charReading(c: string): string {
  if (c === 'ー') return 'のばすぼう';
  if (SMALL_TO_BIG[c]) return `ちいさい ${SMALL_TO_BIG[c]}`;
  return c;
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** その問題を読むときの言葉（よみかた があればそれ。アルファベットは字の名前） */
function speechOf(q: Question): string {
  if (q.lang === 'en') return isAlphabet(q) ? letterName(q.hira) : q.reading || q.hira;
  return spokenText(q);
}

function speakAndWait(text: string, l: SpeechLang = 'ja'): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    const timer = window.setTimeout(end, READ_MAX_MS);
    if ('speechSynthesis' in window) speak(text, undefined, () => { clearTimeout(timer); end(); }, l);
    else { clearTimeout(timer); setTimeout(end, 600); } // 声が出ない環境でも、間をおいて次の字へ
  });
}

/** 答えのマスを1つずつ大きくして読み上げ、元に戻す。途中で画面を離れたら false */
/** whole: 1文字ずつ読んだあとに、もう一度読む言葉（でんしゃ ……で・ん・し・ちいさい や…… でんしゃ） */
async function readOut(cells: HTMLElement[], answer: string[], pIdx: number | null = null, en = false, whole = ''): Promise<boolean> {
  duckBgm(true);
  try {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell.isConnected) return false;
      cell.classList.add('readout');
      // 英語は字の名前（D をそのまま渡すと iPad は「Capital D」と読むので、小文字1字を渡す）
      if (en) await speakAndWait(letterName(answer[i]), 'en');
      else await speakAndWait(i === pIdx && answer[i] === 'は' ? 'わ' : charReading(answer[i]));
      await wait(READ_PAUSE_MS);
      cell.classList.remove('readout');
      await wait(READ_GAP_MS);
    }
    // 1文字ずつ読んだあとに、言葉としてもう一度読む（英語 S, H, I, P …… ship／日本語 で・ん・し・ちいさい や …… でんしゃ。2026-10-27）
    if (whole && answer.length > 1 && cells.every((c) => c.isConnected)) {
      await wait(READ_GAP_MS);
      cells.forEach((c) => c.classList.add('readout-word'));
      await speakAndWait(whole, en ? 'en' : 'ja');
      await wait(READ_PAUSE_MS);
      cells.forEach((c) => c.classList.remove('readout-word'));
    }
    return cells.every((c) => c.isConnected) || cells.length === 0;
  } finally {
    duckBgm(false);
  }
}

function questionScreen(round: Round, afterMini = false): void {
  // 英語版: ミニゲームの前に、まず「いぬ は dog」を見せて読む
  const q0 = round.questions[round.index];
  // せんの れんしゅう は別の画面（ミニゲームなし）
  if (q0.category === 'line') {
    lineScreen(round);
    return;
  }
  if (q0.lang === 'en' && !isAlphabet(q0) && round.introAt !== round.index) {
    introScreen(round);
    return;
  }
  // 問題の前に毎回ミニゲーム（設定で切れる）
  const valid = settings.minigameKinds.filter((k) => MINIGAMES.some((m) => m.id === k));
  const kinds = valid.length ? valid : MINIGAMES.map((m) => m.id);
  if (!afterMini && settings.minigame && kinds.length) {
    minigameScreen(round, kinds, () => questionScreen(round, true));
    return;
  }
  playBgm('bgm2_question'); // 10問のあいだ流しっぱなし
  const q = round.questions[round.index];
  const answer = chars(q.hira);
  // 文（〇〇が●●）の「が」の位置。設定で「最初から入れておく」なら打たせない
  const pIdx = particleIndex(q);
  const fixed = particleFixed(pIdx);
  const en = q.lang === 'en';
  const shown = (c: string) => disp(c);
  // アルファベットは字の名前
  const say = () => speak(speechOf(q), () => duckBgm(true), () => duckBgm(false), en ? 'en' : 'ja');

  const trace = settings.input === 'trace';
  const lined = en && settings.input !== 'keyboard'; // 英語のてがき: 見本も4本線
  const sample =
    settings.prompt === 'look' && !trace
      ? h('div', { class: 'sample' }, ...answer.map((c, i) =>
        i === pIdx ? h('span', { class: 'sample-cell particle' }, particleBadge(shown(c)))
          : lined ? h('span', { class: 'sample-cell lined' }, linedLetter(shown(c)))
            : h('span', { class: 'sample-cell' }, shown(c))))
      : null;

  const speaker = h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊');
  // 🔊 は絵の左（右の列が縦に長くなり、iPad で上の帯やキーボードにかぶったため。2026-10-27 英語、同日 日本語も）
  const side = h(
    'div',
    { class: 'q-side' },
    sample,
    // 英語: カタカナの読み方を、いつも単語の下に
    en && q.kana ? h('div', { class: 'en-kana' }, q.kana) : null,
  );
  const pic = questionPicture(q, 'q-pic');
  const top = h('div', { class: `q-top ${q.type === 'sentence' ? 'sentence' : ''}` }, speaker, pic, side);

  // 答えができたら、まず1文字ずつ大きくして読み上げる（字と音を結びつける）→ 花丸
  let finishing = false;
  const next = () => {
    if (finishing) return;
    finishing = true;
    const screen = app.querySelector<HTMLElement>('.screen.game');
    screen?.classList.add('reading'); // 読み上げ中は入力を受け付けない（やめる は押せる）
    const cells = [...(screen?.querySelectorAll<HTMLElement>('.answer .answer-cell, .hw-cells .hw-cell') ?? [])];
    void readOut(cells, answer, pIdx, en, speechOf(q)).then((ok) => { if (ok) celebrate(); });
  };
  const celebrate = () => {
    const overlay = h('div', { class: 'overlay clear' }, hanamaru('pop'));
    app.append(overlay);
    playJingle('correct');
    window.setTimeout(() => {
      round.index++;
      if (round.index < round.questions.length) questionScreen(round);
      else finishScreen();
    }, HANAMARU_MS);
  };

  // ヒント: 最初の1文字を薄く出す（キーボードはそのキーも光らせる）。どの出題モードでも出す
  // 文は 1回目＝〇〇（名詞）、2回目＝●●（うごき）の1文字目
  const hint: Hint = { show: () => false };
  // ぶん・きもち: ●● のヒントを出したとき、そのきもちの絵（きもちカテゴリの同じ言葉の絵）を浮かび上がらせる
  const feeling = feelingQuestion(q);
  if (feeling) {
    hint.onReveal = (part) => {
      if (part !== 1 || pic.querySelector('.feeling-pop')) return;
      pic.append(h('div', { class: 'feeling-pop' }, questionPicture(feeling, 'feeling-pic')));
    };
  }
  const hintBtn: HTMLButtonElement = h('button', {
    class: 'hint-btn',
    onclick: () => { if (!hint.show()) hintBtn.disabled = true; },
  }, '💡 ヒント');

  const input =
    settings.input === 'keyboard'
      ? keyboardArea(answer, fixed, pIdx, side, next, hint)
      : handwritingArea(answer, fixed, pIdx, sample, next, hint, trace);
  // なぞりは字がはじめから見えているので、ヒントはいらない
  if (trace) hintBtn.hidden = true;

  show(
    h(
      'main',
      { class: `screen game ${en ? 'en' : ''}` },
      h('header', { class: 'game-header' },
        headerLeft(round, false),
        progress(round), hintBtn),
      en && !isAlphabet(q) ? enBanner(q) : null,
      top,
      input,
    ),
  );

  if (settings.prompt !== 'picture') window.setTimeout(say, 300);
}

/**
 * 英語版: 「いぬ は dog」の帯（2026-10-27）。日本語はひらがな、「は」はピンクの丸（これまでのきまり）、
 * 英単語の下にカタカナの読み方。ミニゲーム・問題のあいだも出したままにする
 */
function enBanner(q: Question, big = false): HTMLElement {
  return h('div', { class: `en-banner ${big ? 'big' : ''}` },
    h('span', { class: 'en-ja' }, q.ja ?? ''),
    h('span', { class: 'en-ha' }, particleBadge('は')),
    h('span', { class: 'en-word' },
      h('span', { class: 'en-word-text' }, dispQ(q, q.hira)),
      h('span', { class: 'en-kana' }, q.kana ?? '')));
}

/** 「いぬ は dog」と読む（日本語の声 → 英語の声）。「は」は「わ」と読む */
async function sayIntro(q: Question): Promise<void> {
  duckBgm(true);
  try {
    await speakAndWait(`${q.ja ?? ''} わ`);
    await wait(150);
    await speakAndWait(speechOf(q), 'en');
  } finally {
    duckBgm(false);
  }
}

/** 英語版: ミニゲーム（または問題）の前に「いぬ は dog」を見せて読む。「つぎへ」で進む */
function introScreen(round: Round): void {
  playBgm('bgm2_question');
  const q = round.questions[round.index];
  const nextBtn: HTMLButtonElement = h('button', {
    class: 'big-btn primary intro-next',
    hidden: true,
    onclick: () => {
      stopSpeech();
      round.introAt = round.index;
      questionScreen(round);
    },
  }, 'つぎへ ▶');
  const say = () => void sayIntro(q).then(() => { nextBtn.hidden = false; });
  show(
    h(
      'main',
      { class: 'screen game en intro' },
      h('header', { class: 'game-header' }, headerLeft(round, true), progress(round)),
      h('div', { class: 'intro-body' },
        questionPicture(q, 'q-pic intro-pic'),
        h('div', { class: 'intro-side' },
          enBanner(q, true),
          h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊'))),
      nextBtn,
    ),
  );
  // 声が出ないときも進めるように、少したったら「つぎへ」を出す
  window.setTimeout(() => { nextBtn.hidden = false; }, 6000);
  window.setTimeout(say, 400);
}

/**
 * アルファベットの問題の「絵」: 字を1つ大きく。ふつうは設定の こもじ／おおもじ だけ
 * （大文字と小文字を両方出すと、どちらを書くのか迷うので出さない。2026-10-27）。
 * ミニゲームは あてる元の小文字を渡す（only）
 */
function abcPicture(q: Question, cls: string, only?: string): HTMLElement {
  const ch = only ?? dispQ(q, q.hira);
  return h('div', { class: `picture ${cls} abc-pic` },
    h('span', { class: `abc-one ${ch === ch.toUpperCase() ? 'upper' : 'lower'}` }, ch));
}

/** 英語のてがきの見本: 4本線の上に字（キャンバス） */
function linedLetter(ch: string): HTMLCanvasElement {
  const S = 240;
  const c = h('canvas', { class: 'lined-letter', width: String(S), height: String(S), 'aria-label': ch, role: 'img' });
  const draw = () => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, S, S);
    const L = enLines(g, S);
    drawEnLines(g, 0, S, L, 3);
    g.fillStyle = '#333';
    drawEnGlyph(g, ch, S / 2, L);
  };
  draw();
  void document.fonts?.load(`700 40px Andika`).then(draw).catch(() => undefined);
  return c;
}

// ------------------------------------------------------------ せんの れんしゅう（2026-10-27）
// 大きな四角に うすい灰色の形。指でなぞる（黒い線）。線の上を書いているあいだはキラキラ星と音。
// ヒント: うすい赤の線が、一筆書きの動きでゆっくり進む。もう一度押すと、赤を消してから はじめから

const LINE_PX = 600;
/** 見本の線の太さ（四角の一辺に対する割合。設定「線の見本の太さ」） */
const LINE_GUIDE: Record<Weight, number> = { thin: 0.045, normal: 0.065, bold: 0.09 };
const LINE_TOLERANCE = LINE_PX * 0.045; // 線のふちから、これくらいまでは「なぞれている」
const HINT_RED = 'rgba(229, 72, 77, 0.45)';
const LINE_HINT_HOLD_MS = 700; // 問題を出したときのヒント: 書き終えてから灰色にもどすまで
/** ヒントの先っぽの がっくん: 大きさ（見本の線の太さの何倍か）と、見え方（透過度70% → 不透明度0.3） */
const LINE_HEAD_SIZE = 2.6;
const LINE_HEAD_ALPHA = 0.3;

function lineScreen(round: Round): void {
  playBgm('bgm2_question');
  const q = round.questions[round.index];
  const shape = lineShape(q.id)!;
  const pts = shape.pts;
  const S = LINE_PX;
  const gw = S * LINE_GUIDE[settings.lineWeight];
  const canvas = (cls: string) => h('canvas', { class: cls, width: String(S), height: String(S) });
  const guide = canvas('line-layer');
  const hintC = canvas('line-layer');
  const ink = canvas('line-layer line-ink');

  // 見本: うすい灰色の形と、書きはじめの緑の点
  const gg = guide.getContext('2d')!;
  gg.lineCap = 'round';
  gg.lineJoin = 'round';
  gg.strokeStyle = '#d9d2c7';
  gg.lineWidth = gw;
  tracePath(gg, pts, 0, 0, S);
  gg.stroke();
  gg.fillStyle = '#4caf50';
  gg.beginPath();
  gg.arc(pts[0][0] * S, pts[0][1] * S, gw * 0.75, 0, Math.PI * 2);
  gg.fill();

  // なぞりの当たり判定
  const mask = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = gw + LINE_TOLERANCE * 2;
    tracePath(g, pts, 0, 0, S);
    g.stroke();
    const d = g.getImageData(0, 0, S, S).data;
    const a = new Uint8ClampedArray(S * S);
    for (let k = 0; k < a.length; k++) a[k] = d[k * 4 + 3];
    return a;
  })();

  // 書く（黒い線）
  const ctx = ink.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2B2B2B';
  ctx.lineWidth = S * PEN_WIDTH[settings.penWidth];
  const stage = h('div', { class: 'line-stage' }, guide, hintC, ink);
  let drawing = false;
  let lastStar = 0;
  const point = (e: PointerEvent) => {
    const r = ink.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * S, ((e.clientY - r.top) / r.height) * S] as const;
  };
  const sparkle = (e: PointerEvent, x: number, y: number) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= S || py >= S || mask[py * S + px] < 128) return;
    const now = performance.now();
    if (now - lastStar < 45) return;
    lastStar = now;
    const r = stage.getBoundingClientRect();
    sparkleAt(stage, e.clientX - r.left, e.clientY - r.top);
    sfx('sparkle', 0.6, undefined, 110);
  };
  ink.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    drawing = true;
    const [x, y] = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    sparkle(e, x, y);
  });
  ink.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    sparkle(e, x, y);
  });
  const end = () => { drawing = false; };
  ink.addEventListener('pointerup', end);
  ink.addEventListener('pointercancel', end);

  // ヒント: うすい赤で一筆書きの動き。長い形ほどゆっくり（2.5〜7秒）
  const hg = hintC.getContext('2d')!;
  const head = new Image();
  head.src = imageUrl('gakkun_head') ?? '';
  let anim = 0;
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = pathLength(pts);
  const duration = Math.min(7000, Math.max(2500, total * 2600));
  let clearTimer = 0;
  /** clearAfter: 書き終えたら少しおいて赤を消し、灰色にもどす（問題を出したときの1回目） */
  const playHint = (clearAfter = false) => {
    cancelAnimationFrame(anim);
    clearTimeout(clearTimer);
    hg.clearRect(0, 0, S, S); // いったん もとの灰色にもどす
    const t0 = performance.now() + 250;
    const frame = (now: number) => {
      if (!hintC.isConnected) return;
      const f = Math.max(0, Math.min(1, (now - t0) / duration));
      const len = f * total;
      let n = cum.findIndex((c) => c >= len);
      if (n < 0) n = pts.length - 1;
      hg.clearRect(0, 0, S, S);
      hg.lineCap = 'round';
      hg.lineJoin = 'round';
      hg.strokeStyle = HINT_RED;
      hg.lineWidth = gw * 0.7;
      tracePath(hg, pts, 0, 0, S, n + 1);
      hg.stroke();
      // 先っぽ（いまどこを書いているか）: がっくん（2026-10-27）。絵がまだ読めていなければ赤い丸
      const [hx, hy] = pts[n] as Pt;
      if (head.complete && head.naturalWidth) {
        const d = gw * LINE_HEAD_SIZE;
        hg.save();
        hg.globalAlpha = LINE_HEAD_ALPHA;
        hg.drawImage(head, hx * S - d / 2, hy * S - d / 2, d, d);
        hg.restore();
      } else {
        hg.fillStyle = 'rgba(229, 72, 77, 0.8)';
        hg.beginPath();
        hg.arc(hx * S, hy * S, gw * 0.6, 0, Math.PI * 2);
        hg.fill();
      }
      if (f < 1) anim = requestAnimationFrame(frame);
      else if (clearAfter) clearTimer = window.setTimeout(() => hg.clearRect(0, 0, S, S), LINE_HINT_HOLD_MS);
    };
    anim = requestAnimationFrame(frame);
  };
  const hintBtn = h('button', { class: 'hint-btn', onclick: () => playHint() }, '💡 ヒント');

  const say = () => speak(`${shape.name} を なぞろう`, () => duckBgm(true), () => duckBgm(false));
  const erase = () => ctx.clearRect(0, 0, S, S);
  const done = () => {
    cancelAnimationFrame(anim);
    app.querySelector('.screen.game')?.classList.add('reading');
    app.append(h('div', { class: 'overlay clear' }, hanamaru('pop')));
    playJingle('correct');
    window.setTimeout(() => {
      round.index++;
      if (round.index < round.questions.length) questionScreen(round);
      else finishScreen();
    }, HANAMARU_MS);
  };

  show(
    h(
      'main',
      { class: 'screen game line-mode' },
      h('header', { class: 'game-header' }, headerLeft(round, false), progress(round), hintBtn),
      h('div', { class: 'line-head' },
        h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊'),
        h('h2', { class: 'line-title' }, letters(shape.name, 'kt-pop'))),
      stage,
      h('div', { class: 'hw-buttons' },
        h('button', { class: 'mid-btn secondary', onclick: erase }, 'けしごむ'),
        h('button', { class: 'mid-btn primary', onclick: done }, 'できた')),
    ),
  );
  window.setTimeout(say, 300);
  // 問題を出したら、まずヒントを1回見せて（書き方の動き）、灰色にもどす。あとはヒントボタンでいつでも
  if (settings.lineHint) window.setTimeout(() => { if (hintC.isConnected) playHint(true); }, 600);
}

/** 左上の「やめる」と ⚙（問題・ミニゲームの両方に出す） */
function headerLeft(round: Round, inMini: boolean): HTMLElement {
  return h('div', { class: 'header-left' },
    quitButton(),
    h('button', { class: 'gear-btn', 'aria-label': 'せってい', onclick: () => openSettingsModal(round, inMini) }, '⚙'));
}

/**
 * 問題の途中で設定を変える（暗証番号 → 設定）。変えたら、いまの問題を新しい設定で出し直す。
 * ミニゲーム中に変えたときは、ミニゲームからやり直す（ミニゲームの あり／なし・種類も反映）
 */
function openSettingsModal(round: Round, inMini = false): void {
  const before = JSON.stringify(settings);
  const box = h('div', { class: 'modal-box' });
  const overlay = h('div', { class: 'overlay settings-modal' }, box);
  const close = () => {
    overlay.remove();
    if (JSON.stringify(settings) !== before) {
      stopSpeech();
      if (JSON.parse(before).particleMode !== settings.particleMode) round.questions = applyParticles(round.questions, true);
      if (inMini) {
        stopActiveMini();
        questionScreen(round); // ミニゲームから出し直す
      } else {
        questionScreen(round, true); // ミニゲームはとばして、同じ問題を出し直す
      }
    }
  };
  const closeBtn = h('button', { class: 'mid-btn secondary modal-close', onclick: close }, 'とじる');
  box.append(closeBtn, ...pinPad(() => {
    const q = round.questions[round.index];
    const tab: SettingTab = q.category === 'line' ? 'line' : q.lang === 'en' ? 'en' : 'ja';
    box.replaceChildren(closeBtn, h('h2', {}, '設定（先生用）'), settingPanel({}, tab),
      h('p', { class: 'q-note' }, '「とじる」で、いまの問題を新しい設定で出し直します。'));
  }));
  app.append(overlay);
}

// ------------------------------------------------------------ ミニゲーム（問題の前）

/** やめる で途中で抜けたときにミニゲームを止める */
let stopActiveMini: () => void = () => undefined;

const MINI_SKIP_AFTER_MS = 20000; // これを過ぎたら「つぎへ」を出して、止まらないようにする
const MINI_CLEAR_MS = 1100;

function minigameScreen(round: Round, kinds: MinigameKind[], onDone: () => void): void {
  playBgm('bgm2_question');
  // 直前と同じものは避ける（1種類しかなければそれ）
  const pool = kinds.length > 1 ? kinds.filter((k) => k !== round.lastMini) : kinds;
  const kind = pool[Math.floor(Math.random() * pool.length)];
  round.lastMini = kind;
  const info = MINIGAMES.find((m) => m.id === kind)!;

  let finished = false;
  let stop: () => void = () => undefined;
  const leave = () => {
    if (finished) return;
    finished = true;
    clearTimeout(skipTimer);
    stop();
    onDone();
  };

  const goal = info.goal;
  const stars = h('div', { class: 'mini-stars', 'aria-label': `0 / ${goal}` }, ...Array.from({ length: goal }, () => h('span', { class: 'mini-star' }, '☆')));
  const skipBtn = h('button', { class: 'mid-btn secondary mini-skip', hidden: true, onclick: leave }, 'つぎへ ▶');
  const stage = h('div', { class: 'mini-stage' }, skipBtn);
  const mq = miniQuestion(round.questions[round.index]);

  const onProgress = (count: number) => {
    Array.from(stars.children).forEach((s, i) => {
      s.textContent = i < count ? '★' : '☆';
      s.classList.toggle('on', i < count);
    });
    if (count >= goal && !finished) {
      playJingle('correct');
      app.append(h('div', { class: 'overlay clear' }, h('div', { class: 'mini-clear pop' }, letters('できた！', 'kt-jump'))));
      setTimeout(() => {
        document.querySelector('.overlay.clear')?.remove();
        leave();
      }, MINI_CLEAR_MS);
    }
  };

  const say = () => speak(instruction, () => duckBgm(true), () => duckBgm(false));
  // 🔊 は正解の言葉を読む（やることは最初に1回読む）
  const cur = round.questions[round.index];
  const sayWord = () => speak(speechOf(cur), () => duckBgm(true), () => duckBgm(false), cur.lang === 'en' ? 'en' : 'ja');
  const instruction = mq.instruction?.[kind] ?? info.instruction;
  show(
    h(
      'main',
      { class: `screen game mini mini-${kind} ${cur.lang === 'en' ? 'en' : ''}` },
      h('header', { class: 'game-header' }, headerLeft(round, true), progress(round)),
      h('div', { class: 'mini-head' },
        h('button', { class: 'speaker-btn', 'aria-label': 'ことばを よみあげ', onclick: sayWord }, '🔊'),
        h('p', { class: 'mini-instruction' }, letters(instruction, 'kt-drop')),
        stars),
      cur.lang === 'en' && !isAlphabet(cur) ? enBanner(cur) : null,
      stage,
    ),
  );
  stop = runMinigame(kind, stage, mq, onProgress);
  stopActiveMini = () => { finished = true; clearTimeout(skipTimer); stop(); };
  const skipTimer = setTimeout(() => { skipBtn.hidden = false; }, MINI_SKIP_AFTER_MS);
  window.setTimeout(say, 300);
}

/** 次の問題から、ミニゲームに渡す情報を作る（まちがいの言葉は同じカテゴリのほかの問題から） */
/** アルファベットのミニゲーム: 小文字（パック・絵）に、大文字（玉・ゴール・ダイヤル）をあてる */
function abcMiniQuestion(q: Question): MiniQuestion {
  const lower = q.hira;
  const up = lower.toUpperCase();
  const others = shuffle(ALPHABET_ROWS.flat().filter((c) => c !== lower)).map((c) => c.toUpperCase());
  return {
    answer: up,
    chars: [up],
    fixed: new Set<number>(),
    others,
    picture: () => abcPicture(q, 'mini-q-pic', lower),
    pictureUrl: async () => null,
    emoji: lower,
    showSample: false, // 見本の大文字を出すと、あてる意味がなくなる
    toScript: (s) => s,
    dialChars: ALPHABET_ROWS.flat().map((c) => c.toUpperCase()),
    instruction: {
      bubble: 'おなじ もじの おおもじの しゃぼんだまを みっつ わろう',
      lock: 'おなじ もじの おおもじに あわせて かぎを あけよう',
      hockey: 'おなじ もじの おおもじの ゴールに いれよう',
    },
  };
}

function miniQuestion(q: Question): MiniQuestion {
  if (isAlphabet(q)) return abcMiniQuestion(q);
  const show1 = (s: string) => dispQ(q, s);
  const answer = chars(q.hira);
  const fixed = particleFixed(particleIndex(q));
  const pool = q.lang === 'en' ? enQuestions(q.category) : allQuestions(q.category);
  const others = shuffle(
    [...new Set(pool.map((x) => withParticle(x, q.particle ?? 'が').hira).filter((w) => w !== q.hira))],
  ).map(show1);
  const pictureUrl = () => questionImageUrl(q);
  return {
    answer: show1(q.hira),
    chars: answer.map(show1),
    fixed,
    others,
    picture: () => questionPicture(q, 'mini-q-pic'),
    pictureUrl,
    emoji: q.emoji,
    showSample: settings.prompt === 'look',
    toScript: show1,
    // 錠前のダイヤルの字: 英語はアルファベット
    dialChars: q.lang === 'en' ? ALPHABET_ROWS.flat().map(show1) : undefined,
  };
}

// ------------------------------------------------------------ キーボード入力

/** ヒントボタンと入力欄をつなぐ。show＝次のヒントを出し、まだ出せるヒントが残っていれば true */
interface Hint {
  show: () => boolean;
  /** ヒントで段の頭を出したときに呼ぶ（0＝〇〇、1＝●●） */
  onReveal?: (part: number) => void;
}

/** ぶん・きもちの ●● に当たる、きもちカテゴリの問題（絵をヒントに使う）。なければ null */
function feelingQuestion(q: Question): Question | null {
  if (q.category !== 'bunkimochi' || !q.parts) return null;
  const word = q.parts[1];
  return allQuestions('kimochi').find((k) => k.hira === word) ?? null;
}

/** 文なら 〇〇 と ●● の頭の位置、単語なら [0] */
/** 文の「が」が何文字目か（単語なら null） */
function particleIndex(q: Question): number | null {
  return q.type === 'sentence' && q.parts ? chars(q.parts[0]).length : null;
}

/** 「が」を打たせないマス（設定で「最初から入れておく」のとき） */
function particleFixed(pIdx: number | null): Set<number> {
  return new Set<number>(pIdx !== null && !settings.particleInput ? [pIdx] : []);
}

function partStarts(answer: string[], pIdx: number | null): number[] {
  const starts = [0];
  if (pIdx !== null && pIdx + 1 < answer.length) starts.push(pIdx + 1);
  return starts;
}

// キーボードの字の数（設定に保存し、変えるまで同じ難しさが続く）
const KEY_SET_COUNT: Record<KeySet, number> = { all: Infinity, k25: 25, k10: 10, answer: 0 };
const KEY_SET_STARS: Record<KeySet, string> = { all: '★★★★', k25: '★★★', k10: '★★', answer: '★' };
const KEY_SET_LABEL: Record<KeySet, string> = { all: '50おん', k25: '25おん', k10: '10おん', answer: 'こたえの もじだけ' };
const KEY_SET_LABEL_EN: Record<KeySet, string> = { all: 'ABC ぜんぶ', k25: '20もじ', k10: '10もじ', answer: 'こたえの もじだけ' };

function openKeySetMenu(onChange: () => void): void {
  const close = () => overlay.remove();
  const overlay: HTMLElement = h('div', { class: 'overlay keyset-overlay', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'keyset-menu' },
      ...(['all', 'k25', 'k10', 'answer'] as KeySet[]).map((k) =>
        h('button', {
          class: `keyset-item ${settings.keySet === k ? 'on' : ''}`,
          onclick: () => {
            settings = { ...settings, keySet: k };
            saveSettings(settings);
            onChange();
            close();
          },
        }, h('span', { class: 'keyset-stars' }, KEY_SET_STARS[k]), h('span', {}, (lang === 'en' ? KEY_SET_LABEL_EN : KEY_SET_LABEL)[k]))),
      h('button', { class: 'mid-btn secondary', onclick: close }, 'とじる')));
  app.append(overlay);
}

function keyboardArea(answer: string[], fixed: Set<number>, pIdx: number | null, side: HTMLElement, onDone: () => void, hint: Hint): HTMLElement {
  let pos = 0;
  let misses = 0;
  const cells = answer.map((c, i) =>
    fixed.has(i) ? h('span', { class: 'answer-cell fixed' }, disp(c)) : h('span', { class: 'answer-cell' }),
  );
  cells[0].classList.add('current');
  // 1段目（〇〇）を打ち終えたとき: 〇〇のマスを緑にして音を鳴らす
  const stageDone = (upTo: number) => {
    for (let i = 0; i < upTo; i++) cells[i].classList.add('stage-done');
    playJingle('correct');
  };
  // いま打っている段（〇〇／●●）の1文字目を薄く出す。もう打ってあれば、いま打つ字を出す
  // ヒントは段の頭（単語は1文字目、文は〇〇→●●の順）を1つずつ出す。
  // キーを光らせるのはその字を打つ番になったとき（〇〇を打っている途中に●●のキーは光らせない）
  const starts = partStarts(answer, pIdx);
  let step = 0;
  const glowAt = new Set<number>();
  const glowIfDue = () => { if (glowAt.has(pos)) keys.get(answer[pos])?.classList.add('hint'); };
  const filled = (i: number) => cells[i].classList.contains('filled');
  hint.show = () => {
    while (step < starts.length && filled(starts[step])) step++; // もう打った段は飛ばす
    // 出す段が残っていなければ、いま打つ字を出す（単語で1文字目を打った後に押したとき）
    const part = step < starts.length ? step : -1;
    const i = part >= 0 ? starts[step++] : pos;
    if (i < answer.length) {
      cells[i].dataset.ghost = disp(answer[i]);
      cells[i].classList.add('ghost');
      glowAt.add(i);
      glowIfDue();
    }
    if (part >= 0) hint.onReveal?.(part);
    while (step < starts.length && filled(starts[step])) step++;
    return step < starts.length;
  };
  side.append(h('div', { class: 'answer' }, ...cells));

  const keys = new Map<string, HTMLButtonElement>();

  const clearHint = () => keys.forEach((k) => k.classList.remove('hint'));

  const press = (c: string, key: HTMLButtonElement) => {
    if (pos >= answer.length) return;
    if (c !== answer[pos]) {
      key.classList.remove('shake');
      void key.offsetWidth; // アニメを最初から
      key.classList.add('shake');
      misses++;
      if (misses >= HINT_AFTER_MISSES) keys.get(answer[pos])?.classList.add('hint');
      return;
    }
    cells[pos].textContent = disp(c);
    cells[pos].classList.remove('current', 'ghost');
    cells[pos].classList.add('filled');
    clearHint();
    misses = 0;
    pos++;
    // 〇〇を打ち終えたら1段目の正解（「が」を打つ設定でも、〇〇の終わりで鳴らす）
    if (pos === pIdx) stageDone(pos);
    while (fixed.has(pos)) pos++;
    if (pos < answer.length) {
      cells[pos].classList.add('current');
      glowIfDue();
    } else onDone();
  };

  const block = (cols: (string | null)[][], cls: string) => {
    const ordered = settings.aColumn === 'right' ? [...cols].reverse() : cols;
    return h(
      'div',
      { class: `kb-block ${cls}` },
      ...ordered.map((col) =>
        h(
          'div',
          { class: 'kb-col' },
          ...col.map((c) => {
            if (!c) return h('span', { class: 'key empty' });
            const key = h('button', { class: 'key' }, disp(c));
            key.addEventListener('pointerdown', (e) => {
              e.preventDefault();
              press(c, key);
            });
            keys.set(c, key);
            return key;
          }),
        ),
      ),
    );
  };

  // 英語はアルファベット表（ABC順。7字ずつ4段、左から右へ）
  const alphabet = () => h('div', { class: 'kb-block alpha' },
    ...ALPHABET_ROWS.map((row) => h('div', { class: 'kb-row' }, ...row.map((c) => {
      const key = h('button', { class: 'key' }, disp(c));
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        press(c, key);
      });
      keys.set(c, key);
      return key;
    }))));
  const blocks = lang === 'en' ? [alphabet()] : [block(SEION, 'seion'), block(DAKUON, 'dakuon'), block(SMALL, 'small')];
  if (settings.aColumn === 'right' && lang !== 'en') blocks.reverse();

  // 字の数（☰ で選ぶ）。出さないキーは場所を空けたまま隠す（50音表の並びを崩さない）
  const needed = new Set(answer.filter((_, i) => !fixed.has(i)));
  const others = shuffle([...keys.keys()].filter((c) => !needed.has(c))); // この問題の間は同じ顔ぶれ
  const menuBtn = h('button', { class: 'kb-tool kb-menu', 'aria-label': 'メニュー', onclick: () => openKeySetMenu(applyKeySet) }, '☰');
  function applyKeySet(): void {
    const total = lang === 'en' && settings.keySet === 'k25' ? 20 : KEY_SET_COUNT[settings.keySet];
    const shown = new Set([...needed, ...others.slice(0, Math.max(0, total - needed.size))]);
    keys.forEach((k, c) => k.classList.toggle('off', !shown.has(c)));
  }
  applyKeySet();

  return h('div', { class: 'input-area' },
    h('div', { class: 'kb-toolbar' }, menuBtn),
    h('div', { class: 'keyboard' }, ...blocks));
}

// ------------------------------------------------------------ 手書き入力（判定なし）
// 小さなマスをタップすると大きな手書きパッドが開く。書いた字はパッドを閉じると縮小してマスに写る。
// 字は正方形の画像（PAD_PX 四方）として1文字ずつ持ち、開き直すと続きから書ける。

const PAD_PX = 600;

/**
 * 字を、字の形（インクの部分）がマスの上下左右の真ん中に来るように描く。
 * textBaseline: middle だとフォントによって少し下にずれるので、実際の字の形を測ってそろえる
 */
// 字をマスの真ん中に描く fillCentered は glyph.ts（ワークシートの PDF と共通）

/**
 * 文の「が」の見本（黒い丸に白い字）。「は」はピンクの丸に黒い字（えほんの はっちゃん と同じ色。2026-10-27）。丸と字を同じキャンバスに描いて、字を丸の真ん中にそろえる
 * （CSS の丸と文字を重ねると、フォントによって字がずれていた）
 */
const HA_BG = '#F9C9D6';

function particleBadge(ch: string, cls = 'particle-badge'): HTMLCanvasElement {
  const S = 240;
  const c = h('canvas', { class: cls, width: String(S), height: String(S), 'aria-label': ch, role: 'img' });
  const font = () => `600 ${S * 0.56}px ${getComputedStyle(document.documentElement).getPropertyValue('--kyokasho').trim() || 'sans-serif'}`;
  const draw = () => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, S, S);
    const ha = ch === 'は' || ch === 'ハ';
    g.fillStyle = ha ? HA_BG : '#222';
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.41, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ha ? '#222' : '#fff';
    g.font = font();
    fillCentered(g, ch, S, S);
  };
  draw();
  // 教科書体が読み込まれたら描き直す
  void document.fonts?.load(font(), ch).then(draw).catch(() => undefined);
  return c;
}

const TRACE_TOLERANCE = PAD_PX / 14; // 字のふちから、これくらいまでは「なぞれている」とみなす
const STAR_COLORS = ['#ffd54f', '#ffb300', '#ff80ab', '#80d8ff', '#b9f6ca', '#ffffff'];

/** なぞりの見本の太さ: 字のふちを足す（ふとい）／削る（ほそい）幅。キャンバスの一辺に対する割合 */
const GUIDE_EDGE: Record<Weight, number> = { thin: -0.016, normal: 0, bold: 0.032 };
/** ペンの線の太さ（パッドの一辺に対する割合） */
const PEN_WIDTH: Record<Weight, number> = { thin: 1 / 34, normal: 1 / 22, bold: 1 / 14 };

/**
 * 見本の字（不透明な黒）を、太さを変えて新しいキャンバスに描く。
 * ふとい＝ふちを同じ色でなぞって太らせる、ほそい＝ふちを消して細らせる（どのフォントでも効く）
 */
function guideShape(ch: string, font: string, w: number, h: number, weight: Weight): [HTMLCanvasElement, number, number] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.font = font;
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineJoin = 'round';
  const edge = GUIDE_EDGE[weight] * w;
  // 英語は4本線のきまりで描く（太さもいっしょに）
  if (lang === 'en') {
    const [ex, ey] = drawEnGlyph(g, ch, w / 2, enLines(g, h), edge > 0 ? { stroke: edge } : { erase: -edge });
    return [c, ex, ey];
  }
  const [x, y] = placeGlyph(g, ch, w, h);
  if (edge > 0) {
    g.lineWidth = edge;
    g.strokeText(ch, x, y);
  } else if (edge < 0) {
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = -edge;
    g.strokeText(ch, x, y);
  }
  return [c, x, y];
}

/** 見本の字を、うすい色（alpha）で target に描く */
function drawGuide(target: CanvasRenderingContext2D, ch: string, font: string, w: number, h: number, alpha: number, weight: Weight): void {
  const [shape] = guideShape(ch, font, w, h, weight);
  target.save();
  target.globalAlpha = alpha;
  target.drawImage(shape, 0, 0);
  target.restore();
}

/** なぞりの当たり判定: 見本の字を太らせて描いた形（PAD_PX 四方の不透明度） */
function traceMask(ch: string, font: string): Uint8ClampedArray | null {
  const c = document.createElement('canvas');
  c.width = PAD_PX;
  c.height = PAD_PX;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  // 見本の形（太さの設定どおり）＋ふちから TRACE_TOLERANCE まで
  const [shape, x, y] = guideShape(ch, font, PAD_PX, PAD_PX, settings.traceWeight);
  g.drawImage(shape, 0, 0);
  const wider = TRACE_TOLERANCE * 2 + Math.max(0, GUIDE_EDGE[settings.traceWeight] * PAD_PX);
  if (lang === 'en') {
    g.fillStyle = '#000';
    drawEnGlyph(g, ch, PAD_PX / 2, enLines(g, PAD_PX), { stroke: wider });
  } else {
    g.font = font;
    g.strokeStyle = '#000';
    g.lineWidth = wider;
    g.lineJoin = 'round';
    g.strokeText(ch, x, y);
  }
  const data = g.getImageData(0, 0, PAD_PX, PAD_PX).data;
  const alpha = new Uint8ClampedArray(PAD_PX * PAD_PX);
  for (let k = 0; k < alpha.length; k++) alpha[k] = data[k * 4 + 3];
  return alpha;
}

/** なぞれているところにキラキラ星を飛ばす（box の中の CSS px で） */
function sparkleAt(box: HTMLElement, x: number, y: number): void {
  for (let k = 0; k < 3; k++) {
    const s = document.createElement('span');
    s.className = 'trace-star';
    s.textContent = Math.random() < 0.5 ? '★' : '✦';
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 60;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    s.style.fontSize = `${22 + Math.random() * 22}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
    s.style.setProperty('--rot', `${(Math.random() - 0.5) * 360}deg`);
    box.append(s);
    window.setTimeout(() => s.remove(), 750);
  }
}

function handwritingArea(answer: string[], fixed: Set<number>, pIdx: number | null, sample: HTMLElement | null, onDone: () => void, hint: Hint, trace = false): HTMLElement {
  const count = answer.length;
  // 1文字ぶんの字。パッドと同じ解像度で持っておき、マスには縮小して写す
  const glyphs = Array.from({ length: count }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = PAD_PX;
    c.height = PAD_PX;
    if (fixed.has(i)) {
      // 「が」など、最初から入っている字は灰色の活字で描いておく
      const g = c.getContext('2d')!;
      g.fillStyle = '#9a8f84';
      g.font = `bold ${PAD_PX * 0.62}px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif`;
      placeGlyph(g, disp(answer[i]), PAD_PX, PAD_PX);
    }
    return c;
  });
  const written = new Array<boolean>(count).fill(false);
  // ヒントで薄く出す字（記録の画像には入れない）
  // なぞりは、はじめから全部のマスにうすい見本の字を出す（ヒントの薄い字と同じしくみ）
  const ghost = Array.from({ length: count }, (_, i) => trace && !fixed.has(i));
  // うすい字の色: なぞりはなぞりやすいよう少し濃く
  const ghostAlpha = trace ? 0.24 : 0.16;
  // ヒントの薄い字は、見本と同じ教科書体で（なぞって書くので字形をそろえる）
  const ghostFont = (px: number) => `600 ${px * (trace ? 0.7 : 0.62)}px "UD Digi Kyokasho NK-B", "UD Digi Kyokasho N-B", "Klee One", "Hiragino Maru Gothic ProN", sans-serif`;

  const cellCanvases: HTMLCanvasElement[] = [];
  const cells = Array.from({ length: count }, (_, i) => {
    const canvas = h('canvas', { class: 'hw-canvas' });
    cellCanvases.push(canvas);
    if (fixed.has(i)) return h('span', { class: 'hw-cell fixed' }, canvas);
    return h('button', { class: 'hw-cell', 'aria-label': `${i + 1}もじめ をかく`, onclick: () => openPad(i) }, canvas);
  });

  const paintCell = (i: number) => {
    const c = cellCanvases[i];
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    // 英語は4本線（カラーマスの代わり）
    if (lang === 'en' && !fixed.has(i)) drawEnLines(ctx, 0, c.width, enLines(ctx, c.height), Math.max(1, c.height / 80));
    if (ghost[i]) {
      drawGuide(ctx, disp(answer[i]), ghostFont(c.width), c.width, c.height, ghostAlpha, trace ? settings.traceWeight : 'normal');
    }
    ctx.drawImage(glyphs[i], 0, 0, c.width, c.height);
    cells[i].classList.toggle('written', written[i]);
  };

  // 1回目＝〇〇の1文字目、2回目＝●●の1文字目を薄く出す（単語は1回）。なぞって書ける
  const starts = partStarts(answer, pIdx);
  let step = 0;
  hint.show = () => {
    if (trace) return false;
    const part = step;
    const i = starts[step++];
    ghost[i] = true;
    paintCell(i);
    hint.onReveal?.(part);
    return step < starts.length;
  };

  /** 次に書く字（固定のマスは飛ばす）。なければ -1 */
  const nextIndex = (from: number) => {
    for (let k = from + 1; k < count; k++) if (!fixed.has(k)) return k;
    return -1;
  };

  function openPad(index: number): void {
    let i = index;
    const pad = h('canvas', { class: 'pad-canvas', width: String(PAD_PX), height: String(PAD_PX) });
    const ctx = pad.getContext('2d')!;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2B2B2B';
    ctx.lineWidth = PAD_PX * PEN_WIDTH[settings.penWidth];

    const title = h('p', { class: 'pad-title' });
    const padGhost = h('canvas', { class: 'pad-ghost', width: String(PAD_PX), height: String(PAD_PX) });
    const gctx = padGhost.getContext('2d')!;
    const guide = h('div', { class: 'pad-sample' });
    const nextBtn = h('button', { class: 'mid-btn secondary' }, 'つぎのじ');

    const load = () => {
      ctx.clearRect(0, 0, PAD_PX, PAD_PX);
      ctx.drawImage(glyphs[i], 0, 0);
      title.textContent = `${i + 1}もじめ（${i + 1}/${count}）`;
      gctx.clearRect(0, 0, PAD_PX, PAD_PX);
      if (lang === 'en') drawEnLines(gctx, 0, PAD_PX, enLines(gctx, PAD_PX), 5);
      mask = trace && !fixed.has(i) ? traceMask(disp(answer[i]), ghostFont(PAD_PX)) : null;
      if (ghost[i]) {
        drawGuide(gctx, disp(answer[i]), ghostFont(PAD_PX), PAD_PX, PAD_PX, trace ? 0.2 : 0.12, trace ? settings.traceWeight : 'normal');
      }
      // 見本あり のときだけ、書く字の見本を横に出す（なぞりはパッドの中に字があるので出さない）
      const showGuide = settings.prompt === 'look' && !trace;
      if (showGuide && i === pIdx) guide.replaceChildren(particleBadge(disp(answer[i])));
      else guide.textContent = showGuide ? disp(answer[i]) : '';
      guide.hidden = !showGuide;
      guide.classList.toggle('particle', i === pIdx);
      nextBtn.hidden = nextIndex(i) < 0;
      cells.forEach((c, k) => c.classList.toggle('selected', k === i));
    };
    const save = () => {
      const g = glyphs[i].getContext('2d')!;
      g.clearRect(0, 0, PAD_PX, PAD_PX);
      g.drawImage(pad, 0, 0);
      paintCell(i);
    };

    let drawing = false;
    let mask: Uint8ClampedArray | null = null;
    let lastStar = 0;
    // なぞりで、字の上を書いている間はキラキラ星と音
    const sparkle = (e: PointerEvent, x: number, y: number) => {
      if (!mask) return;
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= PAD_PX || py >= PAD_PX || mask[py * PAD_PX + px] < 128) return;
      const now = performance.now();
      if (now - lastStar < 45) return;
      lastStar = now;
      const box = pad.parentElement!;
      const r = box.getBoundingClientRect();
      sparkleAt(box, e.clientX - r.left, e.clientY - r.top);
      sfx('sparkle', 0.6, undefined, 110);
    };
    const point = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * PAD_PX, ((e.clientY - r.top) / r.height) * PAD_PX] as const;
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      drawing = true;
      written[i] = true;
      const [x, y] = point(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      sparkle(e, x, y);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const [x, y] = point(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      sparkle(e, x, y);
    });
    const end = () => { if (drawing) { drawing = false; save(); } };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    const close = () => {
      save();
      cells.forEach((c) => c.classList.remove('selected'));
      overlay.remove();
    };
    // けしごむ: いま開いている1文字をまるごと消す
    const erase = () => {
      ctx.clearRect(0, 0, PAD_PX, PAD_PX);
      written[i] = false;
      save();
    };
    nextBtn.addEventListener('click', () => {
      save();
      i = nextIndex(i);
      load();
    });

    const overlay = h(
      'div',
      { class: 'overlay pad-overlay' },
      h(
        'div',
        { class: `pad-dialog ${lang === 'en' ? 'en' : ''}` },
        title,
        h('div', { class: 'pad-row' }, guide, h('div', { class: 'pad-box' }, padGhost, pad)),
        h(
          'div',
          { class: 'dialog-buttons' },
          h('button', { class: 'mid-btn secondary', onclick: erase }, 'けしごむ'),
          nextBtn,
          h('button', { class: 'mid-btn primary', onclick: close }, 'とじる'),
        ),
      ),
    );
    app.append(overlay);
    load();
  }

  const doneBtn = h('button', {
    class: 'mid-btn primary',
    onclick: () => {
      if (written.some(Boolean)) void saveWriting(glyphs, disp(answer.join(''))).catch(() => undefined);
      onDone();
    },
  }, 'できた');

  // マスは画面に出てから大きさが決まるので、大きさが決まった（変わった）ときに描く
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const i = cellCanvases.indexOf(e.target as HTMLCanvasElement);
      if (i >= 0) paintCell(i);
    }
  });
  cellCanvases.forEach((c) => ro.observe(c));
  // 画面に出た直後にも一度描く（表示が止まっている環境では上の通知が来ないことがある）
  setTimeout(() => cellCanvases.forEach((_, i) => paintCell(i)), 0);

  return h(
    'div',
    { class: `input-area handwriting ${trace ? 'trace' : ''} ${lang === 'en' ? 'en' : ''}` },
    // 見本はマスの真上に置いて、1文字ずつ見比べられるようにする（見本もカラーマス）
    sample && (sample.classList.add('masu-row'), sample),
    h('div', { class: 'hw-cells' }, ...cells),
    h('p', { class: 'hw-help' }, trace ? 'ますを タップして なぞろう' : 'ますを タップして かこう'),
    h('div', { class: 'hw-buttons' }, doneBtn),
  );
}

// ------------------------------------------------------------ おわり

function finishScreen(): void {
  stopBgm();
  playJingle('finish');
  // スタンプ画像は tools/ui_from_library.py が作る（animal school の動物）。なければ絵文字
  const stamps = ['1', '2', '3', '4'];
  const stampEmoji: Record<string, string> = { '1': '⭐', '2': '💗', '3': '🌸', '4': '👍' };
  show(
    h(
      'main',
      { class: 'screen finish' },
      confetti(),
      hanamaru('finish-hanamaru pop'),
      h('p', { class: 'finish-msg' }, letters('よく がんばったね！', 'kt-jump')),
      h(
        'div',
        { class: 'stamps' },
        ...stamps.map((s, i) => {
          const p = picture(`stamp_${s}`, emoji(stampEmoji[s]), 'stamp');
          p.style.animationDelay = `${0.6 + i * 0.35}s`;
          return p;
        }),
      ),
      h('button', { class: 'big-btn primary', onclick: startScreen }, 'おわり'),
    ),
  );
}

/** おわりの画面の紙ふぶき（CSS で降らせる） */
function confetti(): HTMLElement {
  const colors = ['#ff9f1c', '#4aa3df', '#5cb85c', '#f06292', '#ffd54f', '#9575cd'];
  return h('div', { class: 'confetti', 'aria-hidden': 'true' },
    ...Array.from({ length: 36 }, (_, i) => {
      const s = h('span', { class: 'confetti-piece' });
      s.style.left = `${Math.random() * 100}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 1.2}s`;
      s.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
      s.style.setProperty('--sway', `${(Math.random() - 0.5) * 120}px`);
      s.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540)}deg`);
      return s;
    }));
}

// ------------------------------------------------------------ 暗証番号

function pinScreen(): void {
  stopBgm(); // 先生用の画面は無音
  show(h('main', { class: 'screen pin' }, backButton(startScreen), ...pinPad(settingsScreen)));
}

/** 暗証番号の入力（題・点・数字キー）。合っていたら onOk */
function pinPad(onOk: () => void): HTMLElement[] {
  let entered = '';
  const dots = h('div', { class: 'pin-dots' }, ...Array.from({ length: 4 }, () => h('span', { class: 'pin-dot' })));
  const paint = () =>
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i < entered.length));

  const tap = (d: string) => {
    if (entered.length >= 4) return;
    entered += d;
    paint();
    if (entered.length === 4) {
      if (entered === settings.pin) {
        onOk();
      } else {
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
        window.setTimeout(() => { entered = ''; paint(); }, 400);
      }
    }
  };

  const pad = h(
    'div',
    { class: 'pin-pad' },
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) =>
      h('button', { class: 'pin-key', onclick: () => tap(d) }, d),
    ),
    h('span'),
    h('button', { class: 'pin-key', onclick: () => tap('0') }, '0'),
    h('button', { class: 'pin-key', onclick: () => { entered = entered.slice(0, -1); paint(); } }, '⌫'),
  );

  return [h('p', { class: 'pin-title' }, 'あんしょうばんごう'), dots, pad];
}

// ------------------------------------------------------------ 設定（先生用）

// 設定はタブで分ける（2026-10-27）: 共通／ひらがな カタカナ／アルファベット／線なぞり
type SettingTab = 'common' | 'ja' | 'en' | 'line';
const SETTING_TABS: [SettingTab, string][] = [['common', '共通'], ['ja', 'ひらがな カタカナ'], ['en', 'アルファベット'], ['line', '線なぞり']];
/** さいごに開いたタブ（設定画面を開き直しても同じタブ） */
let settingTab: SettingTab = 'common';

/**
 * 設定のタブと中身（設定画面と、問題中の設定モーダルで共通）。
 * extra はタブの下に足す行（設定画面だけ: 出題する問題・暗証番号など）
 */
function settingPanel(extra: Partial<Record<SettingTab, HTMLElement[]>> = {}, first?: SettingTab): HTMLElement {
  if (first) settingTab = first;
  const rows = settingRows();
  const body = h('div', { class: 'setting-body' });
  const tabs = h('div', { class: 'seg setting-tabs' });
  const paint = () => {
    Array.from(tabs.children).forEach((b, i) => b.classList.toggle('on', SETTING_TABS[i][0] === settingTab));
    body.replaceChildren(...rows[settingTab], ...(extra[settingTab] ?? []));
  };
  for (const [id, label] of SETTING_TABS) {
    tabs.append(h('button', { class: 'seg-btn', onclick: () => { settingTab = id; paint(); } }, label));
  }
  paint();
  return h('div', { class: 'setting-panel' }, tabs, body);
}

/** 遊び方の設定の行（タブごと） */
function settingRows(): Record<SettingTab, HTMLElement[]> {
  const choice = <K extends keyof Settings>(key: K, label: string, options: [Settings[K], string][]) => {
    const group = h('div', { class: 'seg' });
    const paint = () =>
      Array.from(group.children).forEach((b, i) => b.classList.toggle('on', options[i][0] === settings[key]));
    for (const [value, text] of options) {
      group.append(
        h('button', { class: 'seg-btn', onclick: () => { settings = { ...settings, [key]: value }; saveSettings(settings); setSound(settings.sound, VOLUME_LEVEL[settings.volume]); paint(); } }, text),
      );
    }
    paint();
    return h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, label), group);
  };
  return {
    // ひらがな カタカナ と アルファベット の両方に効くもの・音・ミニゲーム
    common: [
      choice('input', '入力方法', [['keyboard', 'キーボード'], ['handwriting', 'てがき'], ['trace', 'なぞり']]),
      choice('prompt', '出題', [['look', '① 見本あり'], ['listen', '② 読み上げのみ'], ['picture', '③ 絵だけ']]),
      choice('keySet', 'キーボードの字', [['all', '50音／ぜんぶ'], ['k25', '25音／20もじ'], ['k10', '10音／10もじ'], ['answer', '答えの字だけ']]),
      choice('traceWeight', 'なぞりの見本の太さ', [['thin', 'ほそい'], ['normal', 'ふつう'], ['bold', 'ふとい']]),
      choice('penWidth', 'ペンの太さ', [['thin', 'ほそい'], ['normal', 'ふつう'], ['bold', 'ふとい']]),
      choice('sound', 'おと（BGM）', [[true, 'あり'], [false, 'なし']]),
      choice('volume', '音量', [['low', '小'], ['mid', '中'], ['high', '大']]),
      choice('minigame', 'ミニゲーム', [[true, 'あり（問題の前に毎回）'], [false, 'なし']]),
      minigameKindsRow(),
    ],
    ja: [
      choice('script', '文字', [['hira', 'ひらがな'], ['kata', 'カタカナ']]),
      choice('aColumn', 'あ行の位置', [['right', '右はし（50音表と同じ）'], ['left', '左はし']]),
      choice('particleMode', 'ぶん・きもちの じょし', [['ga', '「が」'], ['ha', '「は」（わ と よむ）'], ['mix', '「が」「は」こうたい']]),
      choice('particleInput', '文の「が」「は」', [[false, '最初から入れておく'], [true, '子どもが打つ・書く']]),
    ],
    en: [
      choice('letterCase', 'えいごの 文字', [['lower', 'こもじ（abc）'], ['upper', 'おおもじ（ABC）']]),
      enVoiceRow(),
    ],
    line: [
      choice('lineWeight', '線の見本の太さ', [['thin', 'ほそい'], ['normal', 'ふつう'], ['bold', 'ふとい']]),
      choice('lineHint', 'はじめのヒント', [[true, 'あり（問題を出したら1回）'], [false, 'なし']]),
      choice('lineCount', '1回の数', [[5, '5こ'], [10, '10こ'], [20, '20こ（ぜんぶ）']]),
      h('p', { class: 'q-note' }, 'ペンの太さは「共通」で変えられます。'),
    ],
  };
}

/**
 * 英語の声を選ぶ・ためす（2026-10-27 iPad で英語が鳴らなかった件）。
 * じどう＝ふつうに話す声（Samantha など）を名前でさがし、なければ iPad にまかせる
 */
function enVoiceRow(): HTMLElement {
  const sel = h('select', { class: 'voice-select', 'aria-label': 'えいごの こえ' });
  const fill = () => {
    const now = currentEnglishVoice();
    sel.replaceChildren(
      h('option', { value: '' }, `じどう${!settings.enVoice ? `（${now || 'iPad にまかせる'}）` : ''}`),
      ...englishVoices().map((v) => h('option', { value: v.name }, `${v.name}（${v.lang}）`)),
    );
    sel.value = settings.enVoice;
  };
  fill();
  // iPad は声の一覧があとから届くことがある
  if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { if (sel.isConnected) fill(); });
  sel.addEventListener('change', () => {
    settings = { ...settings, enVoice: sel.value };
    saveSettings(settings);
    setEnglishVoice(sel.value);
    fill();
  });
  const test = h('button', { class: 'seg-btn', onclick: () => { unlockSpeech(); speak('Hello. Dog, cat.', undefined, undefined, 'en'); } }, '▶ ためす');
  return h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'えいごの こえ'), h('div', { class: 'seg' }, sel, test));
}

function settingsScreen(): void {
  const pinInput = h('input', { class: 'pin-input', inputmode: 'numeric', maxlength: '4', placeholder: '4けた', autocomplete: 'off' });
  const pinMsg = h('span', { class: 'pin-msg' });
  const pinSave = h('button', {
    class: 'seg-btn',
    onclick: () => {
      const v = pinInput.value.trim();
      if (!/^\d{4}$/.test(v)) { pinMsg.textContent = '数字4けたで入れてください'; return; }
      settings = { ...settings, pin: v };
      saveSettings(settings);
      pinInput.value = '';
      pinMsg.textContent = '変更しました';
    },
  }, '変更');

  // 出題する問題は、タブごと（ひらがな カタカナ／アルファベット／線なぞり）に選ぶ（2026-10-27）
  const qRow = (group: QGroup, text: string) =>
    h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, '出題する問題'),
      h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => questionsScreen(group === 'line' ? 'line' : 'mono', '', group) }, text)));
  show(
    h(
      'main',
      { class: 'screen settings' },
      backButton(startScreen),
      h('h2', {}, '設定（先生用）'),
      settingPanel({
        ja: [qRow('ja', '選ぶ・写真・JSONの読み込み')],
        en: [qRow('en', '選ぶ（もの・うごき・アルファベット）')],
        line: [qRow('line', '選ぶ（20この形）')],
        common: [
        h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'てがきのきろく'),
          h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => void writingsScreen() }, '見る・書き出す'))),
        h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'ワークシート'),
          h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => { worksheetBack = settingsScreen; worksheetScreen(); } }, '作る・印刷する'))),
        h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, '暗証番号'), h('div', { class: 'seg' }, pinInput, pinSave, pinMsg)),
        ],
      }),
    ),
  );
}

/** ミニゲームの種類（複数選べる。0にはできない） */
function minigameKindsRow(): HTMLElement {
  const group = h('div', { class: 'seg' });
  const paint = () =>
    Array.from(group.children).forEach((b, i) => b.classList.toggle('on', settings.minigameKinds.includes(MINIGAMES[i].id)));
  for (const m of MINIGAMES) {
    group.append(h('button', {
      class: 'seg-btn',
      onclick: () => {
        const has = settings.minigameKinds.includes(m.id);
        if (has && settings.minigameKinds.length === 1) return; // 最後の1つは外せない（なしは上で選ぶ）
        settings = { ...settings, minigameKinds: has ? settings.minigameKinds.filter((k) => k !== m.id) : [...settings.minigameKinds, m.id] };
        saveSettings(settings);
        paint();
      },
    }, m.label));
  }
  paint();
  return h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'ミニゲームの種類'), group);
}

// ------------------------------------------------------------ 出題する問題（先生用）

/** 出題する問題の画面のまとまり（設定のタブと同じ） */
type QGroup = 'ja' | 'en' | 'line';

function groupQuestions(group: QGroup, cat: Category): Question[] {
  if (group === 'en') return enQuestions(cat);
  if (group === 'line') return LINE_QUESTIONS;
  return allQuestions(cat);
}

/**
 * 出題する問題を選ぶ（先生用）。2026-10-27: 英語・線なぞり も選べるように。
 * 写真・JSON の読み込み／書き出し・けす は日本語だけ（英語の絵は日本語の問題の絵・写真を使う）
 */
function questionsScreen(cat: Category, message = '', group: QGroup = 'ja'): void {
  stopBgm();
  const rerender = (msg = '') => questionsScreen(cat, msg, group);
  const list = groupQuestions(group, cat);
  const onCount = list.filter((q) => isEnabled(q.id)).length;
  const ja = group === 'ja';

  const cats = group === 'en' ? enCategories() : group === 'line' ? [] : CATEGORIES;
  const tabs = h(
    'div',
    { class: 'seg' },
    ...cats.map((c) => {
      const all = groupQuestions(group, c.id);
      const on = all.filter((q) => isEnabled(q.id)).length;
      return h('button', { class: `seg-btn ${c.id === cat ? 'on' : ''}`, onclick: () => questionsScreen(c.id, '', group) }, `${c.label}  ${on}/${all.length}`);
    }),
  );

  // JSON 読み込み（iPad では「ファイル」アプリから選べる）
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-input' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importDialog(parseImport(await file.text()), rerender);
  });

  const exportBtn = h('button', {
    class: 'seg-btn',
    onclick: async () => {
      const blob = await exportJson();
      const d = new Date();
      const name = `moji-uchi-questions-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      // iPad は共有シートから「ファイルに保存」や AirDrop で渡せる。使えない環境ではダウンロード
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined);
      } else {
        const a = h('a', { href: URL.createObjectURL(blob), download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    },
  }, 'JSONに書き出す');

  const cards = list.map((q) => {
    const on = isEnabled(q.id);
    const photoInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden-input' });
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files?.[0];
      if (!f) return;
      const note = document.querySelector('.q-note');
      if (note) note.textContent = '写真を読み込んでいます…';
      try {
        await attachPhoto(q.id, f);
        rerender(`「${q.hira}」に写真を付けました`);
      } catch {
        rerender('写真を読み込めませんでした');
      }
    });
    const stop = (fn: () => void) => (e: Event) => { e.stopPropagation(); fn(); };
    return h(
      'div',
      { class: `q-card ${on ? 'on' : 'off'}`, role: 'button', 'aria-pressed': String(on), onclick: () => { setEnabled([q.id], !on); rerender(); } },
      h('span', { class: 'q-card-mark' }, on ? '✓' : ''),
      questionPicture(q, 'q-card-pic'),
      h('span', { class: 'q-card-word' }, ja ? q.hira : dispQ(q, q.hira)),
      q.kana ? h('span', { class: 'q-card-kana' }, q.kana) : null,
      (ja || !q.builtin) && h(
        'div',
        { class: 'q-card-tools' },
        photoInput,
        h('button', { class: 'mini-btn', onclick: stop(() => photoInput.click()) }, hasPhoto(q.id) ? '写真を変える' : '写真'),
        hasPhoto(q.id) && h('button', { class: 'mini-btn', onclick: stop(() => void removePhoto(q.id).then(() => rerender())) }, '写真をはずす'),
        !q.builtin && h('button', {
          class: 'mini-btn danger',
          onclick: stop(() => { if (confirm(`「${q.hira}」を消しますか？`)) void deleteCustom(q.id).then(() => rerender()); }),
        }, 'けす'),
      ),
    );
  });

  show(
    h(
      'main',
      { class: 'screen questions' },
      backButton(() => { settingTab = group; settingsScreen(); }, '設定へ'),
      h('h2', {}, `出題する問題（${group === 'en' ? 'アルファベット' : group === 'line' ? '線なぞり' : 'ひらがな カタカナ'}）`),
      tabs,
      h(
        'div',
        { class: 'seg toolbar' },
        h('button', { class: 'seg-btn', onclick: () => { setEnabled(list.map((q) => q.id), true); rerender(); } }, 'ぜんぶ ON'),
        h('button', { class: 'seg-btn', onclick: () => { setEnabled(list.map((q) => q.id), false); rerender(); } }, 'ぜんぶ OFF'),
        group !== 'line' && h('button', { class: 'seg-btn create', onclick: () => createDialog(group === 'en' ? 'en' : 'ja', cat, rerender) }, '＋ つくる'),
        ja && fileInput,
        ja && h('button', { class: 'seg-btn', onclick: () => fileInput.click() }, 'JSONを読み込む'),
        ja && exportBtn,
      ),
      h('p', { class: 'q-note' },
        message || (group === 'line'
          ? `タップで ON/OFF。ON の形から、設定の「1回の数」だけ やさしい順に出します（いま ${onCount}こ）。`
          : `タップで ON/OFF。ON の問題から1回に最大10問を出します（いま ${onCount}問）。${ja ? `単語は${MAX_CHARS}文字まで。` : '最初からある英語の問題の絵・写真は「ひらがな カタカナ」の同じ絵の問題で変えます（「＋ つくる」で作った問題は ここで変えられます）。'}`)),
      onCount === 0 && h('p', { class: 'q-note warn' }, group === 'line' ? 'ON の形がないので、「せんの れんしゅう」は押せません' : 'このカテゴリは ON の問題がないので、子どもの画面で選べません'),
      h('div', { class: 'q-grid' }, ...cards),
    ),
  );
}

/**
 * 先生が問題を作る（2026-10-27）: 写真（iPad の写真・その場で撮る）＋言葉＋よみかた。英語は 日本語・カタカナも。
 * よみかた があれば、言葉のかわりにそれを読む（名前のアクセント・ローマ字の名前など）
 */
function createDialog(lang: 'ja' | 'en', cat: Category, done: (msg: string) => void): void {
  const cats: [Category, string][] = lang === 'en' ? [['mono', 'もの'], ['ugoki', 'うごき']] : [['mono', 'もの'], ['kimochi', 'きもち'], ['ugoki', 'うごき']];
  let category: Category = cats.some(([c]) => c === cat) ? cat : 'mono';
  let photo: Blob | null = null;

  const field = (label: string, input: HTMLElement, note = '') =>
    h('label', { class: 'create-field' }, h('span', { class: 'create-label' }, label), input, note ? h('small', {}, note) : null);
  const text = (placeholder: string) => h('input', { type: 'text', class: 'create-input', placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const word = text(lang === 'en' ? '例: taro' : '例: たろうくん');
  const ja = text('例: たろう');
  const kana = text('例: タロウ');
  const reading = text(lang === 'en' ? '例: taro（英語の声で読む文字）' : '例: たろーくん');

  const catSeg = h('div', { class: 'seg' });
  const paintCat = () => catSeg.replaceChildren(...cats.map(([c, label]) =>
    h('button', { class: `seg-btn ${c === category ? 'on' : ''}`, type: 'button', onclick: () => { category = c; paintCat(); } }, label)));
  paintCat();

  const preview = h('div', { class: 'create-photo' }, h('span', {}, 'しゃしん なし'));
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden-input' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    photo = f;
    preview.replaceChildren(h('img', { src: URL.createObjectURL(f), alt: '' }));
  });

  const test = h('button', {
    class: 'seg-btn', type: 'button',
    onclick: () => {
      unlockSpeech();
      const t = reading.value.trim() || word.value.trim();
      if (t) speak(t, undefined, undefined, lang === 'en' ? 'en' : 'ja');
    },
  }, '▶ ためす');

  const msg = h('p', { class: 'create-msg' });
  const save: HTMLButtonElement = h('button', {
    class: 'mid-btn primary', type: 'button',
    onclick: async () => {
      save.disabled = true;
      msg.textContent = 'ほぞんしています…';
      try {
        const r = await addCustom({ lang, category, word: word.value, ja: ja.value, kana: kana.value, reading: reading.value, photo });
        if ('error' in r) {
          msg.textContent = r.error;
          return;
        }
        overlay.remove();
        done(`「${word.value.trim()}」をつくりました`);
      } catch {
        msg.textContent = 'ほぞんできませんでした（写真が読めないときは、ほかの写真で ためしてください）';
      } finally {
        save.disabled = false;
      }
    },
  }, 'ほぞん');

  const overlay = h('div', { class: 'overlay create-overlay' },
    h('div', { class: 'dialog create-dialog' },
      h('h2', {}, lang === 'en' ? 'えいごの もんだいを つくる' : 'もんだいを つくる'),
      h('div', { class: 'create-body' },
        h('div', { class: 'create-left' }, preview, fileInput,
          h('button', { class: 'seg-btn', type: 'button', onclick: () => fileInput.click() }, '写真をえらぶ・とる')),
        h('div', { class: 'create-right' },
          field('しゅるい', catSeg),
          field(lang === 'en' ? 'えいご' : 'ことば', word, lang === 'en' ? `a〜z の${MAX_CHARS}文字まで` : `ひらがな・カタカナ ${MAX_CHARS}文字まで（カタカナはひらがなにそろえます）`),
          lang === 'en' ? field('にほんご', ja, '「いぬ は dog」の画面で使うひらがな') : null,
          lang === 'en' ? field('カタカナの よみかた', kana, 'ことばの下に出す（なくてもよい）') : null,
          field('よみかた（なくてもよい）', h('div', { class: 'create-inline' }, reading, test),
            lang === 'en' ? '英語の声がうまく読めないとき、聞こえ方に近いつづりを入れる' : '読みまちがえるとき（名前のアクセント・「は」の読みなど）に入れる'))),
      msg,
      h('div', { class: 'dialog-buttons' },
        h('button', { class: 'mid-btn secondary', type: 'button', onclick: () => overlay.remove() }, 'やめる'),
        save)));
  app.append(overlay);
  word.focus();
}

function importDialog(plan: ImportPlan, done: (msg: string) => void): void {
  const n = plan.items.length;
  const errs = plan.errors;
  const run = async (mode: 'add' | 'replace') => {
    overlay.remove();
    const count = await applyImport(plan, mode);
    done(`${count}問を${mode === 'add' ? '追加' : '入れ替え'}しました${errs.length ? `（読み込めなかった ${errs.length}件は除きました）` : ''}`);
  };
  const overlay = h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'dialog import-dialog' },
      h('p', {}, n ? `${n}問を読み込めます` : '読み込める問題がありません'),
      errs.length > 0 && h('div', { class: 'import-errors' },
        h('strong', {}, `読み込めないもの ${errs.length}件`),
        ...errs.slice(0, 8).map((e) => h('div', {}, e)),
        errs.length > 8 && h('div', {}, `ほか ${errs.length - 8}件`)),
      n > 0 && h('p', { class: 'import-help' }, '追加する＝今の問題に足す／入れ替える＝読み込んだ問題だけを出題する'),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', { class: 'mid-btn secondary', onclick: () => overlay.remove() }, 'やめる'),
        n > 0 && h('button', { class: 'mid-btn primary', onclick: () => void run('add') }, '追加する'),
        n > 0 && h('button', { class: 'mid-btn primary', onclick: () => void run('replace') }, '入れ替える'),
      ),
    ),
  );
  app.append(overlay);
}

// ------------------------------------------------------------ 手書きの記録（先生用）

async function writingsScreen(message = ''): Promise<void> {
  stopBgm();
  let ws: Awaited<ReturnType<typeof listWritings>> = [];
  try {
    ws = await listWritings();
  } catch {
    message = 'この端末では記録を読めませんでした';
  }
  const urls: string[] = [];
  const leave = (to: () => void) => () => { urls.forEach((u) => URL.revokeObjectURL(u)); to(); };

  const cards = ws.map((w) => {
    const url = URL.createObjectURL(w.png);
    urls.push(url);
    const d = new Date(w.createdAt);
    return h(
      'div',
      { class: 'w-card' },
      h('img', { src: url, alt: `${w.word} のてがき`, class: 'w-img' }),
      h('div', { class: 'w-meta' },
        h('span', { class: 'w-word' }, w.word),
        h('span', { class: 'w-date' }, `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)),
      h('div', { class: 'q-card-tools' },
        h('button', { class: 'mini-btn', onclick: () => void exportWritings([w]) }, '書き出す'),
        h('button', {
          class: 'mini-btn danger',
          onclick: () => { if (confirm('この記録を消しますか？')) void deleteWriting(w.key).then(leave(() => void writingsScreen())); },
        }, 'けす')),
    );
  });

  show(
    h(
      'main',
      { class: 'screen questions writings' },
      backButton(leave(settingsScreen), '設定へ'),
      h('h2', {}, 'てがきのきろく'),
      h('div', { class: 'seg toolbar' },
        h('button', { class: 'seg-btn', disabled: ws.length === 0, onclick: () => void exportWritings(ws) }, `ぜんぶ書き出す（${ws.length}件）`),
        h('button', {
          class: 'seg-btn',
          disabled: ws.length === 0,
          onclick: () => { if (confirm(`記録 ${ws.length}件をすべて消しますか？`)) void clearWritings().then(leave(() => void writingsScreen('すべて消しました'))); },
        }, 'ぜんぶけす')),
      h('p', { class: 'q-note' },
        message || `てがきモードで「できた」を押した問題を、新しい順に最大${MAX_WRITINGS}件まで残します（古いものから消えます）。iPad では共有から「画像を保存」「ファイルに保存」ができます。`),
      ws.length === 0 && h('p', { class: 'q-note' }, 'まだ記録がありません'),
      h('div', { class: 'w-grid' }, ...cards),
    ),
  );
}

// ------------------------------------------------------------ 視写ワークシート（先生用・印刷）
// iPad で遊んだあとに鉛筆で書く用。A4 縦に5問。1問＝絵＋見本の行（教科書体）＋書く行（十字の補助線）。

const LAST_ROUND_KEY = 'moji-uchi-game/last-round';

/** ワークシート画面の「もどる」の行き先（設定から来たか、プリントから来たか） */
let worksheetBack: () => void = settingsScreen;

// ------------------------------------------------------------ プリント（スタート画面から）
// ストック＝いつでも使えるプリント。2026-10-27 からは、ボタンを押したときにアプリの中で PDF を作る
//   （オリジナルと同じ描き方。ひらがな カタカナ／英語／線なぞり × みてかく／なぞる × ふつう／おおきい）。
//   前の public/worksheets/ の PDF（tools/make_worksheets.py）はもう使っていない
// オリジナル＝さいごに遊んだ問題で作るワークシート（設定の「ワークシート」と同じ画面）

type StockGroup = 'ja' | 'en' | 'line';
interface StockSet {
  key: string;
  label: string;
  pic: () => HTMLElement;
  qs: () => Question[];
}

const builtinOf = (cat: Category) => allQuestions(cat).filter((q) => q.builtin);
const catPic = (cat: string) => () => picture(`cat_${cat}`, () => h('span'), 'stock-pic');

const STOCK_SETS: Record<StockGroup, StockSet[]> = {
  ja: [
    { key: 'mono', label: 'もの', pic: catPic('mono'), qs: () => builtinOf('mono') },
    { key: 'kimochi', label: 'きもち', pic: catPic('kimochi'), qs: () => builtinOf('kimochi') },
    { key: 'ugoki', label: 'うごき', pic: catPic('ugoki'), qs: () => builtinOf('ugoki') },
    { key: 'bun', label: 'ぶん', pic: catPic('bun'), qs: () => builtinOf('bun') },
    { key: 'bunkimochi', label: 'ぶん・きもち「が」', pic: catPic('bunkimochi'), qs: () => builtinOf('bunkimochi').map((q) => withParticle(q, 'が')) },
    { key: 'bunkimochi_ha', label: 'ぶん・きもち「は」', pic: catPic('bunkimochi'), qs: () => builtinOf('bunkimochi').map((q) => withParticle(q, 'は')) },
  ],
  en: [
    { key: 'mono', label: 'もの', pic: catPic('mono'), qs: () => enQuestions('mono') },
    { key: 'ugoki', label: 'うごき', pic: catPic('ugoki'), qs: () => enQuestions('ugoki') },
    { key: 'abc', label: 'アルファベット', pic: () => h('div', { class: 'picture stock-pic abc-cat' }, h('span', { class: 'abc-cat-text' }, 'Aa')), qs: () => ALPHABET_QUESTIONS },
  ],
  line: [
    { key: 'easy', label: 'やさしい 10こ', pic: () => h('div', { class: 'picture stock-pic line-pic' }, shapeThumb(LINE_SHAPES[0].pts)), qs: () => LINE_QUESTIONS.slice(0, 10) },
    { key: 'hard', label: 'むずかしい 10こ', pic: () => h('div', { class: 'picture stock-pic line-pic' }, shapeThumb(LINE_SHAPES[16].pts)), qs: () => LINE_QUESTIONS.slice(10) },
    { key: 'all', label: 'ぜんぶ 20こ', pic: () => h('div', { class: 'picture stock-pic line-pic' }, shapeThumb(LINE_SHAPES[8].pts)), qs: () => LINE_QUESTIONS },
  ],
};

/** ボタンの種類: [字の種類, みてかく／なぞる, ボタンの字] */
type StockVariant = { script?: 'hira' | 'kata'; upper?: boolean; kind: 'copy' | 'trace'; label: string; file: string };
const STOCK_VARIANTS: Record<StockGroup, StockVariant[]> = {
  ja: [
    { script: 'hira', kind: 'copy', label: 'ひらがな みてかく', file: 'hira-copy' },
    { script: 'hira', kind: 'trace', label: 'ひらがな なぞる', file: 'hira-trace' },
    { script: 'kata', kind: 'copy', label: 'カタカナ みてかく', file: 'kata-copy' },
    { script: 'kata', kind: 'trace', label: 'カタカナ なぞる', file: 'kata-trace' },
  ],
  en: [
    { upper: false, kind: 'copy', label: 'こもじ みてかく', file: 'lower-copy' },
    { upper: false, kind: 'trace', label: 'こもじ なぞる', file: 'lower-trace' },
    { upper: true, kind: 'copy', label: 'おおもじ みてかく', file: 'upper-copy' },
    { upper: true, kind: 'trace', label: 'おおもじ なぞる', file: 'upper-trace' },
  ],
  line: [
    { kind: 'copy', label: 'みてかく', file: 'copy' },
    { kind: 'trace', label: 'なぞる', file: 'trace' },
  ],
};

/** さいごに開いたタブ */
let stockGroup: StockGroup = 'ja';
let stockSize: SheetSize = 'normal';

function printScreen(): void {
  stopBgm();
  show(
    h(
      'main',
      { class: 'screen print-menu' },
      backButton(startScreen),
      h('h2', {}, 'プリント'),
      h('div', { class: 'print-choices' },
        h('button', { class: 'print-choice', onclick: stockScreen },
          h('span', { class: 'print-choice-title' }, 'ストック'),
          h('span', { class: 'print-choice-note' }, 'いつでも つかえる プリント')),
        h('button', { class: 'print-choice', onclick: () => { worksheetBack = printScreen; worksheetScreen(); } },
          h('span', { class: 'print-choice-title' }, 'オリジナル'),
          h('span', { class: 'print-choice-note' }, 'さいごに あそんだ もんだいで'))),
    ),
  );
}

/**
 * ストック: 右に タブ（青: ひらがな カタカナ／英語／線なぞり、緑: ふつう／おおきい）、左に プリントとボタン。
 * ボタンは2段: 1回目で PDF を作り、できたら「ほぞん」（iPad は、時間のかかる処理のあとに共有シートを出すと止められることがあるため）
 */
function stockScreen(): void {
  stopBgm();
  const note = h('p', { class: 'q-note stock-note' });
  const paintNote = () => {
    const per = stockGroup === 'en' ? (stockSize === 'large' ? 2 : 3) : stockSize === 'large' ? 2 : 5;
    const dir = stockGroup === 'en' || stockSize === 'large' ? 'A4 よこ' : 'A4 たて';
    note.textContent = `${dir}・1まいに ${per}もん。ボタンを おすと PDF を つくります。できたら もう一度 おして ほぞん（iPad は「"ファイル"に保存」）。`;
  };

  const button = (set: StockSet, v: StockVariant) => {
    let blob: Blob | null = null;
    const name = `gakkun-stock-${stockGroup}-${set.key}-${v.file}${stockSize === 'large' ? '-large' : ''}.pdf`;
    const btn: HTMLButtonElement = h('button', {
      class: `mid-btn stock-dl ${v.kind}`,
      onclick: async () => {
        if (blob) {
          const how = await savePdf(blob, name);
          note.textContent = how === 'cancelled' ? '保存をやめました' : how === 'shared' ? 'PDFを渡しました（「"ファイル"に保存」を選ぶと iPad に残ります）' : `PDFを保存しました（${name}）`;
          return;
        }
        btn.disabled = true;
        btn.textContent = 'つくっています…';
        try {
          const opts: SheetOptions = { kind: v.kind, size: stockSize, grid: 'cross' };
          const items = await Promise.all(set.qs().map((q) => sheetItem(q, { script: v.script, upper: v.upper })));
          blob = await worksheetPdf(await worksheetPages(items, opts), opts);
          btn.textContent = '⬇ ほぞん';
          btn.classList.add('ready');
        } catch {
          btn.textContent = v.label;
          note.textContent = 'PDFを作れませんでした。もう一度ためしてください';
        } finally {
          btn.disabled = false;
        }
      },
    }, v.label);
    return btn;
  };

  const list = h('div', { class: 'stock-list' });
  const paintList = () => {
    list.replaceChildren(...STOCK_SETS[stockGroup].map((set) =>
      h('div', { class: 'stock-row' },
        set.pic(),
        h('span', { class: 'stock-label' }, set.label, h('small', {}, `${set.qs().length}もん`)),
        h('div', { class: 'stock-btns' }, ...STOCK_VARIANTS[stockGroup].map((v) => button(set, v))))));
    paintNote();
  };

  const groupTabs: [StockGroup, string][] = [['ja', 'ひらがな カタカナ'], ['en', '英語'], ['line', '線なぞり']];
  const sizeTabs: [SheetSize, string][] = [['normal', 'ふつう'], ['large', 'おおきい']];
  const tabs = h('div', { class: 'stock-tabs' });
  const paintTabs = () => {
    tabs.replaceChildren(
      ...groupTabs.map(([id, label]) => h('button', {
        class: `seg-btn tab-blue ${stockGroup === id ? 'on' : ''}`,
        onclick: () => { stockGroup = id; paintTabs(); paintList(); },
      }, label)),
      h('div', { class: 'stock-tab-gap' }),
      ...sizeTabs.map(([id, label]) => h('button', {
        class: `seg-btn tab-green ${stockSize === id ? 'on' : ''}`,
        onclick: () => { stockSize = id; paintTabs(); paintList(); },
      }, label)),
    );
  };
  paintTabs();
  paintList();

  show(
    h(
      'main',
      { class: 'screen print-menu stock-screen' },
      backButton(printScreen),
      h('h2', {}, 'ストック'),
      h('div', { class: 'stock-panel' }, tabs, h('div', { class: 'stock-main' }, note, list)),
    ),
  );
}

function lastRoundIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LAST_ROUND_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

const SHEET_KEY = 'moji-uchi-game/sheet-options';

function loadSheetOptions(): SheetOptions {
  try {
    return { ...DEFAULT_SHEET, ...JSON.parse(localStorage.getItem(SHEET_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SHEET };
  }
}

function saveSheetOptions(o: SheetOptions): void {
  try {
    localStorage.setItem(SHEET_KEY, JSON.stringify(o));
  } catch {
    // 覚えられなくても作れる
  }
}

function worksheetScreen(selected: string[] = lastRoundIds(), cat?: Category, wl?: Lang): void {
  // せんの れんしゅう も選べる（2026-10-27）
  stopBgm();
  // 英語版の問題も選べる（2026-10-27）。日本語と英語は同じプリントにまぜてもよい
  const all = [...allQuestions(), ...EN_QUESTIONS, ...ALPHABET_QUESTIONS, ...LINE_QUESTIONS];
  const sel = selected.filter((id) => all.some((q) => q.id === id));
  // ことば・カテゴリの指定がなければ、選んでいる問題（＝さいごに遊んだ問題）のものを開く
  const first = all.find((q) => q.id === sel[0]);
  const showLang: Lang = wl ?? (first?.lang === 'en' ? 'en' : first?.category === 'line' ? 'line' : 'ja');
  const cats = showLang === 'en' ? enCategories() : showLang === 'line' ? [] : CATEGORIES;
  const showCat: Category = cat && cats.some((c) => c.id === cat) ? cat : first && cats.some((c) => c.id === first.category) ? first.category : 'mono';
  const rerender = (next: string[]) => worksheetScreen(next, showCat, showLang);

  const langTabs = h('div', { class: 'seg' }, ...([['ja', 'ひらがな・カタカナ'], ['en', 'えいご'], ['line', 'せん']] as [Lang, string][]).map(([l, label]) =>
    h('button', { class: `seg-btn ${l === showLang ? 'on' : ''}`, onclick: () => worksheetScreen(sel, showCat, l) }, label)));
  const tabs = h('div', { class: 'seg' }, ...cats.map((c) =>
    h('button', { class: `seg-btn ${c.id === showCat ? 'on' : ''}`, onclick: () => worksheetScreen(sel, c.id, showLang) }, c.label)));

  const list = showLang === 'en' ? enQuestions(showCat) : showLang === 'line' ? LINE_QUESTIONS : applyParticles(allQuestions(showCat));
  const cards = list.map((q) => {
    const on = sel.includes(q.id);
    return h('div', {
      class: `q-card ${on ? 'on' : 'off'}`,
      role: 'button',
      'aria-pressed': String(on),
      onclick: () => rerender(on ? sel.filter((x) => x !== q.id) : [...sel, q.id]),
    },
    h('span', { class: 'q-card-mark' }, on ? String(sel.indexOf(q.id) + 1) : ''),
    questionPicture(q, 'q-card-pic'),
    h('span', { class: 'q-card-word' }, dispQ(q, q.hira)),
    q.kana ? h('span', { class: 'q-card-kana' }, q.kana) : null);
  });

  // 印刷の前に選ぶ: 種類（みてかく／なぞる）・大きさ（ふつう／おおきい）・マス（十字線／カラーマス）
  const opts = loadSheetOptions();
  const pages = pageCount(sel.map((id) => ({ en: all.find((q) => q.id === id)?.lang === 'en' })), opts);
  const pick = <K extends keyof SheetOptions>(key: K, label: string, options: [SheetOptions[K], string][]) =>
    h('div', { class: 'setting-row ws-opt' }, h('span', { class: 'setting-label' }, label),
      h('div', { class: 'seg' }, ...options.map(([v, text]) =>
        h('button', {
          class: `seg-btn ${opts[key] === v ? 'on' : ''}`,
          onclick: () => { saveSheetOptions({ ...opts, [key]: v }); rerender(sel); },
        }, text))));
  show(
    h(
      'main',
      { class: 'screen questions worksheet-pick' },
      backButton(worksheetBack, worksheetBack === settingsScreen ? '設定へ' : 'もどる'),
      h('h2', {}, 'ワークシート（オリジナル）'),
      pick('kind', 'しゅるい', [['copy', 'みてかく（視写）'], ['trace', 'なぞる']]),
      pick('size', 'おおきさ', [['normal', showLang === 'en' ? 'ふつう（A4よこ・3もん）' : 'ふつう（A4たて・5もん）'], ['large', 'おおきい（A4よこ・2もん）']]),
      pick('grid', 'マス', [['cross', 'じゅうじせん'], ['color', 'カラーマス']]),
      h('div', { class: 'setting-row ws-opt' }, h('span', { class: 'setting-label' }, 'ぶん・きもちの じょし'),
        h('div', { class: 'seg' }, ...([['ga', '「が」'], ['ha', '「は」'], ['mix', '「が」「は」こうたい']] as [ParticleMode, string][]).map(([v, text]) =>
          h('button', {
            class: `seg-btn ${settings.particleMode === v ? 'on' : ''}`,
            onclick: () => { settings = { ...settings, particleMode: v }; saveSettings(settings); rerender(sel); },
          }, text)))),
      h('div', { class: 'seg toolbar' },
        h('button', { class: 'seg-btn', onclick: () => rerender(lastRoundIds()) }, 'さいごに遊んだ問題'),
        h('button', { class: 'seg-btn', onclick: () => rerender([]) }, 'えらび直す（ぜんぶ外す）'),
        h('button', { class: 'seg-btn on', disabled: sel.length === 0, onclick: () => worksheetPrint(sel) }, `つぎへ：みる・PDFにする（${sel.length}問・A4 ${pages}枚）`)),
      h('p', { class: 'q-note' }, `タップで選ぶ／外す（番号の順に並びます）。見本は教科書体、文字は設定の「${settings.script === 'kata' ? 'カタカナ' : 'ひらがな'}」。えいごは4本線に、設定の「${settings.letterCase === 'upper' ? 'おおもじ' : 'こもじ'}」で書きます（マスの設定は使いません）。`),
      langTabs,
      tabs,
      h('div', { class: 'q-grid' }, ...cards),
    ),
  );
}

/** 見た目の確認と PDF の保存。確認画面には PDF と同じページの絵を出す。iPad は共有シートの「"ファイル"に保存」 */
/**
 * 問題を、プリントの1問にする（オリジナルとストックで共通）。
 * script／upper を渡すと、設定の ひらがな・カタカナ／こもじ・おおもじ のかわりにそれを使う（ストック）
 */
async function sheetItem(q: Question, over: { script?: 'hira' | 'kata'; upper?: boolean } = {}): Promise<SheetItem> {
  const en = q.lang === 'en';
  const show1 = (s: string) => en
    ? ((over.upper ?? settings.letterCase === 'upper') ? s.toUpperCase() : s)
    : inScript(s, over.script ?? settings.script);
  return {
    chars: q.category === 'line' ? [] : chars(show1(q.hira)),
    shape: q.category === 'line' ? lineShape(q.id)?.pts : undefined,
    particle: particleIndex(q),
    // 先生が付けた写真はその URL を使う
    imageUrl: await questionImageUrl(q),
    // アルファベットは絵の代わりに字
    emoji: isAlphabet(q) ? show1(q.hira) : q.emoji,
    en,
    kana: q.kana,
  };
}

function worksheetPrint(ids: string[]): void {
  const all = [...allQuestions(), ...EN_QUESTIONS, ...ALPHABET_QUESTIONS, ...LINE_QUESTIONS];
  const qs = applyParticles(ids.map((id) => all.find((q) => q.id === id)).filter((q): q is Question => !!q));
  const opts = loadSheetOptions();
  const nPages = pageCount(qs.map((q) => ({ en: q.lang === 'en' })), opts);
  const hasEn = qs.some((q) => q.lang === 'en');
  const hasJa = qs.some((q) => q.lang !== 'en');
  // 英語はいつも A4 よこ（ふつう 3問・おおきい 2問）
  const dir = opts.size === 'large' || !hasJa ? 'A4 よこ' : hasEn ? 'A4 たて・よこ' : 'A4 たて';
  const what = `${opts.kind === 'trace' ? 'なぞる' : 'みてかく'}・${dir} ${nPages}枚・${hasJa ? (opts.grid === 'color' ? 'カラーマス' : 'じゅうじせん') : '4ほんせん'}`;

  const note = h('span', { class: 'ws-bar-note' }, `${what}。ページを作っています…`);
  const pagesBox = h('div', { class: 'ws-pages' });
  let canvases: HTMLCanvasElement[] = [];
  const doPdf: HTMLButtonElement = h('button', {
    class: 'mid-btn primary',
    disabled: true,
    onclick: async () => {
      doPdf.disabled = true;
      note.textContent = 'PDFを作っています…';
      try {
        const blob = await worksheetPdf(canvases, opts);
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const name = `gakkun-${opts.kind === 'trace' ? 'nazori' : 'worksheet'}${opts.size === 'large' ? '-large' : ''}-${ymd}.pdf`;
        const how = await savePdf(blob, name);
        note.textContent = how === 'cancelled' ? '保存をやめました' : how === 'shared' ? 'PDFを渡しました（「"ファイル"に保存」を選ぶと iPad に残ります）' : `PDFを保存しました（${name}）`;
      } catch {
        note.textContent = 'PDFを作れませんでした。もう一度ためしてください';
      } finally {
        doPdf.disabled = false;
      }
    },
  }, 'PDFを保存');
  show(
    h(
      'main',
      { class: 'screen ws-preview' },
      h('div', { class: 'ws-bar no-print' },
        h('button', { class: 'mid-btn secondary', onclick: () => worksheetScreen(ids) }, 'もどる'),
        note,
        doPdf),
      pagesBox,
    ),
  );

  void (async () => {
    const items = await Promise.all(qs.map((q) => sheetItem(q)));
    canvases = await worksheetPages(items, opts);
    pagesBox.replaceChildren(...canvases.map((c) => {
      c.className = `ws-page-img ${c.width > c.height ? 'landscape' : ''}`;
      return c;
    }));
    note.textContent = `${what}。よければ「PDFを保存」`;
    doPdf.disabled = false;
  })().catch(() => { note.textContent = 'ページを作れませんでした。もどって もう一度ためしてください'; });
}

// 教科書体の字は、フォントによってマスの中で少し下に出る。実際の字の形を測って、上下の真ん中にそろえる
// （--kyo-shift を CSS の .sample-cell などが使う。フォントが読み込まれたら測り直す）
function calibrateKyokasho(): void {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--kyokasho').trim();
  const g = document.createElement('canvas').getContext('2d');
  if (!g || !fam) return;
  g.font = `600 100px ${fam}`;
  g.textBaseline = 'alphabetic';
  const sampleChars = Array.from('あいうえおかきくけこさしすせそたなにぬねの');
  const ink = sampleChars.reduce((s, c) => {
    const m = g.measureText(c);
    return s + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  }, 0) / sampleChars.length;
  const m0 = g.measureText('あ');
  if (!Number.isFinite(m0.fontBoundingBoxAscent) || !Number.isFinite(m0.fontBoundingBoxDescent)) return;
  const box = (m0.fontBoundingBoxAscent - m0.fontBoundingBoxDescent) / 2;
  const shift = (box - ink) / 100; // em。プラス＝字が下にずれている → 上へ
  document.documentElement.style.setProperty('--kyo-shift', `${shift.toFixed(3)}em`);
}
calibrateKyokasho();
void document.fonts?.ready.then(calibrateKyokasho);
document.fonts?.addEventListener?.('loadingdone', calibrateKyokasho);

// 写真の一覧を読んでから始める（読めなくても始める）
void loadPhotoIndex().finally(startScreen);
