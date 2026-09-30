// 手書きモードで子どもが書いた字の記録。1問＝画像1枚（書いた字を横に並べ、下に単語と日時）。
// 新しい方から MAX_WRITINGS 件だけ残し、古いものから消す。先生が設定画面から見て、端末へ書き出せる。

import { tx } from './idb';

export const MAX_WRITINGS = 50;

const CELL = 220; // 1文字の大きさ（px）
const PAD = 24;
const LABEL_H = 64;

export interface Writing {
  key: number; // 保存した時刻（ミリ秒）
  word: string;
  createdAt: string; // ISO
  png: Blob;
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 1文字ずつの字（正方形の canvas）を横に並べた記録画像を作る */
function compose(glyphs: HTMLCanvasElement[], word: string, at: Date): Promise<Blob> {
  const n = glyphs.length;
  const c = document.createElement('canvas');
  c.width = PAD * 2 + n * CELL + (n - 1) * 12;
  c.height = PAD * 2 + CELL + LABEL_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  glyphs.forEach((glyph, i) => {
    const x = PAD + i * (CELL + 12);
    // マスと十字の補助線（書いた字の位置がわかるように）
    g.strokeStyle = '#e4d6c3';
    g.lineWidth = 3;
    g.strokeRect(x, PAD, CELL, CELL);
    g.strokeStyle = '#f0e6d8';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + CELL / 2, PAD);
    g.lineTo(x + CELL / 2, PAD + CELL);
    g.moveTo(x, PAD + CELL / 2);
    g.lineTo(x + CELL, PAD + CELL / 2);
    g.stroke();
    g.drawImage(glyph, x, PAD, CELL, CELL);
  });
  g.fillStyle = '#6b6259';
  g.font = '28px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif';
  g.textBaseline = 'middle';
  g.fillText(`${word}　${stamp(at)}`, PAD, PAD + CELL + LABEL_H / 2 + 4);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('画像にできません'))), 'image/png'),
  );
}

export async function saveWriting(glyphs: HTMLCanvasElement[], word: string): Promise<void> {
  const at = new Date();
  const rec: Writing = { key: at.getTime(), word, createdAt: at.toISOString(), png: await compose(glyphs, word, at) };
  await tx('writings', 'readwrite', (s) => s.put(rec, rec.key));
  // 古いものから消して MAX_WRITINGS 件に保つ（キーは時刻なので小さい方が古い）
  const keys = (await tx('writings', 'readonly', (s) => s.getAllKeys())) as number[];
  const old = keys.sort((a, b) => a - b).slice(0, Math.max(0, keys.length - MAX_WRITINGS));
  for (const k of old) await tx('writings', 'readwrite', (s) => s.delete(k));
}

/** 新しい順 */
export async function listWritings(): Promise<Writing[]> {
  const all = (await tx('writings', 'readonly', (s) => s.getAll())) as Writing[];
  return all.sort((a, b) => b.key - a.key);
}

export async function deleteWriting(key: number): Promise<void> {
  await tx('writings', 'readwrite', (s) => s.delete(key));
}

export async function clearWritings(): Promise<void> {
  await tx('writings', 'readwrite', (s) => s.clear());
}

export function fileName(w: Writing): string {
  const d = new Date(w.createdAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `tegaki_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${w.word}.png`;
}

/**
 * 端末へ書き出す。iPad は共有シート（「画像を保存」で写真アプリ、「ファイルに保存」など）。
 * 共有シートが使えない環境（パソコンのブラウザ等）では1枚ずつダウンロードする。
 */
export async function exportWritings(ws: Writing[]): Promise<void> {
  const files = ws.map((w) => new File([w.png], fileName(w), { type: 'image/png' }));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (files.length && nav.canShare?.({ files })) {
    await navigator.share({ files }).catch(() => undefined);
    return;
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await new Promise((r) => setTimeout(r, 250)); // 連続ダウンロードがまとめて止められないよう少し間をあける
  }
}
