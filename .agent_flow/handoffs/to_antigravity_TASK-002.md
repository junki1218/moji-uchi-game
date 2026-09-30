# 作業指示書 TASK-002

- 宛先: Antigravity (AGY)
- 発行: Claude Code (クロコ) 2026-09-30T15:26:31+09:00
- 周回: r1

## タスク
問題イラスト もの（19枚）

## やること
- `IMAGE_SPEC.md` 4.1 の表どおり、mono_07 以外の19枚を生成する
- TASK-001 で承認された画風（`asset_TASK-001_mono_07_shouboushya.png`）に合わせる

## 参照
- 仕様: `.agent_flow/SPEC.md`
- 計画: `.agent_flow/PLAN.md`
- **画像仕様（正本）: `.agent_flow/IMAGE_SPEC.md`**

## 完了条件(これを満たさないと受け入れ検査で落ちる)
- IMAGE_SPEC.md 4.1 の表から mono_07 を除く19枚
- 7章のチェックをすべて満たす
- 一覧シート verify_TASK-002.png を出す

## 規約(必ず守る)
- パスはすべてプロジェクトルートからの相対パス・`/` 区切り。
- 生成アセットは `.agent_flow/assets/asset_TASK-002_<name>.<ext>` に置き、
  `.agent_flow/ASSET_MANIFEST.json` に追記する。
- `TASK_BOARD.json` は編集しない。
- 完了したら次の2つを書き出す:
  - `.agent_flow/handoffs/done_TASK-002.json`
  - `.agent_flow/logs/log_TASK-002_agy.md`
- 完了できないときは `status` を `BLOCKED` にして理由をログに書く。
