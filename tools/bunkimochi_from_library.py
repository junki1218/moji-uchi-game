"""文・きもち（ぶん・きもち）の絵を、素材ライブラリの登場人物の表情から作る（2026-10-05 ユーザー指示）。

    python tools/bunkimochi_from_library.py
    python tools/sync_images.py   ← そのあと、いつもどおりアプリ用に変換

素材（読むだけ。変更しない）: G:/マイドライブ/04_素材ライブラリ/画像材料/
  animal school/ ・ 修学旅行カドタン/ ・ ClayAnimation/
コピー先: .agent_flow/assets/asset_TASK-008_bunkimochi_NN_<きもち>.png（1024 四方）
台帳 ASSET_MANIFEST.json にも登録する（created_by は library）。

表情は絵を見て選んだ（ヒントの「きもちの絵」は、きもちカテゴリの同じ言葉の絵を使う）。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LIB = Path("G:/マイドライブ/04_素材ライブラリ/画像材料")
ANIMAL = "animal school"
KD = "修学旅行カドタン"
CLAY = "ClayAnimation"
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / ".agent_flow" / "assets"
MANIFEST = ROOT / ".agent_flow" / "ASSET_MANIFEST.json"
TASK = "TASK-008"

# id: (フォルダ, 元の画像, きもちのローマ字, 文, 切り抜き)
# 切り抜き = (中心x, 中心y, 一辺) を元画像の短い辺に対する割合で。None は中央の正方形
PICKS = {
    "bunkimochi_01": (ANIMAL, "ウサギ_3_給食.png", "ureshii", "うさぎが うれしい", None),
    "bunkimochi_02": (ANIMAL, "ゾウ_5_肩組み.png", "ureshii", "ぞうが うれしい", None),
    "bunkimochi_03": (KD, "No38-HarajukuCrepe-KD.png", "ureshii", "かどたんが うれしい", None),
    "bunkimochi_04": (CLAY, "idea_girl_light.png", "ureshii", "おんなのこが うれしい", None),
    "bunkimochi_05": (CLAY, "clay_sad_child.png", "kanashii", "おとこのこが かなしい", None),
    "bunkimochi_06": (CLAY, "vacuum_boy_touch.png", "okoru", "おんなのこが おこる", (0.72, 0.45, 0.62)),
    "bunkimochi_07": (CLAY, "fan_clean_ng_plugged.png", "okoru", "ともだちが おこる", (0.72, 0.45, 0.62)),
    "bunkimochi_08": (ANIMAL, "ライオン_2_勉強.png", "komaru", "らいおんが こまる", None),
    "bunkimochi_09": (CLAY, "cord_boy_tangle.png", "komaru", "おとこのこが こまる", None),
    "bunkimochi_10": (CLAY, "cord_girl_tangle.png", "komaru", "おんなのこが こまる", None),
    "bunkimochi_11": (KD, "No97-HelpToiletUrgent-KD.png", "komaru", "かどたんが こまる", None),
    "bunkimochi_12": (CLAY, "shock_boy_face.png", "bikkuri", "おとこのこが びっくり", None),
    "bunkimochi_13": (CLAY, "shock_girl_face (1).png", "bikkuri", "おんなのこが びっくり", None),
    "bunkimochi_14": (ANIMAL, "ゴリラ_6_歌う.png", "tanoshii", "ごりらが たのしい", None),
    "bunkimochi_15": (ANIMAL, "ウサギ_6_歌う.png", "tanoshii", "うさぎが たのしい", None),
    "bunkimochi_16": (ANIMAL, "ライオン_6_歌う.png", "tanoshii", "らいおんが たのしい", None),
    "bunkimochi_17": (KD, "No46-RyokanTrump-KD.png", "tanoshii", "かどたんが たのしい", None),
    "bunkimochi_18": (ANIMAL, "ゴリラ_2_勉強.png", "nemui", "ごりらが ねむい", None),
    "bunkimochi_19": (KD, "No96-HelpEarPain-KD.png", "itai", "みみが いたい", None),
    "bunkimochi_20": (KD, "No165-SeatHoldingItIn-KD【QUIZ】.png", "itai", "おなかが いたい", None),
}


def square(im: Image.Image, crop: tuple[float, float, float] | None) -> Image.Image:
    w, h = im.size
    m = min(w, h)
    if crop is None:
        x, y, s = (w - m) // 2, (h - m) // 2, m
    else:
        cx, cy, f = crop
        s = int(m * f)
        x = min(max(int(w * cx - s / 2), 0), w - s)
        y = min(max(int(h * cy - s / 2), 0), h - s)
    return im.crop((x, y, x + s, y + s)).resize((1024, 1024), Image.LANCZOS)


def main() -> None:
    missing = [f"{d}/{src}" for d, src, *_ in PICKS.values() if not (LIB / d / src).is_file()]
    if missing:
        sys.exit("素材が見つからない（G: の同期を確認）: " + ", ".join(missing))

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    assets = [a for a in manifest.get("assets", []) if a.get("task_id") != TASK]  # 作り直しても重複しない
    for qid, (folder, src, feel, text, crop) in PICKS.items():
        name = f"asset_{TASK}_{qid}_{feel}.png"
        square(Image.open(LIB / folder / src).convert("RGB"), crop).save(ASSETS / name)
        assets.append({
            "id": qid,
            "type": "image",
            "purpose": f"問題イラスト ぶん・きもち: {text}（素材ライブラリから流用: {folder}/{src}）",
            "file_path": f".agent_flow/assets/{name}",
            "dimensions": "1024x1024",
            "created_by": "library",
            "task_id": TASK,
        })
        print(f"{qid}  {text}  ← {folder}/{src}")
    manifest["assets"] = assets
    manifest["last_updated"] = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
