// ワークシートを PDF にして、端末に保存する（2026-10-04: 印刷がうまくいかないことが多いので PDF に）。
// 各ページを 200dpi の canvas に描いてから PDF に貼る。iPad に教科書体の日本語フォントを持たせなくても、
// どの端末で開いても同じ見た目になる（そのかわり PDF の文字は選択できない）。
// 確認画面にも同じ canvas を出すので、見たとおりの PDF になる。
// jsPDF は大きいので、PDF を作るときだけ読み込む。
//
// 2026-10-22: 種類（みてかく＝視写／なぞる）・大きさ（ふつう＝A4縦5問／おおきい＝A4横2問）・
//             マス（十字線／カラーマス）を選べるようにした

import { fillCenteredAt } from './glyph';

export interface SheetItem {
  /** 表示する字（ひらがな／カタカナ設定に合わせた後） */
  chars: string[];
  /** 絵の URL（なければ絵文字） */
  imageUrl: string | null;
  emoji: string;
  /** 文の「が」の位置（見本で黒丸に白字にする）。単語なら null */
  particle?: number | null;
}

export type SheetKind = 'copy' | 'trace';
export type SheetSize = 'normal' | 'large';
export type SheetGrid = 'cross' | 'color';

export interface SheetOptions {
  /** copy＝見本の行を見て下に書く（視写）、trace＝うすい字をなぞる（＋下の行に自分で書く） */
  kind: SheetKind;
  /** normal＝A4 縦に5問、large＝A4 横に2問（拡大） */
  size: SheetSize;
  /** cross＝十字の補助線、color＝カラーマス（左上 空色・右上 ピンク・左下 黄色・右下 緑） */
  grid: SheetGrid;
}

export const DEFAULT_SHEET: SheetOptions = { kind: 'copy', size: 'normal', grid: 'cross' };

/** 1枚に入る問題の数 */
export const perPage = (o: SheetOptions): number => (o.size === 'large' ? 2 : 5);

const DPI = 200;
const S = DPI / 25.4; // 1mm あたりの px
const MARGIN_X = 14;
const MARGIN_Y = 12;

const GOTHIC = '"Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic UI", sans-serif';
const KYOKASHO = '"UD Digi Kyokasho NK-B", "UD Digi Kyokasho N-B", "Klee One", "Hiragino Maru Gothic ProN", sans-serif';
const MASU = { sky: '#cdeefc', pink: '#fcd9e6', yellow: '#fff1a8', green: '#d3f1cb' };
const TRACE_INK = '#bdbdbd'; // なぞる字の色（印刷してもなぞれるうすさ）

