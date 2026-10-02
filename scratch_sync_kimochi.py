import os
import json
import shutil
from PIL import Image

brain_dir = r"C:\Users\admin\.gemini\antigravity\brain\8d9160b3-cba4-4f10-923b-572316d57213"
workspace_dir = r"C:\Users\admin\Desktop\AntigravityClaudeWS\moji-uchi-game"
assets_dir = os.path.join(workspace_dir, ".agent_flow", "assets")
gdrive_assets = r"G:\マイドライブ\04_素材ライブラリ\画像材料\moji-uchi-game\assets"

os.makedirs(assets_dir, exist_ok=True)
os.makedirs(gdrive_assets, exist_ok=True)

items = [
    {
        "id": "kimochi_02",
        "purpose": "問題イラスト きもち: かなしい",
        "src": os.path.join(brain_dir, "kimochi_02_kanashii_1790897062000.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_02_kanashii.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), expressing sadness (\"kanashii\"). Upper body portrait from chest up, facing forward. Eyebrows slanting down, a single small teardrop on cheek, dropped shoulders, sad expression. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_03",
        "purpose": "問題イラスト きもち: たのしい",
        "src": os.path.join(brain_dir, "kimochi_03_tanoshii_1790897072139.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_03_tanoshii.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), having fun (\"tanoshii\"). Upper body portrait from chest up, facing forward. Open mouth cheerful laughing smile, clapping hands together with joy, lively posture. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_04",
        "purpose": "問題イラスト きもち: おこる",
        "src": os.path.join(brain_dir, "kimochi_04_okoru_1790897081515.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_04_okoru.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), expressing anger / upset (\"okoru\"). Upper body portrait from chest up, facing forward. Slanted upward angry eyebrows, frowning mouth, puffed red cheeks, clenched fists. Mild cute anger not scary. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_05",
        "purpose": "問題イラスト きもち: こわい",
        "src": os.path.join(brain_dir, "kimochi_05_kowai_1790897092483.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_05_kowai.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), feeling scared / afraid (\"kowai\"). Upper body portrait from chest up, facing forward. Wide open startled eyes, pursed mouth, shrinking back with both hands held near chest. Gentle mild expression not too scary. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_06",
        "purpose": "問題イラスト きもち: びっくり",
        "src": os.path.join(brain_dir, "kimochi_06_bikkuri_1790897103804.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_06_bikkuri.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), expressing surprise / shock (\"bikkuri\"). Upper body portrait from chest up, facing forward. Round wide open surprised eyes and round open mouth 'O' shape, both hands spread open in surprise. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_07",
        "purpose": "問題イラスト きもち: いたい",
        "src": os.path.join(brain_dir, "kimochi_07_itai_1790897129459.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_07_itai.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt, blue pants), feeling pain / hurt (\"itai\"). Sitting or crouching, holding knee with both hands, small adhesive bandage on knee, eyes tightly shut in pain with mild tears. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, not overly graphic, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_08",
        "purpose": "問題イラスト きもち: ねむい",
        "src": os.path.join(brain_dir, "kimochi_08_nemui_1790897141909.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_08_nemui.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), feeling sleepy / tired (\"nemui\"). Upper body portrait from chest up, facing forward. Half-closed heavy sleepy eyes, yawning with one hand rubbing an eye. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_09",
        "purpose": "問題イラスト きもち: さむい",
        "src": os.path.join(brain_dir, "kimochi_09_samui_1790897152486.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_09_samui.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt and a cozy red scarf/muffler around neck), feeling cold / freezing (\"samui\"). Upper body portrait from chest up, facing forward. Shivering, arms wrapped tightly around torso, closed tight mouth, pale cheeks. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_10",
        "purpose": "問題イラスト きもち: あつい",
        "src": os.path.join(brain_dir, "kimochi_10_atsui_1790897163380.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_10_atsui.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), feeling hot / warm (\"atsui\"). Upper body portrait from chest up, facing forward. Sweating with small sweat drops on forehead, slightly open mouth panting, fanning face with one hand. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_11",
        "purpose": "問題イラスト きもち: おいしい",
        "src": os.path.join(brain_dir, "kimochi_11_oishii_1790897173178.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_11_oishii.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), expressing delicious / yummy food (\"oishii\"). Upper body portrait from chest up, facing forward. Squinted happy smiling eyes, one hand holding a small spoon, other hand touching cheek with delight. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_12",
        "purpose": "問題イラスト きもち: まずい",
        "src": os.path.join(brain_dir, "kimochi_12_mazui_1790897229545.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_12_mazui.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), tasting bad / unpleasant food (\"mazui\"). Upper body portrait from chest up, facing forward. Eyebrows furrowed, tongue slightly sticking out with disgusted expression, holding a spoon. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_13",
        "purpose": "問題イラスト きもち: はずかしい",
        "src": os.path.join(brain_dir, "kimochi_13_hazukashii_1790897246517.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_13_hazukashii.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt), feeling shy / embarrassed (\"hazukashii\"). Upper body portrait from chest up, facing slightly sideways. Blushing bright pink/red cheeks, looking away shyly, covering lower half of face with both hands. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    },
    {
        "id": "kimochi_14",
        "purpose": "問題イラスト きもち: さびしい",
        "src": os.path.join(brain_dir, "kimochi_14_sabishii_1790897257071.jpg"),
        "dest_filename": "asset_TASK-003_kimochi_14_sabishii.png",
        "prompt": "Claymation style illustration of the same character (child with short black bob hair, wearing yellow t-shirt, blue pants), feeling lonely / solitary (\"sabishii\"). Full body view, sitting alone hugging knees, looking down with slanted down sad eyebrows and lonely expression. Soft handmade clay texture, stop-motion puppet look, single subject centered and large filling 70% of the frame, plain solid off-white background (#FFF7EC), bright clear colors, soft front lighting, child-friendly, no text, no letters, no watermark"
    }
]

# Read existing ASSET_MANIFEST.json
manifest_path = os.path.join(workspace_dir, ".agent_flow", "ASSET_MANIFEST.json")
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest_data = json.load(f)

existing_ids = {a["id"] for a in manifest_data.get("assets", [])}

for item in items:
    if not os.path.exists(item["src"]):
        print(f"Warning: {item['src']} not found")
        continue
    img = Image.open(item["src"]).convert("RGB")
    img_resized = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    dest_path = os.path.join(assets_dir, item["dest_filename"])
    img_resized.save(dest_path, "PNG")
    
    # Copy to GDrive
    gdrive_dest = os.path.join(gdrive_assets, item["dest_filename"])
    shutil.copy2(dest_path, gdrive_dest)
    print(f"Saved & copied: {item['dest_filename']}")
    
    if item["id"] not in existing_ids:
        manifest_data["assets"].append({
            "id": item["id"],
            "type": "image",
            "purpose": item["purpose"],
            "file_path": f".agent_flow/assets/{item['dest_filename']}",
            "dimensions": "1024x1024",
            "created_by": "Antigravity",
            "task_id": "TASK-003",
            "prompt": item["prompt"]
        })

manifest_data["last_updated"] = "2026-10-02T08:30:00+09:00"
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest_data, f, ensure_ascii=False, indent=2)

print("Kimochi batch saved & synced successfully.")
