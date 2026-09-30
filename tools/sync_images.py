"""Antigravity の生成画像（.agent_flow/assets/）をアプリ用に変換して public/ に置く。

    python tools/sync_images.py

- asset_TASK-00N_{id}_{romaji}.png  → public/images/{id}.webp   （問題イラスト 512px）
- asset_TASK-005_{name}.png         → public/images/{name}.webp （カテゴリ・花丸・スタンプ・背景）
- asset_TASK-005_icon.png           → public/icons/*.png         （キートップに「あ」を合成）
  アイコン元絵がまだなければ、仮アイコンを描いて置く。

同じ id の画像が複数あるときは、TASK 番号の大きい方（＝後から作り直した方）を使う。
何度実行してもよい（毎回上書き）。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".agent_flow" / "assets"
IMAGES = ROOT / "public" / "images"
ICONS = ROOT / "public" / "icons"

# Windows の端末(cp932)でも日本語が化けないように
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QUESTION_RE = re.compile(r"^asset_(TASK-\d+)_((?:mono|kimochi|ugoki)_\d{2})_[a-z]+\.png$")
UI_RE = re.compile(r"^asset_(TASK-\d+)_((?:cat|stamp)_[a-z]+|hanamaru|start_bg)\.png$")

BG = (0xFF, 0xF7, 0xEC)
ICON_BG = (0xFF, 0xB8, 0x4D)
FONT_CANDIDATES = [
    "C:/Windows/Fonts/BIZ-UDGothicB.ttc",
    "C:/Windows/Fonts/YuGothB.ttc",
    "C:/Windows/Fonts/meiryob.ttc",
    "C:/Windows/Fonts/msgothic.ttc",
]


def pick_latest(pattern: re.Pattern) -> dict[str, Path]:
    found: dict[str, tuple[str, Path]] = {}
    for p in sorted(SRC.glob("asset_*.png")):
        m = pattern.match(p.name)
        if not m:
            continue
        task, key = m.group(1), m.group(2)
        if key not in found or task > found[key][0]:
            found[key] = (task, p)
    return {k: v[1] for k, v in found.items()}


def to_webp(src: Path, dest: Path, max_side: int) -> None:
    im = Image.open(src).convert("RGB")
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(dest, "WEBP", quality=82, method=6)


def font(size: int) -> ImageFont.FreeTypeFont:
    for f in FONT_CANDIDATES:
        if Path(f).is_file():
            return ImageFont.truetype(f, size)
    sys.exit("日本語フォントが見つからない: " + ", ".join(FONT_CANDIDATES))


def make_icons() -> str:
    src = SRC / "asset_TASK-005_icon.png"
    if src.is_file():
        base = Image.open(src).convert("RGB").resize((1024, 1024), Image.LANCZOS)
        note = "元絵あり"
    else:
        # 仮アイコン: オレンジ地に白いキー
        base = Image.new("RGB", (1024, 1024), ICON_BG)
        d = ImageDraw.Draw(base)
        d.rounded_rectangle((212, 232, 812, 832), radius=110, fill=(0xE0, 0x8E, 0x1F))
        d.rounded_rectangle((212, 192, 812, 792), radius=110, fill=(255, 255, 255))
        note = "仮アイコン（元絵なし）"
    d = ImageDraw.Draw(base)
    d.text((512, 500), "あ", font=font(420), fill=(0x2B, 0x2B, 0x2B), anchor="mm")
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")):
        base.resize((size, size), Image.LANCZOS).save(ICONS / name)
    return note


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    questions = pick_latest(QUESTION_RE)
    for key, p in questions.items():
        to_webp(p, IMAGES / f"{key}.webp", 512)

    ui = pick_latest(UI_RE)
    for key, p in ui.items():
        to_webp(p, IMAGES / f"{key}.webp", 1920 if key == "start_bg" else 512)

    note = make_icons()
    print(f"問題イラスト {len(questions)}/60 枚、UI画像 {len(ui)}/9 枚、アイコン: {note}")
    missing = sorted(
        f"{c}_{i:02d}" for c in ("mono", "kimochi", "ugoki") for i in range(1, 21)
        if f"{c}_{i:02d}" not in questions
    )
    if missing:
        print(f"未着 {len(missing)} 枚（絵文字で仮表示）: " + " ".join(missing))


if __name__ == "__main__":
    main()
