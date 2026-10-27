import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CATEGORIES, MAX_CHARS, type Category, type Question, withParticle, spokenText, type Particle } from './questions';
import { allQuestions, applyImport, attachPhoto, deleteCustom, enabledQuestions, exportJson, isEnabled, parseImport, setEnabled, type ImportPlan } from './bank';
import { hasPhoto, loadPhotoIndex, photoUrl, removePhoto } from './photos';
import { DEFAULT_SHEET, perPage, savePdf, worksheetPages, worksheetPdf, type SheetOptions } from './worksheet-pdf';
import { clearWritings, deleteWriting, exportWritings, listWritings, MAX_WRITINGS, saveWriting } from './writings';
import { chars, DAKUON, inScript, SEION, SMALL } from './kana';
import { loadSettings, saveSettings, VOLUME_LEVEL, type KeySet, type Settings, type Weight, type ParticleMode } from './settings';
import { duckBgm, playBgm, playJingle, setSound, sfx, stopBgm, unlockAudio } from './audio';
import { speak, stopSpeech, unlockSpeech, type SpeechLang } from './speech';
import { MINIGAMES, runMinigame, type MiniQuestion, type MinigameKind } from './minigames';
import { letters } from './kinetic';
import { drawEnLines, enLines, fillCentered, fillOnLines } from './glyph';
import { ALPHABET_ROWS, EN_CATEGORIES, EN_QUESTIONS, enQuestions } from './english';

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
type Lang = 'ja' | 'en';
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
  if (lang === 'en') return fillOnLines(g, ch, w / 2, enLines(g, hh));
  return fillCentered(g, ch, w, hh);
}
setSound(settings.sound, VOLUME_LEVEL[settings.volume]);

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
    categoryScreen();
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
          h('span', { class: 'lang-label' }, letters('えいご', 'kt-pop')))),
    ),
  );
}

// ------------------------------------------------------------ カテゴリ

function categoryScreen(): void {
  playBgm('bgm1_start');
  // 英語版は「もの」「うごき」だけ（「ぶん」は後日）
  const cats = lang === 'en' ? CATEGORIES.filter((c) => EN_CATEGORIES.includes(c.id)) : CATEGORIES;
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
          const empty = (lang === 'en' ? enQuestions(c.id) : enabledQuestions(c.id)).length === 0;
          return h(
            'button',
            { class: `category-btn ${empty ? 'disabled' : ''}`, disabled: empty, onclick: () => startRound(c.id) },
            picture(`cat_${c.id}`, emoji(c.emoji), 'category-pic'),
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
  const pool = lang === 'en' ? enQuestions(cat) : enabledQuestions(cat);
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
async function readOut(cells: HTMLElement[], answer: string[], pIdx: number | null = null, en = false): Promise<boolean> {
  duckBgm(true);
  try {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell.isConnected) return false;
      cell.classList.add('readout');
      // 英語は字の名前（大文字で渡すと「エイ」「ビー」と読む。小文字の a は「ア」と読まれることがある）
      if (en) await speakAndWait(answer[i].toUpperCase(), 'en');
      else await speakAndWait(i === pIdx && answer[i] === 'は' ? 'わ' : charReading(answer[i]));
      await wait(READ_PAUSE_MS);
      cell.classList.remove('readout');
      await wait(READ_GAP_MS);
    }
    return cells.every((c) => c.isConnected) || cells.length === 0;
  } finally {
    duckBgm(false);
  }
}

