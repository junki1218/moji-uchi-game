"""配布用の視写ワークシート（PDF）を、カテゴリ別に作る（2026-10-04）。

    python tools/make_worksheets.py

アプリの時間とは別に、ワークシートの時間や自習で使う用。
- もの／うごき／きもち／ぶん／ぶん・きもち の5つ。各カテゴリの20問すべて（A4 縦・1枚5問 → 4枚）
- それぞれ ひらがな版 と カタカナ版（2026-10-05 追加）。カタカナ版でも文の「が」はひらがなのまま
- 文の「が」は、見本の行で黒い丸に白い字（アプリの見本と同じ）
- レイアウトはアプリのワークシート（src/worksheet-pdf.ts）と同じ:
  絵（34mm）＋見本の行（教科書体）＋書く行（十字の補助線）
- 見本の字は Windows の「UD デジタル教科書体 N-B」、見出しは BIZ UDゴシック
- 絵は src/images/{id}.webp（アプリと同じ絵）。単語は src/questions.ts から読む

出力: public/worksheets/worksheet_{カテゴリ}.pdf と worksheet_{カテゴリ}_kata.pdf（公開サイト・アプリの「プリント」からダウンロードできる）
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "src" / "questions.ts"
IMAGES = ROOT / "src" / "images"
OUT = ROOT / "public" / "worksheets"

FONT_KYOKASHO = "C:/Windows/Fonts/UDDigiKyokashoN-B.ttc"
FONT_GOTHIC_B = "C:/Windows/Fonts/BIZ-UDGothicB.ttc"
FONT_GOTHIC_R = "C:/Windows/Fonts/BIZ-UDGothicR.ttc"

CATEGORIES = [("mono", "もの"), ("ugoki", "うごき"), ("kimochi", "きもち"), ("bun", "ぶん"), ("bunkimochi", "ぶん・きもち")]
WORD_CATEGORIES = ("mono", "ugoki", "kimochi")
PARTICLE = "が"

# 寸法（mm）。アプリの src/worksheet-pdf.ts と同じ
DPI = 300
S = DPI / 25.4
PAGE_W, PAGE_H = 210, 297
MARGIN_X, MARGIN_Y = 14, 12
PIC, GAP = 34, 6
WRITE_W = PAGE_W - MARGIN_X * 2 - PIC - GAP  # 142mm
PER_PAGE = 5


def px(v: float) -> int:
    return round(v * S)


def font(path: str, size_mm: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, px(size_mm))


# 1問 = (id, 字の並び, 「が」の位置 or None)
Item = tuple[str, list[str], "int | None"]


def load_items() -> dict[str, list[Item]]:
    """questions.ts から読む。単語は q('mono', [ ['りんご', '🍎'], ... ])、文は sentence('bun_01', 'いぬ', 'はしる', ...)"""
    t = QUESTIONS.read_text(encoding="utf-8")
    items: dict[str, list[Item]] = {}
    for cat in WORD_CATEGORIES:
        start = t.index(f"...q('{cat}', [")
        block = t[start : t.index("]),", start)]
        found = re.findall(r"\['([^']+)', '[^']*'\]", block)
        items[cat] = [(f"{cat}_{i:02d}", list(w), None) for i, w in enumerate(found, 1)]
    for cat in ("bun", "bunkimochi"):
        found = re.findall(rf"sentence\('({cat}_\d{{2}})', '([^']+)', '([^']+)'", t)
        items[cat] = [(qid, list(s + PARTICLE + v), len(s)) for qid, s, v in found]
    return items


def to_kata(chars: list[str], particle: "int | None") -> list[str]:
    """ひらがな → カタカナ（ー はそのまま）。文の「が」はひらがなのまま"""
    return [c if k == particle or not ("ぁ" <= c <= "ゖ") else chr(ord(c) + 0x60) for k, c in enumerate(chars)]


def dashed_h(d: ImageDraw.ImageDraw, x1: float, x2: float, y: float, color: str) -> None:
    x = x1
    while x < x2:
        d.line([(px(x), px(y)), (px(min(x + 1.2, x2)), px(y))], fill=color, width=max(1, px(0.3)))
        x += 2.4


def draw_page(items: list[Item], label: str, page_no: int, pages: int) -> Image.Image:
    im = Image.new("RGB", (px(PAGE_W), px(PAGE_H)), "white")
    d = ImageDraw.Draw(im)
    ink = "#222222"

    # 見出し
    head_y = MARGIN_Y + 8  # 文字の下端の位置
    f_small = font(FONT_GOTHIC_R, 4.2)
    title = f"ワークシート（{label}）"
    # 右の「なまえ（下線20mm以上）／がつ／にち」に重ならない大きさまで、見出しの字を小さくする
    right_w = sum(d.textlength(s, font=f_small) / S + 1.5 for s in ("にち", "がつ", "なまえ")) + (10 + 1.5) * 2 + 6 + 20 + 1.5
    size = 5.5
    while size > 3.5 and d.textlength(title, font=font(FONT_GOTHIC_B, size)) / S > PAGE_W - MARGIN_X * 2 - right_w - 4:
        size -= 0.25
    f_title = font(FONT_GOTHIC_B, size)
    d.text((px(MARGIN_X), px(head_y)), title, font=f_title, fill=ink, anchor="ls")
    title_end = MARGIN_X + d.textlength(title, font=f_title) / S
    x = PAGE_W - MARGIN_X

    def lbl(text: str) -> None:
        nonlocal x
        d.text((px(x), px(head_y)), text, font=f_small, fill=ink, anchor="rs")
        x -= d.textlength(text, font=f_small) / S + 1.5

    def blank(w: float) -> None:
        nonlocal x
        d.line([(px(x - w), px(head_y + 0.8)), (px(x), px(head_y + 0.8))], fill="#444444", width=px(0.3))
        x -= w + 1.5

    lbl("にち"); blank(10); lbl("がつ"); blank(10)
    x -= 6
    # なまえの下線は、見出しとの間を 4mm 以上あけられる長さにする（最大 45mm）
    name_label_w = d.textlength("なまえ", font=f_small) / S + 1.5
    blank(max(20.0, min(45.0, x - title_end - 4 - name_label_w - 1.5))); lbl("なまえ")
    d.line([(px(MARGIN_X), px(head_y + 2.5)), (px(PAGE_W - MARGIN_X), px(head_y + 2.5))], fill="#444444", width=px(0.6))
    d.text((px(MARGIN_X), px(head_y + 10)), "みて かこう", font=font(FONT_KYOKASHO, 5), fill=ink, anchor="ls")

    # 問題（5段）
    top = head_y + 14
    bottom = PAGE_H - MARGIN_Y - 4
    slot = (bottom - top) / PER_PAGE
    longest = max(len(w) for _, w, _ in items)
    cell = min(16.0, int(WRITE_W / longest * 10) / 10)
    f_cell = font(FONT_KYOKASHO, cell * 0.72)
    f_particle = font(FONT_KYOKASHO, cell * 0.56)

    for i, (qid, word, particle) in enumerate(items):
        cy = top + slot * i + slot / 2
        # 絵（角を丸めた枠）
        x0, y0 = MARGIN_X, cy - PIC / 2
        box = (px(x0), px(y0), px(x0 + PIC), px(y0 + PIC))
        src = IMAGES / f"{qid}.webp"
        if src.is_file():
            pic = Image.open(src).convert("RGB").resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
            mask = Image.new("L", pic.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, pic.size[0] - 1, pic.size[1] - 1), radius=px(3), fill=255)
            im.paste(pic, box[:2], mask)
        d.rounded_rectangle(box, radius=px(3), outline="#cccccc", width=px(0.3))

        # 見本の行と書く行
        lx = MARGIN_X + PIC + GAP
        sy = cy - (cell * 2 + 2.5) / 2
        wy = sy + cell + 2.5
        for k, ch in enumerate(word):
            cx = lx + k * cell
            # 十字の補助線（書く行）
            d.line([(px(cx + cell / 2), px(wy)), (px(cx + cell / 2), px(wy + cell))], fill="#c9c9c9", width=px(0.3))
            d.line([(px(cx), px(wy + cell / 2)), (px(cx + cell), px(wy + cell / 2))], fill="#c9c9c9", width=px(0.3))
            for yy in (sy, wy):
                d.rectangle((px(cx), px(yy), px(cx + cell), px(yy + cell)), outline="#555555", width=px(0.35))
            if k == particle:
                # 文の「が」は黒い丸に白い字
                r = cell * 0.4
                d.ellipse((px(cx + cell / 2 - r), px(sy + cell / 2 - r), px(cx + cell / 2 + r), px(sy + cell / 2 + r)), fill=ink)
                d.text((px(cx + cell / 2), px(sy + cell / 2)), ch, font=f_particle, fill="white", anchor="mm")
            else:
                d.text((px(cx + cell / 2), px(sy + cell / 2)), ch, font=f_cell, fill=ink, anchor="mm")

        if i < len(items) - 1:
            dashed_h(d, MARGIN_X, PAGE_W - MARGIN_X, top + slot * (i + 1), "#bbbbbb")

    d.text((px(MARGIN_X), px(PAGE_H - 6)), "がっくんの こくご", font=font(FONT_GOTHIC_R, 3.5), fill="#888888", anchor="ls")
    if pages > 1:
        d.text((px(PAGE_W - MARGIN_X), px(PAGE_H - 6)), f"{page_no} / {pages}", font=font(FONT_GOTHIC_R, 3.5), fill="#888888", anchor="rs")
    return im


def main() -> None:
    for f in (FONT_KYOKASHO, FONT_GOTHIC_B, FONT_GOTHIC_R):
        if not Path(f).is_file():
            sys.exit("フォントが見つからない: " + f)
    OUT.mkdir(parents=True, exist_ok=True)
    all_items = load_items()
    for cat, label in CATEGORIES:
        for kata in (False, True):
            items = all_items[cat]
            if kata:
                items = [(qid, to_kata(w, pi), pi) for qid, w, pi in items]
            name = f"worksheet_{cat}{'_kata' if kata else ''}"
            lab = f"{label}・カタカナ" if kata else label
            pages = [items[i : i + PER_PAGE] for i in range(0, len(items), PER_PAGE)]
            imgs = [draw_page(p, lab, n + 1, len(pages)) for n, p in enumerate(pages)]
            out = OUT / f"{name}.pdf"
            imgs[0].save(out, "PDF", resolution=DPI, save_all=True, append_images=imgs[1:])
            # 確認用に1枚目を PNG でも出す（リポジトリには入れない）
            imgs[0].resize((imgs[0].width // 4, imgs[0].height // 4)).save(ROOT / ".agent_flow" / "artifacts" / f"worksheet_preview_{name}.png")
            print(f"{out.relative_to(ROOT).as_posix()}  {lab} {len(items)}問  A4 {len(pages)}枚  {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
