"""UI 画像を Google ドライブの素材ライブラリ（同期フォルダ G:）から作る。

    python tools/ui_from_library.py

素材（2026-09-30 ユーザー承認）:
- G:/マイドライブ/04_素材ライブラリ/画像材料/ClayAnimation/
- G:/マイドライブ/04_素材ライブラリ/画像材料/animal school/
文字が描き込まれていない絵だけを選んでいる。元の画像は読むだけで変更しない。

出力は src/images/*.webp と public/icons/*.png（アプリはこの名前で読む）。
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LIB = Path("G:/マイドライブ/04_素材ライブラリ/画像材料")
CLAY = LIB / "ClayAnimation"
ANIMAL = LIB / "animal school"

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "src" / "images"
ICONS = ROOT / "public" / "icons"

# 出力名: (元画像, 拡大率, 縦の切り抜き位置 0=上 0.5=中央)
CATEGORIES = {
    "cat_mono": (CLAY / "clay_menu_curry.png", 1.0, 0.5),
    "cat_kimochi": (CLAY / "clay_emoji_joyful.png", 1.0, 0.5),
    "cat_ugoki": (ANIMAL / "ゾウ_1_走る.png", 1.15, 0.5),
    "cat_bun": (ANIMAL / "キリン_7_バス.png", 1.3, 0.55),  # 右上の小さな看板が入らないよう中央を拡大
    "cat_bunkimochi": (CLAY / "smile_both_happy (1).png", 1.15, 0.45),
}
STAMPS = {
    "stamp_1": (ANIMAL / "ウサギ_1_走る.png", 1.9, 0.42),
    "stamp_2": (ANIMAL / "ゴリラ_1_走る.png", 1.9, 0.42),
    "stamp_3": (ANIMAL / "ライオン_1_走る.png", 1.9, 0.42),
    "stamp_4": (ANIMAL / "キリン_5_肩組み.png", 1.9, 0.42),
}
ICON = CLAY / "clay_emoji_happy.png"
START_BG = CLAY / "clay_park_children.jpg"


def square(src: Path, zoom: float, cy: float) -> Image.Image:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = int(min(w, h) / zoom)
    x = (w - s) // 2
    y = int((h - s) * cy)
    return im.crop((x, y, x + s, y + s))


def circle(im: Image.Image, n: int) -> Image.Image:
    im = im.resize((n, n), Image.LANCZOS)
    mask = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n * 4, n * 4), fill=255)
    out = Image.new("RGBA", (n, n))
    out.paste(im, (0, 0), mask.resize((n, n), Image.LANCZOS))
    return out


def main() -> None:
    missing = [p for p in [ICON, START_BG, *[v[0] for v in (*CATEGORIES.values(), *STAMPS.values())]] if not p.is_file()]
    if missing:
        sys.exit("素材が見つからない（G: の同期を確認）: " + ", ".join(str(p) for p in missing))
    IMAGES.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    for name, (src, zoom, cy) in CATEGORIES.items():
        square(src, zoom, cy).resize((512, 512), Image.LANCZOS).save(IMAGES / f"{name}.webp", "WEBP", quality=82, method=6)
    for name, (src, zoom, cy) in STAMPS.items():
        circle(square(src, zoom, cy), 320).save(IMAGES / f"{name}.webp", "WEBP", quality=85, method=6)

    bg = Image.open(START_BG).convert("RGB")
    w, h = bg.size
    hh = int(w * 9 / 16)
    top = (h - hh) // 2
    bg.crop((0, top, w, top + hh)).resize((1600, 900), Image.LANCZOS).save(
        IMAGES / "start_bg.webp", "WEBP", quality=78, method=6
    )

    icon = square(ICON, 1.0, 0.5).resize((1024, 1024), Image.LANCZOS)
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")):
        icon.resize((size, size), Image.LANCZOS).save(ICONS / name)

    print(f"カテゴリ {len(CATEGORIES)}、スタンプ {len(STAMPS)}、背景 1、アイコン 3 を作成")


if __name__ == "__main__":
    main()