function questionScreen(round: Round, afterMini = false): void {
  // 英語版: ミニゲームの前に、まず「いぬ は dog」を見せて読む
  if (round.questions[round.index].lang === 'en' && round.introAt !== round.index) {
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
  const say = () => speak(en ? q.hira : spokenText(q), () => duckBgm(true), () => duckBgm(false), en ? 'en' : 'ja');

  const trace = settings.input === 'trace';
  const lined = en && settings.input !== 'keyboard'; // 英語のてがき: 見本も4本線
  const sample =
    settings.prompt === 'look' && !trace
      ? h('div', { class: 'sample' }, ...answer.map((c, i) =>
        i === pIdx ? h('span', { class: 'sample-cell particle' }, particleBadge(shown(c)))
          : lined ? h('span', { class: 'sample-cell lined' }, linedLetter(shown(c)))
            : h('span', { class: 'sample-cell' }, shown(c))))
      : null;

  const side = h(
    'div',
    { class: 'q-side' },
    h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊'),
    sample,
    // 英語: カタカナの読み方を、いつも単語の下に
    en && q.kana ? h('div', { class: 'en-kana' }, q.kana) : null,
  );
  const pic = questionPicture(q, 'q-pic');
  const top = h('div', { class: `q-top ${q.type === 'sentence' ? 'sentence' : ''}` }, pic, side);

  // 答えができたら、まず1文字ずつ大きくして読み上げる（字と音を結びつける）→ 花丸
  let finishing = false;
  const next = () => {
    if (finishing) return;
    finishing = true;
    const screen = app.querySelector<HTMLElement>('.screen.game');
    screen?.classList.add('reading'); // 読み上げ中は入力を受け付けない（やめる は押せる）
    const cells = [...(screen?.querySelectorAll<HTMLElement>('.answer .answer-cell, .hw-cells .hw-cell') ?? [])];
    void readOut(cells, answer, pIdx, en).then((ok) => { if (ok) celebrate(); });
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
      en ? enBanner(q) : null,
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
    await speakAndWait(q.hira, 'en');
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
    fillOnLines(g, ch, S / 2, L);
  };
  draw();
  void document.fonts?.load(`700 40px Andika`).then(draw).catch(() => undefined);
  return c;
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
    box.replaceChildren(closeBtn, h('h2', {}, '設定（先生用）'), ...settingRows(),
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

  const say = () => speak(info.instruction, () => duckBgm(true), () => duckBgm(false));
  // 🔊 は正解の言葉を読む（やることは最初に1回読む）
  const cur = round.questions[round.index];
  const sayWord = () => speak(cur.lang === 'en' ? cur.hira : spokenText(cur), () => duckBgm(true), () => duckBgm(false), cur.lang === 'en' ? 'en' : 'ja');
  show(
    h(
      'main',
      { class: `screen game mini mini-${kind} ${cur.lang === 'en' ? 'en' : ''}` },
      h('header', { class: 'game-header' }, headerLeft(round, true), progress(round)),
      h('div', { class: 'mini-head' },
        h('button', { class: 'speaker-btn', 'aria-label': 'ことばを よみあげ', onclick: sayWord }, '🔊'),
        h('p', { class: 'mini-instruction' }, letters(info.instruction, 'kt-drop')),
        stars),
      cur.lang === 'en' ? enBanner(cur) : null,
      stage,
    ),
  );
  stop = runMinigame(kind, stage, mq, onProgress);
  stopActiveMini = () => { finished = true; clearTimeout(skipTimer); stop(); };
  const skipTimer = setTimeout(() => { skipBtn.hidden = false; }, MINI_SKIP_AFTER_MS);
  window.setTimeout(say, 300);
}

/** 次の問題から、ミニゲームに渡す情報を作る（まちがいの言葉は同じカテゴリのほかの問題から） */
function miniQuestion(q: Question): MiniQuestion {
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
  const [x, y] = placeGlyph(g, ch, w, h);
  const edge = GUIDE_EDGE[weight] * w;
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
  g.font = shape.getContext('2d')!.font; // 英語は placeGlyph が字の大きさを決める
  g.strokeStyle = '#000';
  g.lineWidth = TRACE_TOLERANCE * 2 + Math.max(0, GUIDE_EDGE[settings.traceWeight] * PAD_PX);
  g.lineJoin = 'round';
  g.strokeText(ch, x, y);
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

/** 遊び方の設定の行（設定画面と、問題中の設定モーダルで共通） */
function settingRows(): HTMLElement[] {
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
  return [
    choice('script', '文字', [['hira', 'ひらがな'], ['kata', 'カタカナ']]),
    choice('letterCase', 'えいごの 文字', [['lower', 'こもじ（abc）'], ['upper', 'おおもじ（ABC）']]),
    choice('input', '入力方法', [['keyboard', 'キーボード'], ['handwriting', 'てがき'], ['trace', 'なぞり']]),
    choice('prompt', '出題', [['look', '① 見本あり'], ['listen', '② 読み上げのみ'], ['picture', '③ 絵だけ']]),
    choice('aColumn', 'あ行の位置', [['right', '右はし（50音表と同じ）'], ['left', '左はし']]),
    choice('sound', 'おと（BGM）', [[true, 'あり'], [false, 'なし']]),
    choice('volume', '音量', [['low', '小'], ['mid', '中'], ['high', '大']]),
    choice('particleMode', 'ぶん・きもちの じょし', [['ga', '「が」'], ['ha', '「は」（わ と よむ）'], ['mix', '「が」「は」こうたい']]),
    choice('particleInput', '文の「が」「は」', [[false, '最初から入れておく'], [true, '子どもが打つ・書く']]),
    choice('keySet', 'キーボードの字', [['all', '50音'], ['k25', '25音'], ['k10', '10音'], ['answer', '答えの字だけ']]),
    choice('traceWeight', 'なぞりの見本の太さ', [['thin', 'ほそい'], ['normal', 'ふつう'], ['bold', 'ふとい']]),
    choice('penWidth', 'ペンの太さ', [['thin', 'ほそい'], ['normal', 'ふつう'], ['bold', 'ふとい']]),
    choice('minigame', 'ミニゲーム', [[true, 'あり（問題の前に毎回）'], [false, 'なし']]),
    minigameKindsRow(),
  ];
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

  show(
    h(
      'main',
      { class: 'screen settings' },
      backButton(startScreen),
      h('h2', {}, '設定（先生用）'),
      ...settingRows(),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'もんだい'),
        h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => questionsScreen('mono') }, '出題する問題を選ぶ・読み込む'))),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'てがきのきろく'),
        h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => void writingsScreen() }, '見る・書き出す'))),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'ワークシート'),
        h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => { worksheetBack = settingsScreen; worksheetScreen(); } }, '作る・印刷する'))),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, '暗証番号'), h('div', { class: 'seg' }, pinInput, pinSave, pinMsg)),
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

