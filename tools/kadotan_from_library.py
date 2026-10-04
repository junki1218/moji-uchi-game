"""文（ぶん）の bun_14〜20 に、修学旅行カドタンの絵を使う（2026-10-04 ユーザー決定）。

    python tools/kadotan_from_library.py
    python tools/sync_images.py   ← そのあと、いつもどおりアプリ用に変換

素材: G:/マイドライブ/04_素材ライブラリ/画像材料/修学旅行カドタン/（読むだけ。変更しない）
コピー先: .agent_flow/assets/asset_TASK-007_bun_NN_kadotan_<うごき>.png（1024 四方）
台帳 ASSET_MANIFEST.json にも登録する（created_by は library）。

TASK-007 にしているのは、TASK-006（AGY の生成）で同じ id が後から届いても、
sync_images.py が「TASK 番号の大きい方」を使うので、かどたんの絵が残るようにするため。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LIB = Path("G:/マイドライブ/04_素材ライブラリ/画像材料/修学旅行カドタン")
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / ".agent_flow" / "assets"
MANIFEST = ROOT / ".agent_flow" / "ASSET_MANIFEST.json"
TASK = "TASK-007"

# id: (元の画像, うごきのローマ字, 文)
PICKS = {
    "bun_14": ("No102-DrinkTeaBottle-KD.png", "nomu", "かどたんが のむ"),
    "bun_15": ("No25-EatingHamburg-KD.png", "taberu", "かどたんが たべる"),
    "bun_16": ("No26-SleepingFuton-KD.png", "neru", "かどたんが ねる"),
    "bun_17": ("No170-WalkingAwayAlone-KD【QUIZ】.png", "aruku", "かどたんが あるく"),
    "bun_18": ("No89-ReadingHandbookSkytree-KD.png", "yomu", "かどたんが よむ"),
    "bun_19": ("No162-ToiletFlushWashHands-KD【QUIZ】.png", "arau", "かどたんが あらう"),
    "bun_20": ("No159-SeatSittingQuiet-KD【QUIZ】.png", "suwaru", "かどたんが すわる"),
}


def square(im: Image.Image) -> Image.Image:
    w, h = im.size
    s = min(w, h)
    return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((1024, 1024), Image.LANCZOS)


def main() -> None:
    missing = [src for src, _, _ in PICKS.values() if not (LIB / src).is_file()]
    if missing:
        sys.exit("素材が見つからない（G: の同期を確認）: " + ", ".join(missing))

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    assets = [a for a in manifest.get("assets", []) if a.get("task_id") != TASK]  # 作り直しても重複しない
    for qid, (src, verb, text) in PICKS.items():
        name = f"asset_{TASK}_{qid}_kadotan_{verb}.png"
        square(Image.open(LIB / src).convert("RGB")).save(ASSETS / name)
        assets.append({
            "id": qid,
            "type": "image",
            "purpose": f"問題イラスト ぶん: {text}（修学旅行カドタンから流用: {src}）",
            "file_path": f".agent_flow/assets/{name}",
            "dimensions": "1024x1024",
            "created_by": "library",
            "task_id": TASK,
        })
        print(f"{qid}  {text}  ← {src}")
    manifest["assets"] = assets
    manifest["last_updated"] = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
