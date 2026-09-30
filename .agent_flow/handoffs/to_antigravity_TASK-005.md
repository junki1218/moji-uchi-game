# 作業指示書 TASK-005

- 宛先: Antigravity (AGY)
- 発行: Claude Code (クロコ) 2026-09-30T15:26:32+09:00
- 周回: r1

## タスク
UI画像（アイコン・カテゴリ・花丸/スタンプ・スタート背景 10枚）

## やること
- `IMAGE_SPEC.md` 5章の10枚を生成する（アイコン・スタート背景はサイズが違うので注意）
- アイコンのキートップは無地。文字はクロコが後で合成する
- きもち・うごきのカテゴリ画像は基準人物で描く

## 参照
- 仕様: `.agent_flow/SPEC.md`
- 計画: `.agent_flow/PLAN.md`
- **画像仕様（正本）: `.agent_flow/IMAGE_SPEC.md`**

## 完了条件(これを満たさないと受け入れ検査で落ちる)
- IMAGE_SPEC.md 5章の10枚（サイズ指定どおり）
- 7章のチェックを満たす
- 一覧シート verify_TASK-005.png を出す

## 規約(必ず守る)
- パスはすべてプロジェクトルートからの相対パス・`/` 区切り。
- 生成アセットは `.agent_flow/assets/asset_TASK-005_<name>.<ext>` に置き、
  `.agent_flow/ASSET_MANIFEST.json` に追記する。
- `TASK_BOARD.json` は編集しない。
- 完了したら次の2つを書き出す:
  - `.agent_flow/handoffs/done_TASK-005.json`
  - `.agent_flow/logs/log_TASK-005_agy.md`
- 完了できないときは `status` を `BLOCKED` にして理由をログに書く。
