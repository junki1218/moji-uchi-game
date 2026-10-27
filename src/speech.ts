// iPad の合成音声で読み上げる。iOS はユーザーのタップを経ないと最初の発話が鳴らないので、
// 最初のタップで unlockSpeech() を呼んでおく。

let voice: SpeechSynthesisVoice | null = null;
/** 英語の声（2026-10-27 英語版）。アメリカ英語を先に、なければほかの英語 */
let enVoice: SpeechSynthesisVoice | null = null;

export type SpeechLang = 'ja' | 'en';

function pickVoice(): void {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices();
  const voices = all.filter((v) => v.lang.startsWith('ja'));
  voice = voices.find((v) => v.localService) ?? voices[0] ?? null;
  const en = all.filter((v) => v.lang.startsWith('en'));
  const us = en.filter((v) => v.lang.replace('_', '-') === 'en-US');
  enVoice = us.find((v) => v.localService) ?? us[0] ?? en.find((v) => v.localService) ?? en[0] ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

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

/** onEnd は読み終わり・中断・失敗のいずれでも1回だけ呼ぶ（BGM の音量を戻すため） */
export function speak(text: string, onStart?: () => void, onEnd?: () => void, lang: SpeechLang = 'ja'): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  let ended = false;
  const end = () => { if (!ended) { ended = true; onEnd?.(); } };
  u.onstart = () => onStart?.();
  u.onend = end;
  u.onerror = end;
  const v = lang === 'en' ? enVoice : voice;
  u.lang = lang === 'en' ? 'en-US' : 'ja-JP';
  u.rate = lang === 'en' ? 0.75 : 0.8;
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