/** ページの寸法と、1問ぶんの大きさ（mm） */
function layout(o: SheetOptions) {
  const large = o.size === 'large';
  const pageW = large ? 297 : 210;
  const pageH = large ? 210 : 297;
  const pic = large ? 62 : 34;
  const gap = large ? 10 : 6;
  const maxCell = large ? 40 : 16;
  return { pageW, pageH, pic, gap, maxCell, writeW: pageW - MARGIN_X * 2 - pic - gap };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** マス1つ（枠＋十字線 か カラーマス） */
function drawCell(g: CanvasRenderingContext2D, x: number, y: number, cell: number, grid: SheetGrid): void {
  if (grid === 'color') {
    const half = cell / 2;
    g.fillStyle = MASU.sky; g.fillRect(x, y, half, half);
    g.fillStyle = MASU.pink; g.fillRect(x + half, y, half, half);
    g.fillStyle = MASU.yellow; g.fillRect(x, y + half, half, half);
    g.fillStyle = MASU.green; g.fillRect(x + half, y + half, half, half);
  } else {
    g.strokeStyle = '#c9c9c9';
    g.lineWidth = 0.3;
    g.setLineDash([1, 1]);
    g.beginPath();
    g.moveTo(x + cell / 2, y); g.lineTo(x + cell / 2, y + cell);
    g.moveTo(x, y + cell / 2); g.lineTo(x + cell, y + cell / 2);
    g.stroke();
    g.setLineDash([]);
  }
  g.strokeStyle = '#555';
  g.lineWidth = 0.35;
  g.strokeRect(x, y, cell, cell);
}

/** マスの中に字を1つ（文の「が」は黒い丸に白い字、「は」はピンクの丸に黒い字） */
function drawChar(g: CanvasRenderingContext2D, ch: string, x: number, y: number, cell: number, particle: boolean, color: string): void {
  const ha = ch === 'は' || ch === 'ハ';
  if (particle) {
    g.fillStyle = ha ? '#F9C9D6' : '#222';
    g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * 0.41, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = particle ? (ha ? '#222' : '#fff') : color;
  g.font = `600 ${cell * (particle ? 0.56 : 0.72)}px ${KYOKASHO}`;
  fillCenteredAt(g, ch, x + cell / 2, y + cell / 2);
}

async function drawPage(items: SheetItem[], o: SheetOptions, pageNo: number, pages: number): Promise<HTMLCanvasElement> {
  const L = layout(o);
  const c = document.createElement('canvas');
  c.width = Math.round(L.pageW * S);
  c.height = Math.round(L.pageH * S);
  const g = c.getContext('2d')!;
  // 先に canvas 全体を白で塗る（mm の端数で最後の1行が透明のまま残ると、JPEG で黒い線になる）
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.scale(S, S); // ここから先は mm で描く
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#222';
  g.strokeStyle = '#444';

  // 見出し
  const headY = MARGIN_Y + 8;
  g.font = `bold 5.5px ${GOTHIC}`;
  g.textAlign = 'left';
  g.fillText(o.kind === 'trace' ? 'がっくんの こくご なぞりがき' : 'がっくんの こくご ワークシート', MARGIN_X, headY);
  // 右から: 「＿＿がつ＿＿にち」「なまえ＿＿＿＿」
  g.font = `4.2px ${GOTHIC}`;
  let x = L.pageW - MARGIN_X;
  const blank = (w: number) => {
    g.lineWidth = 0.3;
    g.beginPath(); g.moveTo(x - w, headY + 0.8); g.lineTo(x, headY + 0.8); g.stroke();
    x -= w + 1.5;
  };
  const label = (t: string) => {
    g.textAlign = 'right';
    g.fillText(t, x, headY);
    x -= g.measureText(t).width + 1.5;
  };
  label('にち'); blank(10); label('がつ'); blank(10);
  x -= 6;
  blank(45); label('なまえ');
  g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(MARGIN_X, headY + 2.5); g.lineTo(L.pageW - MARGIN_X, headY + 2.5); g.stroke();
  g.textAlign = 'left';
  g.font = `600 5px ${KYOKASHO}`;
  g.fillText(o.kind === 'trace' ? 'なぞって かこう' : 'みて かこう', MARGIN_X, headY + 10);

  // 問題
  const top = headY + 14;
  const bottom = L.pageH - MARGIN_Y - 4;
  const slotH = (bottom - top) / perPage(o);
  const longest = Math.max(...items.map((it) => it.chars.length));
  const rowGap = o.size === 'large' ? 4 : 2.5;
  // マスの大きさ: 横は書ける幅、縦は2行（上の行＋下の行）が1問ぶんに入る大きさ
  const cell = Math.min(L.maxCell, Math.floor((L.writeW / longest) * 10) / 10, Math.floor(((slotH - 6 - rowGap) / 2) * 10) / 10);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const cy = top + slotH * i + slotH / 2;
    // 絵
    const pic = Math.min(L.pic, slotH - 6);
    const px = MARGIN_X;
    const py = cy - pic / 2;
    g.save();
    roundRect(g, px, py, pic, pic, 3);
    g.clip();
    g.fillStyle = '#fbf7f0';
    g.fillRect(px, py, pic, pic);
    const im = it.imageUrl ? await loadImage(it.imageUrl) : null;
    if (im) {
      g.drawImage(im, px, py, pic, pic);
    } else {
      g.font = `${pic * 0.7}px ${GOTHIC}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#222';
      g.fillText(it.emoji, px + pic / 2, cy + 1);
    }
    g.restore();
    g.lineWidth = 0.3;
    g.strokeStyle = '#ccc';
    roundRect(g, px, py, pic, pic, 3);
    g.stroke();

    // 上の行（見本 か なぞる字）と、下の行（自分で書く）
    const lx = MARGIN_X + pic + L.gap;
    const sy = cy - (cell * 2 + rowGap) / 2;
    const wy = sy + cell + rowGap;
    it.chars.forEach((ch, k) => {
      const cx = lx + k * cell;
      const isParticle = k === it.particle;
      if (o.kind === 'trace') {
        // なぞる行: マスの中にうすい字（「が」「は」は丸のまま）
        drawCell(g, cx, sy, cell, o.grid);
        drawChar(g, ch, cx, sy, cell, isParticle, TRACE_INK);
      } else {
        // 見本の行: 白いマスに黒い字
        g.strokeStyle = '#555';
        g.lineWidth = 0.35;
        g.strokeRect(cx, sy, cell, cell);
        drawChar(g, ch, cx, sy, cell, isParticle, '#222');
      }
      drawCell(g, cx, wy, cell, o.grid);
    });
    g.textBaseline = 'alphabetic';

    // 区切りの点線
    if (i < items.length - 1) {
      const ly = top + slotH * (i + 1);
      g.strokeStyle = '#bbb';
      g.lineWidth = 0.3;
      g.setLineDash([1.2, 1.2]);
      g.beginPath(); g.moveTo(MARGIN_X, ly); g.lineTo(L.pageW - MARGIN_X, ly); g.stroke();
      g.setLineDash([]);
    }
  }

  if (pages > 1) {
    g.font = `3.5px ${GOTHIC}`;
    g.fillStyle = '#888';
    g.textAlign = 'right';
    g.fillText(`${pageNo} / ${pages}`, L.pageW - MARGIN_X, L.pageH - 6);
  }
  return c;
}

/** ページの画像（確認画面と PDF の両方で使う） */
export async function worksheetPages(items: SheetItem[], o: SheetOptions): Promise<HTMLCanvasElement[]> {
  // 教科書体（Klee One）を読み込んでから描く（canvas は読み込み前のフォントだと代わりの字形になる）
  const allChars = [...new Set(items.flatMap((it) => it.chars).concat([...'みてかこうなぞ']))].join('');
  await Promise.all([
    document.fonts.load(`600 40px "Klee One"`, allChars),
    document.fonts.load(`40px ${GOTHIC}`, 'がっくんのこくごワークシートなぞりがきなまえがつにち'),
  ]).catch(() => undefined);

  const n = perPage(o);
  const pages = Math.ceil(items.length / n);
  const out: HTMLCanvasElement[] = [];
  for (let p = 0; p < pages; p++) out.push(await drawPage(items.slice(p * n, (p + 1) * n), o, p + 1, pages));
  return out;
}

/** ワークシートの PDF を作る（worksheetPages で作ったページから） */
export async function worksheetPdf(canvases: HTMLCanvasElement[], o: SheetOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const L = layout(o);
  const orientation = o.size === 'large' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  canvases.forEach((canvas, p) => {
    if (p > 0) doc.addPage('a4', orientation);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, L.pageW, L.pageH);
  });
  return doc.output('blob');
}

/** 端末に保存する。iPad は共有シート（「"ファイル"に保存」）、使えない環境はダウンロード */
export async function savePdf(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
