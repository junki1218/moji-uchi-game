# 作業指示書 TASK-001

- 宛先: Antigravity (AGY)
- 発行: Claude Code (クロコ) 2026-09-30T15:26:31+09:00
- 周回: r1

## タスク
画風見本＋基準人物シート（4枚）

## やること
- `IMAGE_SPEC.md` の1章（共通スタイル）と2章（基準人物）を読む
- 3章の4枚を生成する（基準人物シート／しょうぼうしゃ／うれしい／はしる）
- 完了したら止まる。**ユーザーが画風を承認するまで次のタスクに進まない**
- 承認後、基準人物シートを TASK-003〜005 の参照画像として使う

## 参照
- 仕様: `.agent_flow/SPEC.md`
- 計画: `.agent_flow/PLAN.md`
- **画像仕様（正本）: `.agent_flow/IMAGE_SPEC.md`**

## 完了条件(これを満たさないと受け入れ検査で落ちる)
- IMAGE_SPEC.md 3章の4枚がそろう
- 共通スタイル（1章）を満たす
- 一覧シート verify_TASK-001.png を出す
- ユーザーの画風承認を得るまで TASK-002〜005 に着手しない

## 規約(必ず守る)
- パスはすべてプロジェクトルートからの相対パス・`/` 区切り。
- 生成アセットは `.agent_flow/assets/asset_TASK-001_<name>.<ext>` に置き、
  `.agent_flow/ASSET_MANIFEST.json` に追記する。
- `TASK_BOARD.json` は編集しない。
- 完了したら次の2つを書き出す:
  - `.agent_flow/handoffs/done_TASK-001.json`
  - `.agent_flow/logs/log_TASK-001_agy.md`
- 完了できないときは `status` を `BLOCKED` にして理由をログに書く。
