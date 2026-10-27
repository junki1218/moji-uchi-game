// iPad の合成音声で読み上げる。iOS はユーザーのタップを経ないと最初の発話が鳴らないので、
// 最初のタップで unlockSpeech() を呼んでおく。

let voice: SpeechSynthesisVoice | null = null;
/** 英語の声（2026-10-27 英語版） */
let enVoice: SpeechSynthesisVoice | null = null;
/** 先生が設定で選んだ英語の声の名前（'' は じどう） */
let enVoiceName = '';

export type SpeechLang = 'ja' | 'en';

// 英語の声は、ふつうに話す声を名前で選ぶ（2026-10-27 iPad で英語が鳴らなかった件）。
// iPad の一覧には Albert・Bubbles などのおもしろ声や、ダウンロードしていない声もまざっていて、
// 「最初に見つかった英語の声」だと鳴らないことがある。見つからなければ声は決めず、言語（en-US）だけ渡して iPad にまかせる
const EN_GOOD = ['Samantha', 'Alex', 'Karen', 'Daniel', 'Moira', 'Tessa', 'Fiona', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira', 'Microsoft Guy'];

const isEn = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase().startsWith('en');

function pickVoice(): void {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices();
  const voices = all.filter((v) => v.lang.startsWith('ja'));
  voice = voices.find((v) => v.localService) ?? voices[0] ?? null;
  const en = all.filter(isEn);
  const chosen = enVoiceName ? en.find((v) => v.name === enVoiceName) : undefined;
  const good = EN_GOOD.map((n) => en.find((v) => v.name.startsWith(n))).find((v) => v);
  enVoice = chosen ?? good ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

/** 設定の画面で選べる英語の声（名前と言語） */
export function englishVoices(): { name: string; lang: string }[] {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(isEn).map((v) => ({ name: v.name, lang: v.lang }));
}

/** 英語の声を決める（'' は じどう） */
export function setEnglishVoice(name: string): void {
  enVoiceName = name;
  pickVoice();
}

/** いま使う英語の声の名前（じどうで見つからなければ ''） */
export const currentEnglishVoice = (): string => enVoice?.name ?? '';

/** 読み上げを止める（やめて画面を離れたときなど） */
export function stopSpeech(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function unlockSpeech(): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  speechSynthesis.speak(u);
}

const START_WAIT_MS = 1500; // 英語がこの間に読み始めなければ、声を決めずに読み直す

/** onEnd は読み終わり・中断・失敗のいずれでも1回だけ呼ぶ（BGM の音量を戻すため） */
export function speak(text: string, onStart?: () => void, onEnd?: () => void, lang: SpeechLang = 'ja'): void {
  if (!('speechSynthesis' in window)) return;
  // iPad は開いた直後に声の一覧がまだないことがある。まだ決まっていなければ、ここで選び直す
  if (!voice || (lang === 'en' && !enVoice)) pickVoice();
  speechSynthesis.cancel();
  speechSynthesis.resume(); // iPad で一時停止のまま止まっていることがある
  let ended = false;
  let started = false;
  let retried = false;
  const end = () => { if (!ended) { ended = true; onEnd?.(); } };
  const retry = () => {
    retried = true;
    utter(false);
  };
  const utter = (withVoice: boolean) => {
    const u = new SpeechSynthesisUtterance(text);
    // 読み直したあとは、最初の発話の知らせ（止めたことによる終わり・失敗）は無視する
    const mine = () => withVoice === !retried;
    u.onstart = () => { if (!mine()) return; started = true; onStart?.(); };
    u.onend = () => { if (mine()) end(); };
    u.onerror = (e) => {
      if (!mine()) return;
      // 声を決めて失敗したら、声を決めずにもう一度（英語）
      if (withVoice && lang === 'en' && !started && e.error !== 'interrupted' && e.error !== 'canceled') retry();
      else end();
    };
    const v = lang === 'en' ? enVoice : voice;
    u.lang = lang === 'en' ? 'en-US' : 'ja-JP';
    u.rate = lang === 'en' ? 0.75 : 0.8;
    if (v && withVoice) u.voice = v;
    speechSynthesis.speak(u);
    return u;
  };
  utter(true);
  // 英語の声が鳴らないまま止まっているときは、声を決めずに読み直す
  if (lang === 'en' && enVoice) {
    window.setTimeout(() => {
      if (started || ended || retried) return;
      retried = true; // 先に立てておく（cancel で最初の発話の知らせが来ても無視する）
      speechSynthesis.cancel();
      utter(false);
    }, START_WAIT_MS);
  }
}