function questionsScreen(cat: Category, message = ''): void {
  stopBgm();
  const rerender = (msg = '') => questionsScreen(cat, msg);
  const list = allQuestions(cat);
  const onCount = list.filter((q) => isEnabled(q.id)).length;

  const tabs = h(
    'div',
    { class: 'seg' },
    ...CATEGORIES.map((c) => {
      const all = allQuestions(c.id);
      const on = all.filter((q) => isEnabled(q.id)).length;
      return h('button', { class: `seg-btn ${c.id === cat ? 'on' : ''}`, onclick: () => questionsScreen(c.id) }, `${c.label}  ${on}/${all.length}`);
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
      h('span', { class: 'q-card-word' }, q.hira),
      h(
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
      backButton(settingsScreen, '設定へ'),
      h('h2', {}, '出題する問題'),
      tabs,
      h(
        'div',
        { class: 'seg toolbar' },
        h('button', { class: 'seg-btn', onclick: () => { setEnabled(list.map((q) => q.id), true); rerender(); } }, 'ぜんぶ ON'),
        h('button', { class: 'seg-btn', onclick: () => { setEnabled(list.map((q) => q.id), false); rerender(); } }, 'ぜんぶ OFF'),
        fileInput,
        h('button', { class: 'seg-btn', onclick: () => fileInput.click() }, 'JSONを読み込む'),
        exportBtn,
      ),
      h('p', { class: 'q-note' },
        message || `タップで ON/OFF。ON の問題から1回に最大10問を出します（いま ${onCount}問）。単語は${MAX_CHARS}文字まで。`),
      onCount === 0 && h('p', { class: 'q-note warn' }, 'このカテゴリは ON の問題がないので、子どもの画面で選べません'),
      h('div', { class: 'q-grid' }, ...cards),
    ),
  );
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
// ストック＝配布用の PDF（tools/make_worksheets.py で作って public/worksheets/ に置いたもの）
// オリジナル＝さいごに遊んだ問題で作るワークシート（設定の「ワークシート」と同じ画面）

/** [ファイル名の部分, 見出し, 絵（cat_○○）] */
const STOCK_CATEGORIES: [string, string, string][] = [
  ['mono', 'もの', 'mono'], ['kimochi', 'きもち', 'kimochi'], ['ugoki', 'うごき', 'ugoki'], ['bun', 'ぶん', 'bun'],
  ['bunkimochi', 'ぶん・きもち「が」', 'bunkimochi'], ['bunkimochi_ha', 'ぶん・きもち「は」', 'bunkimochi'],
];

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

function stockScreen(): void {
  const base = import.meta.env.BASE_URL;
  const link = (cat: string, label: string, kata: boolean) =>
    h('a', {
      class: 'mid-btn stock-link',
      href: `${base}worksheets/worksheet_${cat}${kata ? '_kata' : ''}.pdf`,
      download: `ワークシート_${label}${kata ? '_カタカナ' : ''}.pdf`,
      target: '_blank',
      rel: 'noopener',
    }, kata ? 'カタカナ' : 'ひらがな');
  show(
    h(
      'main',
      { class: 'screen print-menu' },
      backButton(printScreen),
      h('h2', {}, 'ストック'),
      h('p', { class: 'q-note' }, '20問前後・A4 縦4枚。おしたら PDF が ひらきます（iPad は 共有 から「"ファイル"に保存」・プリント）。インターネットが いります。'),
      h('div', { class: 'stock-list' },
        ...STOCK_CATEGORIES.map(([cat, label, pic]) =>
          h('div', { class: 'stock-row' },
            picture(`cat_${pic}`, () => h('span'), 'stock-pic'),
            h('span', { class: 'stock-label' }, label),
            link(cat, label, false),
            link(cat, label, true)))),
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
  stopBgm();
  // 英語版の問題も選べる（2026-10-27）。日本語と英語は同じプリントにまぜてもよい
  const all = [...allQuestions(), ...EN_QUESTIONS];
  const sel = selected.filter((id) => all.some((q) => q.id === id));
  // ことば・カテゴリの指定がなければ、選んでいる問題（＝さいごに遊んだ問題）のものを開く
  const first = all.find((q) => q.id === sel[0]);
  const showLang: Lang = wl ?? (first?.lang === 'en' ? 'en' : 'ja');
  const cats = showLang === 'en' ? CATEGORIES.filter((c) => EN_CATEGORIES.includes(c.id)) : CATEGORIES;
  const showCat: Category = cat && cats.some((c) => c.id === cat) ? cat : first && cats.some((c) => c.id === first.category) ? first.category : 'mono';
  const rerender = (next: string[]) => worksheetScreen(next, showCat, showLang);

  const langTabs = h('div', { class: 'seg' }, ...([['ja', 'ひらがな・カタカナ'], ['en', 'えいご']] as [Lang, string][]).map(([l, label]) =>
    h('button', { class: `seg-btn ${l === showLang ? 'on' : ''}`, onclick: () => worksheetScreen(sel, showCat, l) }, label)));
  const tabs = h('div', { class: 'seg' }, ...cats.map((c) =>
    h('button', { class: `seg-btn ${c.id === showCat ? 'on' : ''}`, onclick: () => worksheetScreen(sel, c.id, showLang) }, c.label)));

  const list = showLang === 'en' ? enQuestions(showCat) : applyParticles(allQuestions(showCat));
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
  const pages = Math.ceil(sel.length / perPage(opts));
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
      pick('size', 'おおきさ', [['normal', 'ふつう（A4たて・5もん）'], ['large', 'おおきい（A4よこ・2もん）']]),
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
function worksheetPrint(ids: string[]): void {
  const all = [...allQuestions(), ...EN_QUESTIONS];
  const qs = applyParticles(ids.map((id) => all.find((q) => q.id === id)).filter((q): q is Question => !!q));
  const opts = loadSheetOptions();
  const nPages = Math.ceil(qs.length / perPage(opts));
  const what = `${opts.kind === 'trace' ? 'なぞる' : 'みてかく'}・${opts.size === 'large' ? 'A4 よこ' : 'A4 たて'} ${nPages}枚・${opts.grid === 'color' ? 'カラーマス' : 'じゅうじせん'}`;

  const note = h('span', { class: 'ws-bar-note' }, `${what}。ページを作っています…`);
  const pagesBox = h('div', { class: `ws-pages ${opts.size === 'large' ? 'landscape' : ''}` });
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
    const items = await Promise.all(qs.map(async (q) => ({
      chars: chars(dispQ(q, q.hira)),
      particle: particleIndex(q),
      // 先生が付けた写真はその URL を使う
      imageUrl: await questionImageUrl(q),
      emoji: q.emoji,
      en: q.lang === 'en',
      kana: q.kana,
    })));
    canvases = await worksheetPages(items, opts);
    pagesBox.replaceChildren(...canvases.map((c) => {
      c.className = 'ws-page-img';
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
