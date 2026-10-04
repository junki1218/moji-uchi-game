import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CATEGORIES, MAX_CHARS, type Category, type Question } from './questions';
import { allQuestions, applyImport, attachPhoto, deleteCustom, enabledQuestions, exportJson, isEnabled, parseImport, setEnabled, type ImportPlan } from './bank';
import { hasPhoto, loadPhotoIndex, photoUrl, removePhoto } from './photos';
import { clearWritings, deleteWriting, exportWritings, listWritings, MAX_WRITINGS, saveWriting } from './writings';
import { chars, DAKUON, inScript, SEION, SMALL } from './kana';
import { loadSettings, saveSettings, VOLUME_LEVEL, type Settings } from './settings';
import { duckBgm, playBgm, playJingle, setSound, stopBgm, unlockAudio } from './audio';
import { speak, stopSpeech, unlockSpeech } from './speech';
import { MINIGAMES, runMinigame, type MiniQuestion, type MinigameKind } from './minigames';

// 新しい版が届いたら、ゲームの途中ではなくスタート画面に戻ったときに読み込み直す
// （古いプログラムと新しい絵が混ざって、絵と問題が食い違うのを防ぐ）
let updateReady = false;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateReady = true; },
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
  if (hasPhoto(q.id)) {
    const box = h('div', { class: `picture ${cls}` });
    void photoUrl(q.id).then((url) => {
      if (url) box.replaceChildren(h('img', { src: url, alt: '', draggable: 'false' }));
      else box.replaceChildren(emoji(q.emoji)());
    });
    return box;
  }
  if (q.builtin) return picture(q.id, emoji(q.emoji), cls);
  return h('div', { class: `picture ${cls}` }, emoji(q.emoji)());
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
      h('h1', { class: 'title' }, 'もじうちげーむ'),
      h(
        'div',
        { class: 'start-buttons' },
        h('button', { class: 'big-btn primary', onclick: () => { unlockSpeech(); categoryScreen(); } },
          'はじめる'),
        h('button', { class: 'big-btn secondary', onclick: pinScreen }, 'せってい'),
      ),
  );
  // 背景画像はあれば使う（なければ無地）。タイトルとボタンが読めるよう淡い地色を重ねる
  const bg = imageUrl('start_bg');
  if (bg) screen.style.backgroundImage = `linear-gradient(rgba(255, 247, 236, 0.55), rgba(255, 247, 236, 0.55)), url(${bg})`;
  show(screen);
  playBgm('bgm1_start');
  // 新しい版が届いていたら切り替えて読み込み直す（画面は先に描いておくので、切り替わらなくても真っ白にならない）
  if (updateReady) {
    updateReady = false;
    void updateSW(true);
  }
}

// ------------------------------------------------------------ カテゴリ

