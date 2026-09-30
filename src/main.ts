import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CATEGORIES, QUESTIONS, type Category, type Question } from './questions';
import { chars, DAKUON, inScript, SEION, SMALL } from './kana';
import { loadSettings, saveSettings, VOLUME_LEVEL, type Settings } from './settings';
import { duckBgm, playBgm, setSound, stopBgm, unlockAudio } from './audio';
import { speak, unlockSpeech } from './speech';

registerSW({ immediate: true });

// iOS は最初のタップまで音を出せない。どこをタップしても解錠する
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

const ROUND_SIZE = 10;
const HANAMARU_MS = 1500;
const HINT_AFTER_MISSES = 2;

const app = document.getElementById('app')!;
let settings = loadSettings();
setSound(settings.sound, VOLUME_LEVEL[settings.volume]);
const base = import.meta.env.BASE_URL;

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
  const img = h('img', { src: `${base}images/${name}.webp`, alt: '', draggable: 'false' });
  img.addEventListener('error', () => box.replaceChildren(fallback()));
  box.append(img);
  return box;
}

const emoji = (e: string) => () => h('span', { class: 'emoji' }, e);

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

/** 長押しで発火するボタン（子どもの誤操作よけ） */
function onLongPress(el: HTMLElement, ms: number, fn: () => void): void {
  let timer = 0;
  const start = () => {
    el.classList.add('pressing');
    timer = window.setTimeout(() => {
      el.classList.remove('pressing');
      fn();
    }, ms);
  };
  const cancel = () => {
    el.classList.remove('pressing');
    clearTimeout(timer);
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
}

// ------------------------------------------------------------ スタート

function startScreen(): void {
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
  // 背景画像はあれば使う（なければ無地）
  screen.style.backgroundImage = `url(${base}images/start_bg.webp)`;
  show(screen);
  playBgm('bgm1_start');
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
        ...CATEGORIES.map((c) =>
          h(
            'button',
            { class: 'category-btn', onclick: () => startRound(c.id) },
            picture(`cat_${c.id}`, emoji(c.emoji), 'category-pic'),
            h('span', { class: 'category-label' }, c.label),
          ),
        ),
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
}

function startRound(cat: Category): void {
  const pool = QUESTIONS.filter((q) => q.category === cat);
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
        h('button', { class: 'big-btn primary', onclick: startScreen }, 'やめる'),
      ),
    ),
  );
  app.append(overlay);
}

function questionScreen(round: Round): void {
  playBgm('bgm2_question'); // 10問のあいだ流しっぱなし
  const q = round.questions[round.index];
  const answer = chars(q.hira);
  const shown = (c: string) => inScript(c, settings.script);
  const say = () => speak(q.hira, () => duckBgm(true), () => duckBgm(false));

  const sample =
    settings.prompt === 'look'
      ? h('div', { class: 'sample' }, ...answer.map((c) => h('span', { class: 'sample-cell' }, shown(c))))
      : null;

  const side = h(
    'div',
    { class: 'q-side' },
    h('button', { class: 'speaker-btn', 'aria-label': 'よみあげ', onclick: say }, '🔊'),
    sample,
  );
  const top = h('div', { class: 'q-top' }, picture(q.id, emoji(q.emoji), 'q-pic'), side);

  const next = () => {
    const overlay = h('div', { class: 'overlay clear' }, hanamaru('pop'));
    app.append(overlay);
    window.setTimeout(() => {
      round.index++;
      if (round.index < round.questions.length) questionScreen(round);
      else finishScreen();
    }, HANAMARU_MS);
  };

  const input =
    settings.input === 'handwriting'
      ? handwritingArea(answer.length, sample, next)
      : keyboardArea(answer, side, next);

  show(
    h(
      'main',
      { class: 'screen game' },
      h('header', { class: 'game-header' }, quitButton(), progress(round)),
      top,
      input,
    ),
  );

  if (settings.prompt !== 'picture') window.setTimeout(say, 300);
}

// ------------------------------------------------------------ キーボード入力

function keyboardArea(answer: string[], side: HTMLElement, onDone: () => void): HTMLElement {
  let pos = 0;
  let misses = 0;
  const cells = answer.map(() => h('span', { class: 'answer-cell' }));
  cells[0].classList.add('current');
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
    cells[pos].classList.remove('current');
    cells[pos].classList.add('filled');
    clearHint();
    misses = 0;
    pos++;
    if (pos < answer.length) cells[pos].classList.add('current');
    else onDone();
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

function handwritingArea(count: number, sample: HTMLElement | null, onDone: () => void): HTMLElement {
  let active: HTMLCanvasElement | null = null;
  const canvases: HTMLCanvasElement[] = [];

  const makeCell = () => {
    const canvas = h('canvas', { class: 'hw-canvas' });
    let drawing = false;
    let ctx: CanvasRenderingContext2D | null = null;

    const setup = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = Math.max(8, r.width / 18);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2B2B2B';
    };

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!ctx) setup();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      active = canvas;
      const [x, y] = point(e);
      ctx!.beginPath();
      ctx!.moveTo(x, y);
      ctx!.lineTo(x + 0.1, y + 0.1);
      ctx!.stroke();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const [x, y] = point(e);
      ctx!.lineTo(x, y);
      ctx!.stroke();
    });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvases.push(canvas);
    return h('div', { class: 'hw-cell' }, canvas);
  };

  const clear = (c: HTMLCanvasElement) => c.getContext('2d')?.clearRect(0, 0, c.width, c.height);

  const eraseBtn = h('button', { class: 'mid-btn secondary' }, 'けす');
  eraseBtn.addEventListener('click', () => active && clear(active));
  onLongPress(eraseBtn, 700, () => canvases.forEach(clear));

  const doneBtn = h('button', { class: 'mid-btn primary', onclick: onDone }, 'できた');

  const cells = h('div', { class: 'hw-cells' }, ...Array.from({ length: count }, makeCell));
  return h(
    'div',
    { class: 'input-area handwriting' },
    // 見本はマスの真上に移して、1文字ずつ見比べられるようにする
    sample,
    cells,
    h('div', { class: 'hw-buttons' }, eraseBtn, doneBtn),
  );
}

// ------------------------------------------------------------ おわり

function finishScreen(): void {
  stopBgm();
  const stamps = ['star', 'heart', 'flower', 'thumb'];
  const stampEmoji: Record<string, string> = { star: '⭐', heart: '💗', flower: '🌸', thumb: '👍' };
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
      choice('aColumn', 'あ行の位置', [['left', '左はし'], ['right', '右はし（50音表と同じ）']]),
      choice('sound', 'おと（BGM）', [[true, 'あり'], [false, 'なし']]),
      choice('volume', '音量', [['low', '小'], ['mid', '中'], ['high', '大']]),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, '暗証番号'), h('div', { class: 'seg' }, pinInput, pinSave, pinMsg)),
    ),
  );
}

startScreen();
