# もじうちゲーム（moji-uchi-game）

知的障害のある子ども向けの、iPad用 文字入力ゲーム（PWA）。
イラストを見て・聞いて、その名前を画面内の50音キーボードで打ちます。

- カテゴリ: もの／きもち／うごき（各20問）
- 単語はすべてひらがな。設定でカタカナにも切替
- 入力は 50音キーボード か てがき（判定なし）を設定で切替
- まちがえたキーは入らず、2回まちがえると正しいキーが光る（エラーレス）

## 先生へ
- 設定画面は「せってい」→ 暗証番号 **1024**（設定画面で変更できます）
- iPad の Safari で開き、共有ボタン →「ホーム画面に追加」でアプリとして使えます
- 出題する問題は設定の「出題する問題を選ぶ・読み込む」で ON/OFF。JSON で問題を足せます → [docs/QUESTIONS_JSON.md](docs/QUESTIONS_JSON.md)
- 公開版: https://junki1218.github.io/moji-uchi-game/

## 開発
```
npm install
npm run dev      # http://localhost:5173
npm run images   # .agent_flow/assets/ の生成画像を public/images/ に変換（未着の絵は絵文字で仮表示）
npm run build
```

## 開発の資料
- 仕様: [.agent_flow/SPEC.md](.agent_flow/SPEC.md)
- 計画: [.agent_flow/PLAN.md](.agent_flow/PLAN.md)
- 画像生成指示書: [.agent_flow/IMAGE_SPEC.md](.agent_flow/IMAGE_SPEC.md)

Claude Code と Google Antigravity の協調開発（`.agent_flow/`）で作っています。