function categoryScreen(): void {
  playBgm('bgm1_start');
  show(
    h(
      'main',
      { class: 'screen category' },
      backButton(startScreen),
      h(
        'div',
        { class: 'category-grid' },
        ...CATEGORIES.map((c) => {
          // 出題する問題が1つもないカテゴリは押せない
          const empty = enabledQuestions(c.id).length === 0;
          return h(
            'button',
            { class: `category-btn ${empty ? 'disabled' : ''}`, disabled: empty, onclick: () => startRound(c.id) },
            picture(`cat_${c.id}`, emoji(c.emoji), 'category-pic'),
            h('span', { class: 'category-label' }, c.label),
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
  /** 直前のミニゲーム（同じものが続かないように） */
  lastMini?: MinigameKind;
}

function startRound(cat: Category): void {
  const pool = enabledQuestions(cat);
  const round: Round = { questions: shuffle(pool).slice(0, ROUND_SIZE), index: 0 };
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

function questionScreen(round: Round, afterMini = false): void {
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
  // 文（〇〇が●●）は「が」を最初から入れておき、打たせない
  const fixed = new Set<number>(q.type === 'sentence' && q.parts ? [chars(q.parts[0]).length] : []);
  const shown = (c: string) => inScript(c, settings.script);
  const say = () => speak(q.hira, () => duckBgm(true), () => duckBgm(false));

  const sample =
    settings.prompt === 'look'
      ? h('div', { class: 'sample' }, ...answer.map((c, i) => h('span', { class: `sample-cell ${fixed.has(i) ? 'fixed' : ''}` }, shown(c))))
      : null;

  const side = h(
    'div',
    { class: 'q-side' },
    h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊'),
    sample,
  );
  const top = h('div', { class: `q-top ${q.type === 'sentence' ? 'sentence' : ''}` }, questionPicture(q, 'q-pic'), side);

  const next = () => {
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
  const hintBtn: HTMLButtonElement = h('button', {
    class: 'hint-btn',
    onclick: () => { if (!hint.show()) hintBtn.disabled = true; },
  }, '💡 ヒント');

  const input =
    settings.input === 'handwriting'
      ? handwritingArea(answer, fixed, sample, next, hint)
      : keyboardArea(answer, fixed, side, next, hint);

  show(
    h(
      'main',
      { class: 'screen game' },
      h('header', { class: 'game-header' }, quitButton(), progress(round), hintBtn),
      top,
      input,
    ),
  );

  if (settings.prompt !== 'picture') window.setTimeout(say, 300);
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
      app.append(h('div', { class: 'overlay clear' }, h('div', { class: 'mini-clear pop' }, 'できた！')));
      setTimeout(() => {
        document.querySelector('.overlay.clear')?.remove();
        leave();
      }, MINI_CLEAR_MS);
    }
  };

  const say = () => speak(info.instruction, () => duckBgm(true), () => duckBgm(false));
  // 🔊 は正解の言葉を読む（やることは最初に1回読む）
  const sayWord = () => speak(round.questions[round.index].hira, () => duckBgm(true), () => duckBgm(false));
  show(
    h(
      'main',
      { class: `screen game mini mini-${kind}` },
      h('header', { class: 'game-header' }, quitButton(), progress(round)),
      h('div', { class: 'mini-head' },
        h('button', { class: 'speaker-btn', 'aria-label': 'ことばを よみあげ', onclick: sayWord }, '🔊'),
        h('p', { class: 'mini-instruction' }, info.instruction),
        stars),
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
  const disp = (s: string) => inScript(s, settings.script);
  const answer = chars(q.hira);
  const fixed = new Set<number>(q.type === 'sentence' && q.parts ? [chars(q.parts[0]).length] : []);
  const others = shuffle(
    [...new Set(allQuestions(q.category).map((x) => x.hira).filter((w) => w !== q.hira))],
  ).map(disp);
  const pictureUrl = async () => {
    if (hasPhoto(q.id)) return photoUrl(q.id);
    return q.builtin ? imageUrl(q.id) : null;
  };
  return {
    answer: disp(q.hira),
    chars: answer.map(disp),
    fixed,
    others,
    picture: () => questionPicture(q, 'mini-q-pic'),
    pictureUrl,
    emoji: q.emoji,
    showSample: settings.prompt === 'look',
    toScript: disp,
  };
}

// ------------------------------------------------------------ キーボード入力

/** ヒントボタンと入力欄をつなぐ。show＝次のヒントを出し、まだ出せるヒントが残っていれば true */
interface Hint {
  show: () => boolean;
}

/** 文なら 〇〇 と ●● の頭の位置、単語なら [0] */
function partStarts(answer: string[], fixed: Set<number>): number[] {
  const starts = [0];
  for (const i of fixed) if (i + 1 < answer.length) starts.push(i + 1);
  return starts;
}

function keyboardArea(answer: string[], fixed: Set<number>, side: HTMLElement, onDone: () => void, hint: Hint): HTMLElement {
  let pos = 0;
  let misses = 0;
  const cells = answer.map((c, i) =>
    fixed.has(i) ? h('span', { class: 'answer-cell fixed' }, inScript(c, settings.script)) : h('span', { class: 'answer-cell' }),
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
  const starts = partStarts(answer, fixed);
  let step = 0;
  const glowAt = new Set<number>();
  const glowIfDue = () => { if (glowAt.has(pos)) keys.get(answer[pos])?.classList.add('hint'); };
  const filled = (i: number) => cells[i].classList.contains('filled');
  hint.show = () => {
    while (step < starts.length && filled(starts[step])) step++; // もう打った段は飛ばす
    // 出す段が残っていなければ、いま打つ字を出す（単語で1文字目を打った後に押したとき）
    const i = step < starts.length ? starts[step++] : pos;
    if (i < answer.length) {
      cells[i].dataset.ghost = inScript(answer[i], settings.script);
      cells[i].classList.add('ghost');
      glowAt.add(i);
      glowIfDue();
    }
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
    cells[pos].textContent = inScript(c, settings.script);
    cells[pos].classList.remove('current', 'ghost');
    cells[pos].classList.add('filled');
    clearHint();
    misses = 0;
    pos++;
    if (fixed.has(pos)) {
      stageDone(pos);
      while (fixed.has(pos)) pos++;
    }
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
            const key = h('button', { class: 'key' }, inScript(c, settings.script));
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

  const blocks = [block(SEION, 'seion'), block(DAKUON, 'dakuon'), block(SMALL, 'small')];
  if (settings.aColumn === 'right') blocks.reverse();

  return h('div', { class: 'input-area' }, h('div', { class: 'keyboard' }, ...blocks));
}

// ------------------------------------------------------------ 手書き入力（判定なし）
// 小さなマスをタップすると大きな手書きパッドが開く。書いた字はパッドを閉じると縮小してマスに写る。
// 字は正方形の画像（PAD_PX 四方）として1文字ずつ持ち、開き直すと続きから書ける。

const PAD_PX = 600;

function handwritingArea(answer: string[], fixed: Set<number>, sample: HTMLElement | null, onDone: () => void, hint: Hint): HTMLElement {
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
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(inScript(answer[i], settings.script), PAD_PX / 2, PAD_PX / 2);
    }
    return c;
  });
  const written = new Array<boolean>(count).fill(false);
  // ヒントで薄く出す字（記録の画像には入れない）
  const ghost = new Array<boolean>(count).fill(false);
  // ヒントの薄い字は、見本と同じ教科書体で（なぞって書くので字形をそろえる）
  const ghostFont = (px: number) => `600 ${px * 0.62}px "UD Digi Kyokasho NK-B", "UD Digi Kyokasho N-B", "Klee One", "Hiragino Maru Gothic ProN", sans-serif`;

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
    if (ghost[i]) {
      ctx.fillStyle = '#e2d6c6';
      ctx.font = ghostFont(c.width);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inScript(answer[i], settings.script), c.width / 2, c.height / 2);
    }
    ctx.drawImage(glyphs[i], 0, 0, c.width, c.height);
    cells[i].classList.toggle('written', written[i]);
  };

  // 1回目＝〇〇の1文字目、2回目＝●●の1文字目を薄く出す（単語は1回）。なぞって書ける
  const starts = partStarts(answer, fixed);
  let step = 0;
  hint.show = () => {
    const i = starts[step++];
    ghost[i] = true;
    paintCell(i);
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
    ctx.lineWidth = PAD_PX / 22;

    const title = h('p', { class: 'pad-title' });
    const padGhost = h('span', { class: 'pad-ghost' });
    const guide = h('div', { class: 'pad-sample' });
    const nextBtn = h('button', { class: 'mid-btn secondary' }, 'つぎのじ');

    const load = () => {
      ctx.clearRect(0, 0, PAD_PX, PAD_PX);
      ctx.drawImage(glyphs[i], 0, 0);
      title.textContent = `${i + 1}もじめ（${i + 1}/${count}）`;
      padGhost.textContent = ghost[i] ? inScript(answer[i], settings.script) : '';
      // 見本あり のときだけ、書く字の見本を横に出す
      guide.textContent = settings.prompt === 'look' ? inScript(answer[i], settings.script) : '';
      guide.hidden = settings.prompt !== 'look';
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
    });
    pad.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const [x, y] = point(e);
      ctx.lineTo(x, y);
      ctx.stroke();
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
        { class: 'pad-dialog' },
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
      if (written.some(Boolean)) void saveWriting(glyphs, inScript(answer.join(''), settings.script)).catch(() => undefined);
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
    { class: 'input-area handwriting' },
    // 見本はマスの真上に置いて、1文字ずつ見比べられるようにする
    sample,
    h('div', { class: 'hw-cells' }, ...cells),
    h('p', { class: 'hw-help' }, 'ますを タップして かこう'),
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
      hanamaru('finish-hanamaru pop'),
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

// ------------------------------------------------------------ 暗証番号

function pinScreen(): void {
  stopBgm(); // 先生用の画面は無音
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
        settingsScreen();
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

  show(h('main', { class: 'screen pin' }, backButton(startScreen), h('p', { class: 'pin-title' }, 'あんしょうばんごう'), dots, pad));
}

// ------------------------------------------------------------ 設定（先生用）

function settingsScreen(): void {
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
      choice('script', '文字', [['hira', 'ひらがな'], ['kata', 'カタカナ']]),
      choice('input', '入力方法', [['keyboard', 'キーボード'], ['handwriting', 'てがき']]),
      choice('prompt', '出題', [['look', '① 見本あり'], ['listen', '② 読み上げのみ'], ['picture', '③ 絵だけ']]),
      choice('aColumn', 'あ行の位置', [['right', '右はし（50音表と同じ）'], ['left', '左はし']]),
      choice('sound', 'おと（BGM）', [[true, 'あり'], [false, 'なし']]),
      choice('volume', '音量', [['low', '小'], ['mid', '中'], ['high', '大']]),
      choice('minigame', 'ミニゲーム', [[true, 'あり（問題の前に毎回）'], [false, 'なし']]),
      minigameKindsRow(),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'もんだい'),
        h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => questionsScreen('mono') }, '出題する問題を選ぶ・読み込む'))),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'てがきのきろく'),
        h('div', { class: 'seg' }, h('button', { class: 'seg-btn', onclick: () => void writingsScreen() }, '見る・書き出す'))),
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

// 写真の一覧を読んでから始める（読めなくても始める）
void loadPhotoIndex().finally(startScreen);
