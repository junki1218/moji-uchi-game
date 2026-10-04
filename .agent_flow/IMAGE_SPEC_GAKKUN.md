# 画像生成指示書：えほん「くろまる がっくん」 7場面×2枚＝14枚

- 宛先: Antigravity（AGY）または画像生成AI
- 発行: クロコ 2026-10-05
- もと: Notion「くろまる がっくん｜『が』を たのしく まなぶ おはなし きかくしょ」＋ストーリー案（7場面）
- ねらい: 絵本で読んだ文を、そのまま アプリ「がっくんのこくご」（旧 もじうちゲーム）の「ぶん」「ぶん・きもち」で打てるようにする。
  そのため、出てくる相手（いぬ・ねこ・ひこうき・ばす・かどたん・らいおん）は **アプリの絵と同じ見た目** にする

---

## 1. 全体の約束

| 項目 | 指定 |
|---|---|
| タッチ | **やさしいクレイアニメーション風**。ねんどで作ったようなまるみ、指あとがうっすら残る質感、ストップモーション人形のような立体感 |
| サイズ | **1536×1024 px の PNG（横長 3:2）**。絵本の見開き片ページ想定 |
| 背景 | 場面がわかる **最小限の背景**（道・草・空・ていりゅうじょ など）。淡いパステル。こまかい模様や人ごみは入れない |
| 構図 | **がっくんと相手の2者だけ**が主役（7場面目を除く）。2者で画面の 50〜65%。左にがっくん、右に相手を基本にする（ページをめくる方向＝右へ目が流れる） |
| 文字 | **絵の中に文字を入れない。ただし、がっくんの からだの「が」だけは入れる**。文章は絵の外（下）に組むので、余白は作らなくてよい |
| 光 | やわらかい正面光。暗い影・こわい表情は避ける |
| 1枚目と2枚目 | **同じ場面・同じ構図・同じ背景**で、相手だけが変わる。2枚目のがっくんは見ている（少しうれしそう）だけで、**がっくんは相手を動かさない・さわらない**（企画書の約束） |

### 1枚目（①「○○が……」）と2枚目（②「○○が ○○する。」）の描き分け

- ① 相手は **変化の前**。じっとしている／止まっている。がっくんは相手のとなりで、相手を見上げて「つぎ どうなるかな」という顔（口を小さく あけて わくわく）
- ② 相手が **変化した瞬間**（いちばんそれらしい瞬間）。がっくんの位置は①と同じ。表情だけ にこっとする

### ネガティブ（指定できる場合・全枚共通）

```
text, letters, words, numbers, watermark, logo, speech bubble, extra characters, crowd, busy background, realistic photo, scary face, sharp teeth, dark shadows, deformed hiragana
```

---

## 2. がっくんのデザイン（全枚共通・いちばん大事）

| 部分 | 決まり |
|---|---|
| からだ | **まっくろで まんまるの ボール**。つやは少なめ、ねんどの質感 |
| 「が」 | **からだの まんなか〜下寄りに、白い大きなひらがな「が」**。からだの横はばの 45〜50%。**濁点（゛）をはっきり2つ**。字形は教科書体。アプリの見本「黒い丸に白い が」と同じ印象にする |
| かお | 「が」の上に、白い まるい目2つ（黒目あり）と、小さな にっこり口（細い線）。「が」と重ならない |
| て・あし | 短い **黒い** うで・あし（手ぶくろ・くつは なし）。うでは からだの横から少し上向きに出る |
| 大きさ | 相手のいぬと同じくらいの高さ。らいおん・ばす・ひこうきの横では小さく見えてよい |
| 性格 | やさしい、好奇心がある。こわがらせない |

**全14枚で同じがっくん**にする。**正本はアプリのスタート画面の絵 `.agent_flow/assets/gakkun_start_original.jpg`**（2026-10-05 ユーザー提供）。
G00（設定画）もこの絵を参照画像にして作り、以後の14枚は この絵と G00 の両方を参照画像にする。

### 「が」がくずれたとき

生成AIはひらがなの形をよくくずす。**「が」が読めない・濁点がない・左右反転している絵は不合格**にする。
くずれる場合は、「が」の部分を **白い字なしの円（無地の黒い丸）** で生成し、あとでクロコが教科書体の「が」を合成する（その旨をログに書く）。

---

## 3. 相手の見た目（アプリの絵を参照画像にする）

