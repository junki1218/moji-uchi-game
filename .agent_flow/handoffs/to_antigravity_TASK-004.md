# 作業指示書 TASK-004

- 宛先: Antigravity (AGY)
- 発行: Claude Code (クロコ) 2026-09-30T15:26:31+09:00
- 周回: r1

## タスク
問題イラスト うごき（19枚）

## やること
- `IMAGE_SPEC.md` 4.3 の表どおり、ugoki_01 以外の19枚を生成する
- 参照画像: `asset_TASK-001_ref_person.png` と `asset_TASK-001_ugoki_01_hashiru.png`
- 全身・動作がはっきり分かる瞬間。道具は1つまで

## 参照
- 仕様: `.agent_flow/SPEC.md`
- 計画: `.agent_flow/PLAN.md`
- **画像仕様（正本）: `.agent_flow/IMAGE_SPEC.md`**

## 完了条件(これを満たさないと受け入れ検査で落ちる)
- IMAGE_SPEC.md 4.3 の表から ugoki_01 を除く19枚
- 基準人物（ref_person）と同じ人物
- 7章のチェックをすべて満たす
- 一覧シート verify_TASK-004.png を出す

## 規約(必ず守る)
- パスはすべてプロジェクトルートからの相対パス・`/` 区切り。
- 生成アセットは `.agent_flow/assets/asset_TASK-004_<name>.<ext>` に置き、
  `.agent_flow/ASSET_MANIFEST.json` に追記する。
- `TASK_BOARD.json` は編集しない。
- 完了したら次の2つを書き出す:
  - `.agent_flow/handoffs/done_TASK-004.json`
  - `.agent_flow/logs/log_TASK-004_agy.md`
- 完了できないときは `status` を `BLOCKED` にして理由をログに書く。
