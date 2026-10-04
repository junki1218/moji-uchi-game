"""Antigravity の生成画像（.agent_flow/assets/）をアプリ用に変換して public/ に置く。

    python tools/sync_images.py

- asset_TASK-00N_{id}_{romaji}.png  → src/images/{id}.webp   （問題イラスト 512px。文は bun_01_inu_hashiru など）
UI 画像（アイコン・カテゴリ・スタンプ・背景）は tools/ui_from_library.py が素材ライブラリから作る
（2026-09-30 方針変更。TASK-005 の生成は行わない）。

同じ id の画像が複数あるときは、TASK 番号の大きい方（＝後から作り直した方）を使う。
何度実行してもよい（毎回上書き）。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".agent_flow" / "assets"
IMAGES = ROOT / "src" / "images"  # Vite が版ごとの印付きの名前で出力する

# Windows の端末(cp932)でも日本語が化けないように
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QUESTION_RE = re.compile(r"^asset_(TASK-\d+)_((?:mono|kimochi|ugoki|bunkimochi|bun)_\d{2})_[a-z_]+\.png$")



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



def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)

    questions = pick_latest(QUESTION_RE)
    for key, p in questions.items():
        to_webp(p, IMAGES / f"{key}.webp", 512)

    print(f"問題イラスト {len(questions)}/80 枚")
    missing = sorted(
        f"{c}_{i:02d}" for c in ("mono", "kimochi", "ugoki", "bun") for i in range(1, 21)
        if f"{c}_{i:02d}" not in questions
    )
    if missing:
        print(f"未着 {len(missing)} 枚（絵文字で仮表示）: " + " ".join(missing))


if __name__ == "__main__":
    main()
