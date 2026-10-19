"""文（ぶん）と文・きもちの一部に、「うごき」「きもち」の女の子の絵を使う（2026-10-19 ユーザー決定）。

    python tools/girl_from_ugoki.py
    python tools/sync_images.py   ← そのあと、いつもどおりアプリ用に変換

元: .agent_flow/assets/ の ugoki・kimochi の生成画像（TASK-001・TASK-004）
コピー先: .agent_flow/assets/asset_TASK-010_{id}_<ローマ字>.png
TASK-010 にしているのは、古い TASK-007・TASK-008 の絵が手元に残っていても、
sync_images.py が「TASK 番号の大きい方」を使うので、こちらの絵になるようにするため。
廃止した bunkimochi_19・20 と、差し替え前の絵（TASK-007・TASK-008 の同じ id）は手元から消す。
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / ".agent_flow" / "assets"
TASK = "TASK-010"

# id: (元の画像, ローマ字)
PICKS = {
    "bun_14": ("asset_TASK-004_ugoki_04_nomu.png", "nomu"),
    "bun_15": ("asset_TASK-004_ugoki_03_taberu.png", "taberu"),
    "bun_16": ("asset_TASK-004_ugoki_05_neru.png", "neru"),
    "bun_17": ("asset_TASK-004_ugoki_02_aruku.png", "aruku"),
    "bun_18": ("asset_TASK-004_ugoki_11_yomu.png", "yomu"),
    "bun_19": ("asset_TASK-004_ugoki_12_arau.png", "arau"),
    "bun_20": ("asset_TASK-004_ugoki_13_suwaru.png", "suwaru"),
    "bunkimochi_03": ("asset_TASK-001_kimochi_01_ureshii.png", "ureshii"),
    "bunkimochi_11": ("asset_TASK-001_kimochi_16_komaru.png", "komaru"),
    "bunkimochi_17": ("asset_TASK-001_kimochi_03_tanoshii.png", "tanoshii"),
}
OLD = ["TASK-007", "TASK-008"]
DROPPED = ["bunkimochi_19", "bunkimochi_20"]


def main() -> None:
    for qid in [*PICKS, *DROPPED]:
        for task in OLD:
            for p in ASSETS.glob(f"asset_{task}_{qid}_*.png"):
                p.unlink()
                print(f"消した: {p.name}")
    for qid, (src, romaji) in PICKS.items():
        if not (ASSETS / src).is_file():
            print(f"元の絵がない（スキップ）: {src}")
            continue
        shutil.copyfile(ASSETS / src, ASSETS / f"asset_{TASK}_{qid}_{romaji}.png")
        print(f"{qid}  ← {src}")


if __name__ == "__main__":
    main()