| 相手 | 参照画像（`.agent_flow/assets/`） | 決まり |
|---|---|---|
| いぬ | `asset_TASK-002_mono_02_inu.png`、`asset_TASK-006_bun_01_inu_hashiru.png` | 茶色の子犬 |
| ねこ | `asset_TASK-002_mono_03_neko.png`、`asset_TASK-006_bun_02_neko_neru.png` | 白と茶のぶちねこ |
| ひこうき | `asset_TASK-002_mono_10_hikouki.png`、`asset_TASK-006_bun_05_hikouki_tobu.png` | 白い旅客機。文字・ロゴなし |
| ばす | `asset_TASK-002_mono_06_basu.png`、`asset_TASK-006_bun_08_basu_tomaru.png` | 黄色い路線バス。行き先表示は無地 |
| かどたん | `asset_TASK-007_bun_15_kadotan_taberu.png` | 緑のたまご形、黒い四角いめがね形の目、白い大きな歯の笑顔、黄色い手足、おなかに赤い「77」。**着ぐるみ写真をクレイ風に描き直す**（形と色はそのまま）。「77」は元のデザインどおり残してよい（文字の例外） |
| らいおん | `asset_TASK-008_bunkimochi_08_komaru.png` | オレンジのたてがみ、紺のブレザー。アプリの「らいおんが こまる」の絵と同じらいおん |

---

## 4. ファイル名と納品

- ファイル名: `asset_TASK-009_gakkun_{場面}{a|b}_{内容}.png`（例 `asset_TASK-009_gakkun_1a_inu.png`）
- 設定画: `asset_TASK-009_gakkun_00_sheet.png`
- 置き場所: `.agent_flow/assets/`。`ASSET_MANIFEST.json` に登録し、実際に使ったプロンプトも残す

---

## 5. G00 設定画（先に1枚）

```
Character reference sheet of "Gakkun", a cute claymation character for a Japanese children's picture book.
Gakkun is a perfectly round, matte black clay ball body. In the center-lower part of the body is one large, clean, white Japanese hiragana character "が" (ga) with two clear dakuten marks, about half the width of the body, in a textbook-style font.
Above the "が": two white round eyes with black pupils and a small gentle white smile. The face never overlaps the "が".
Short black clay arms and legs (no gloves, no shoes), arms slightly raised from the sides of the body.
Kind, curious, friendly expression.
Show the same character three times side by side: front view, three-quarter view, and walking pose.
Soft handmade clay texture with faint fingerprints, stop-motion puppet look, soft front lighting, plain solid off-white background (#FFF7EC).
No other text, no labels, no numbers.
```

---

## 6. 14枚のプロンプト

各プロンプトの頭に **G00 を参照画像として付ける**。相手の参照画像（3章）も付ける。

### 場面1　いぬ

**1a ①「いぬが……」** — `asset_TASK-009_gakkun_1a_inu.png`
```
Claymation picture book illustration, landscape 3:2.
On a short sunny dirt path with a little green grass, Gakkun (the round black clay ball character with a large white hiragana "が" on the body, short black arms and legs, same as the reference images) stands on the left, looking up with an excited, curious face, mouth slightly open, as if wondering "what will happen next?".
On the right, a small brown puppy (same as the reference image) is standing still, ears up, ready to run, all four paws on the ground.
Only these two characters. Soft pastel background, simple, calm.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

**1b ②「いぬが はしる。」** — `asset_TASK-009_gakkun_1b_inu_hashiru.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (sunny dirt path with a little grass).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays in the same place on the left, now smiling happily, watching.
On the right, the same small brown puppy is running fast to the right, all four paws off the ground, ears flying back, small clay dust puffs behind.
Gakkun does not touch the puppy.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

### 場面2　ねこ

**2a ①「ねこが……」** — `asset_TASK-009_gakkun_2a_neko.png`
```
Claymation picture book illustration, landscape 3:2.
A cozy corner with one small round cushion on a wooden floor, soft afternoon light.
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stands on the left, leaning in gently, curious face, mouth slightly open, waiting to see what happens.
On the right, a white-and-brown spotted cat (same as the reference image) sits on the cushion, eyes half open, a little sleepy.
Only these two characters. Simple, calm pastel background.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

**2b ②「ねこが ねる。」** — `asset_TASK-009_gakkun_2b_neko_neru.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (cushion on a wooden floor).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays in the same place on the left, smiling softly, one hand near the mouth as if being quiet.
On the right, the same white-and-brown cat is curled up into a ball on the cushion, eyes fully closed, sleeping peacefully.
No "Zzz" letters. Gakkun does not touch the cat.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

### 場面3　ひこうき

**3a ①「ひこうきが……」** — `asset_TASK-009_gakkun_3a_hikouki.png`
```
Claymation picture book illustration, landscape 3:2.
A small grassy hill next to a short runway, light blue sky with one white cloud.
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stands on the hill on the left, looking at the plane with an excited, curious face, mouth slightly open.
On the right, a white passenger airplane (same as the reference image, no letters, no logo) is standing still on the runway, wheels on the ground.
Only Gakkun and the airplane. Simple pastel background.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

**3b ②「ひこうきが とぶ。」** — `asset_TASK-009_gakkun_3b_hikouki_tobu.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (grassy hill, runway, one white cloud).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays on the hill on the left, looking up and smiling, both arms raised a little in delight.
The same white airplane is now flying up into the sky toward the upper right, wheels off the ground, nose pointing up.
Gakkun does not touch the airplane.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

### 場面4　ばす

