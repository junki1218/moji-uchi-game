// 視写ワークシートを A4 縦の PDF にして、端末に保存する（2026-10-04: 印刷がうまくいかないことが多いので PDF に）。
// 各ページを 200dpi の canvas に描いてから PDF に貼る。iPad に教科書体の日本語フォントを持たせなくても、
// どの端末で開いても同じ見た目になる（そのかわり PDF の文字は選択できない）。
// jsPDF は大きいので、PDF を作るときだけ読み込む。

export interface SheetItem {
  /** 表示する字（ひらがな／カタカナ設定に合わせた後） */
  chars: string[];
  /** 絵の URL（なければ絵文字） */
  imageUrl: string | null;
  emoji: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const DPI = 200;
const S = DPI / 25.4; // 1mm あたりの px
const MARGIN_X = 14;
const MARGIN_Y = 12;
const PIC = 34;
const GAP = 6;
const WRITE_W = PAGE_W - MARGIN_X * 2 - PIC - GAP; // 書ける幅 142mm
export const PER_PAGE = 5;

const GOTHIC = '"Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic UI", sans-serif';
const KYOKASHO = '"UD Digi Kyokasho NK-B", "UD Digi Kyokasho N-B", "Klee One", "Hiragino Maru Gothic ProN", sans-serif';

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

async function drawPage(items: SheetItem[], pageNo: number, pages: number): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = Math.round(PAGE_W * S);
  c.height = Math.round(PAGE_H * S);
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
  g.fillText('もじうち ワークシート', MARGIN_X, headY);
  // 右から: 「＿＿がつ＿＿にち」「なまえ＿＿＿＿」
  g.font = `4.2px ${GOTHIC}`;
  let x = PAGE_W - MARGIN_X;
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
  g.beginPath(); g.moveTo(MARGIN_X, headY + 2.5); g.lineTo(PAGE_W - MARGIN_X, headY + 2.5); g.stroke();
  g.textAlign = 'left';
  g.font = `600 5px ${KYOKASHO}`;
  g.fillText('みて かこう', MARGIN_X, headY + 10);

  // 問題（5段）
  const top = headY + 14;
  const bottom = PAGE_H - MARGIN_Y - 4;
  const slotH = (bottom - top) / PER_PAGE;
  const longest = Math.max(...items.map((it) => it.chars.length));
  const cell = Math.min(16, Math.floor((WRITE_W / longest) * 10) / 10);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const cy = top + slotH * i + slotH / 2;
    // 絵
    const px = MARGIN_X;
    const py = cy - PIC / 2;
    g.save();
    roundRect(g, px, py, PIC, PIC, 3);
    g.clip();
    g.fillStyle = '#fbf7f0';
    g.fillRect(px, py, PIC, PIC);
    const im = it.imageUrl ? await loadImage(it.imageUrl) : null;
    if (im) {
      g.drawImage(im, px, py, PIC, PIC);
    } else {
      g.font = `24px ${GOTHIC}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#222';
      g.fillText(it.emoji, px + PIC / 2, cy + 1);
    }
    g.restore();
    g.lineWidth = 0.3;
    g.strokeStyle = '#ccc';
    roundRect(g, px, py, PIC, PIC, 3);
    g.stroke();

    // 見本の行と書く行
    const lx = MARGIN_X + PIC + GAP;
    const rowsH = cell * 2 + 2.5;
    const sy = cy - rowsH / 2;
    const wy = sy + cell + 2.5;
    it.chars.forEach((ch, k) => {
      const cx = lx + k * cell;
      // 書く行の十字の補助線
      g.strokeStyle = '#c9c9c9';
      g.lineWidth = 0.3;
      g.beginPath();
      g.moveTo(cx + cell / 2, wy); g.lineTo(cx + cell / 2, wy + cell);
      g.moveTo(cx, wy + cell / 2); g.lineTo(cx + cell, wy + cell / 2);
      g.stroke();
      // マスの枠
      g.strokeStyle = '#555';
      g.lineWidth = 0.35;
      g.strokeRect(cx, sy, cell, cell);
      g.strokeRect(cx, wy, cell, cell);
      // 見本の字（教科書体）
      g.fillStyle = '#222';
      g.font = `600 ${cell * 0.72}px ${KYOKASHO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, cx + cell / 2, sy + cell / 2 + cell * 0.04);
    });
    g.textBaseline = 'alphabetic';

    // 区切りの点線
    if (i < items.length - 1) {
      const ly = top + slotH * (i + 1);
      g.strokeStyle = '#bbb';
      g.lineWidth = 0.3;
      g.setLineDash([1.2, 1.2]);
      g.beginPath(); g.moveTo(MARGIN_X, ly); g.lineTo(PAGE_W - MARGIN_X, ly); g.stroke();
      g.setLineDash([]);
    }
  }

  if (pages > 1) {
    g.font = `3.5px ${GOTHIC}`;
    g.fillStyle = '#888';
    g.textAlign = 'right';
    g.fillText(`${pageNo} / ${pages}`, PAGE_W - MARGIN_X, PAGE_H - 6);
  }
  return c;
}

/** ワークシートの PDF を作る */
export async function worksheetPdf(items: SheetItem[]): Promise<Blob> {
  // 教科書体（Klee One）を読み込んでから描く（canvas は読み込み前のフォントだと代わりの字形になる）
  const allChars = [...new Set(items.flatMap((it) => it.chars).concat([...'みてかこう']))].join('');
  await Promise.all([
    document.fonts.load(`600 40px "Klee One"`, allChars),
    document.fonts.load(`40px ${GOTHIC}`, 'もじうちワークシートなまえがつにち'),
  ]).catch(() => undefined);

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pages = Math.ceil(items.length / PER_PAGE);
  for (let p = 0; p < pages; p++) {
    const canvas = await drawPage(items.slice(p * PER_PAGE, (p + 1) * PER_PAGE), p + 1, pages);
    if (p > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H);
  }
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
