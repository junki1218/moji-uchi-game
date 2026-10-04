// iPad の合成音声で読み上げる。iOS はユーザーのタップを経ないと最初の発話が鳴らないので、
// 最初のタップで unlockSpeech() を呼んでおく。

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ja'));
  voice = voices.find((v) => v.localService) ?? voices[0] ?? null;
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
export function speak(text: string, onStart?: () => void, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  let ended = false;
  const end = () => { if (!ended) { ended = true; onEnd?.(); } };
  u.onstart = () => onStart?.();
  u.onend = end;
  u.onerror = end;
  u.lang = 'ja-JP';
  u.rate = 0.8;
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