**4a ①「ばすが……」** — `asset_TASK-009_gakkun_4a_basu.png`
```
Claymation picture book illustration, landscape 3:2.
A simple street with a bus stop: a round plain sign board on a pole (no letters).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stands next to the bus stop on the left, looking to the right with a curious, expectant face.
On the right, a yellow city bus (same as the reference image, blank destination sign) is driving toward the bus stop, still moving, small motion puffs behind the wheels.
Only Gakkun and the bus. Simple pastel background.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

**4b ②「ばすが とまる。」** — `asset_TASK-009_gakkun_4b_basu_tomaru.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (street, plain bus stop sign).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays next to the bus stop on the left, smiling.
The same yellow bus has now stopped right at the bus stop, wheels still, the front door open. No motion puffs.
Gakkun does not touch the bus.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

### 場面5　かどたん

**5a ①「かどたんが……」** — `asset_TASK-009_gakkun_5a_kadotan.png`
```
Claymation picture book illustration, landscape 3:2.
A small table with one plate of hamburger steak and vegetables, a fork and knife, warm cozy room.
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) sits on a chair on the left side of the table, looking at Kadotan with a curious face, mouth slightly open.
On the right, Kadotan sits at the table: a green egg-shaped clay character with black rectangular glasses-like eyes, a big white toothy smile, yellow arms and legs, a small red "77" on the belly (same design as the reference image, redrawn in clay style). Kadotan holds a fork and knife but has not started eating yet.
Only these two characters.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body and the "77" on Kadotan.
```

**5b ②「かどたんが たべる。」** — `asset_TASK-009_gakkun_5b_kadotan_taberu.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (small table, plate of hamburger steak).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays on the left, smiling.
On the right, the same green Kadotan is eating: a piece of hamburger steak on the fork is at its mouth, cheeks full, happy.
Gakkun does not touch Kadotan or the food.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body and the "77" on Kadotan.
```

### 場面6　らいおん

**6a ①「らいおんが……」** — `asset_TASK-009_gakkun_6a_raion.png`
```
Claymation picture book illustration, landscape 3:2.
A small classroom corner: one wooden desk with an open notebook, a pencil, a chalkboard with only simple doodles (no letters, no numbers).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stands on the left, peeking at the notebook with a curious face.
On the right, a friendly lion cub with an orange mane wearing a navy school blazer (same as the reference image) sits at the desk, holding a pencil, looking at the notebook with a calm, neutral face.
Only these two characters.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

**6b ②「らいおんが こまる。」** — `asset_TASK-009_gakkun_6b_raion_komaru.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (desk, notebook, chalkboard with doodles).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stays on the left, looking at the lion with a gentle, kind face.
On the right, the same lion cub is clearly troubled: eyebrows down in the middle, mouth wavy, one paw scratching its head, looking at the notebook. Gentle and a little funny, not sad or scary. No question-mark symbols.
Gakkun does not touch the lion.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body.
```

### 場面7　がっくんも なかまに なる

**7a ①「がっくんが……」** — `asset_TASK-009_gakkun_7a_minna.png`
```
Claymation picture book illustration, landscape 3:2.
A sunny park meadow with soft pastel flowers.
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) stands in the center, a little bigger than in other pages.
Around Gakkun, the friends from the story gather in a gentle half circle: the small brown puppy, the white-and-brown cat, the green egg-shaped Kadotan (red "77" on the belly), and the lion cub in a navy blazer. All of them look at Gakkun with warm, expectant faces.
Gakkun looks a little surprised, mouth slightly open, as if wondering what will happen.
The bus and the airplane can appear small in the far background (optional).
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body and the "77" on Kadotan.
```

**7b ②「がっくんが うれしい。」** — `asset_TASK-009_gakkun_7b_gakkun_ureshii.png`
```
Claymation picture book illustration, landscape 3:2. Same scene, same camera angle and same background as the previous picture (sunny park meadow, friends in a half circle).
Gakkun (round black clay ball character with a large white hiragana "が" on the body, short black arms and legs) is in the center, now very happy: big smile, eyes curved with joy, both arms raised, small hop with both feet off the ground, rosy cheeks.
The friends around (puppy, cat, Kadotan, lion cub) smile and clap.
The white "が" on Gakkun's body stays clear and easy to read.
Soft handmade clay texture, stop-motion look, soft front lighting, child-friendly.
No text anywhere except the "が" on Gakkun's body and the "77" on Kadotan.
```

---

## 7. 合格の目安（クロコが受け入れ検査で見る）

1. がっくんの「が」が読める（濁点2つ、反転なし）。14枚で同じがっくんに見える
2. a と b で、背景・構図・がっくんの位置が同じ。**変わっているのは相手だけ**
3. b の絵だけを見て、文（「いぬが はしる」など）が言える
4. 相手の見た目が、アプリの絵と同じ（子どもが「アプリの いぬだ」と気づける）
5. 文字・数字が入っていない（「が」と、かどたんの「77」を除く）
