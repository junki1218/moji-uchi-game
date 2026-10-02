# 作業指示書 TASK-006

- 宛先: Antigravity (AGY)
- 発行: Claude Code (クロコ) 2026-10-02T09:17:47+09:00
- 周回: r1

## タスク
文（〇〇が●●）の絵 20枚

## やること
- `IMAGE_SPEC.md` の1章（共通スタイル）と6章（納品）を読む
- `IMAGE_SPEC_SENTENCE.md` を読み、4章の表どおり20枚を生成する
- 3章の参照画像（もの の絵）を必ず参照し、主役の見た目をそろえる
- 同じ主役（いぬ×3・ねこ×3・ぞう×2）は同じ見た目で、動作だけ変える

## 参照
- 仕様: `.agent_flow/SPEC.md`
- 計画: `.agent_flow/PLAN.md`
- **画像仕様（正本）: `.agent_flow/IMAGE_SPEC_SENTENCE.md`**（共通部分は `.agent_flow/IMAGE_SPEC.md`）

## 完了条件(これを満たさないと受け入れ検査で落ちる)
- IMAGE_SPEC_SENTENCE.md 4章の20枚
- 主役の見た目を参照画像（もの の絵）とそろえる。同じ主役どうしもそろえる
- 6章のチェックをすべて満たす
- 一覧シート verify_TASK-006.png を出す

## 規約(必ず守る)
- パスはすべてプロジェクトルートからの相対パス・`/` 区切り。
- 生成アセットは `.agent_flow/assets/asset_TASK-006_<name>.<ext>` に置き、
  `.agent_flow/ASSET_MANIFEST.json` に追記する。
- `TASK_BOARD.json` は編集しない。
- 完了したら次の2つを書き出す:
  - `.agent_flow/handoffs/done_TASK-006.json`
  - `.agent_flow/logs/log_TASK-006_agy.md`
- 完了できないときは `status` を `BLOCKED` にして理由をログに書く。
