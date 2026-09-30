"""AI 生成の BGM を、途切れずに繰り返せるループ音源に加工する。

    python tools/make_loop.py <元の音声> <出力名> [--min 20] [--xfade 0.65] [--lufs -18]
    例: python tools/make_loop.py "a_game_of_wooden_bells_1.mp3" bgm1_start

出力:
- public/audio/<出力名>.m4a   （AAC 128kbps。iOS Safari で再生できる）
- public/audio/<出力名>.json  （{"loopEnd": 秒}。アプリはこの長さで折り返す）

やること:
1. 曲頭のフレーズが後半でもう一度始まる位置を探し、そこまでを1周とする
   （見つからない曲＝環境音楽などは、末尾の無音を除いた全体を1周とする）
2. 継ぎ目を1拍ぶん等パワーでクロスフェードする（生成曲は同じフレーズでも毎回少し違うため）
3. ラウドネスを BGM 向けにそろえる（既定 -18 LUFS、ピーク -1.5 dBTP）
元の音声ファイルは変更しない。
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
SR = 44100
HEAD = 6.0  # 曲頭の何秒で一致を見るか
MATCH_MIN = 0.6  # これ未満なら「繰り返しなし」とみなす


def decode(src: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-ar", str(SR), "-ac", "2", "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def onset_env(mono: np.ndarray, hop: int = 512) -> np.ndarray:
    n = len(mono) // hop
    env = np.sqrt(np.mean(mono[: n * hop].reshape(n, hop) ** 2, axis=1))
    return np.maximum(np.diff(np.log(env + 1e-4)), 0)


def norm(a: np.ndarray) -> np.ndarray:
    return (a - a.mean()) / (a.std() + 1e-9)


def find_loop(x: np.ndarray, min_sec: float) -> tuple[int, int, float]:
    """(先頭の無音サンプル数, 1周のサンプル数, 一致度) を返す"""
    mono = x.mean(axis=1)
    lead = int(np.argmax(np.abs(mono) > 1e-3))
    loud = np.nonzero(np.abs(mono) > 1e-3)[0]
    tail = int(loud[-1]) if len(loud) else len(mono)

    hop = 512  # 約12ms刻み。細かすぎると演奏の揺れで一致が崩れる
    fps = SR / hop
    on = onset_env(mono[lead:], hop)
    w = int(HEAD * fps)
    ref = norm(on[:w])
    best = (-1.0, 0)
    for s in range(int(min_sec * fps), len(on) - w):
        c = float(np.dot(norm(on[s : s + w]), ref) / w)
        if c > best[0]:
            best = (c, s)
    score, s = best

    if score < MATCH_MIN:
        # 繰り返しが見つからない: 音のある範囲全体を1周にする
        return lead, tail - lead, score

    # サンプル単位で詰める（±0.2秒の範囲で波形の相関が最大の位置）
    approx = int(s * hop)
    win = int(0.5 * SR)
    ref_w = mono[lead : lead + win]
    cands = range(max(approx - int(0.2 * SR), 1), approx + int(0.2 * SR))
    length = max(cands, key=lambda L: float(np.dot(mono[lead + L : lead + L + win], ref_w)))
    return lead, length, score


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("name")
    ap.add_argument("--min", type=float, default=20.0, help="1周の最短秒数")
    ap.add_argument("--xfade", type=float, default=0.65, help="継ぎ目のクロスフェード秒数（1拍が目安）")
    ap.add_argument("--lufs", type=float, default=-18.0)
    a = ap.parse_args()

    x = decode(a.src)
    lead, length, score = find_loop(x, a.min)
    xf = int(a.xfade * SR)
    t = np.linspace(0, 1, xf)[:, None]

    y = x[lead : lead + length].copy()
    follow = x[lead + length : lead + length + xf]
    if len(follow) == xf:
        # 曲の続き（＝曲頭に似た音）から曲頭へ入れ替える
        y[:xf] = x[lead : lead + xf] * np.sin(t * np.pi / 2) + follow * np.cos(t * np.pi / 2)
    else:
        # 続きがない（全体を1周にした）場合は、末尾を曲頭へ溶かし込む
        y = x[lead : lead + length].copy()
        y[:xf] = y[:xf] * np.sin(t * np.pi / 2) + y[-xf:] * np.cos(t * np.pi / 2)
        y = y[:-xf]

    OUT.mkdir(parents=True, exist_ok=True)
    m4a = OUT / f"{a.name}.m4a"
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "loop.raw"
        y.astype(np.float32).tofile(raw)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw),
             "-af", f"loudnorm=I={a.lufs}:TP=-1.5:LRA=7", "-ar", str(SR), "-c:a", "aac", "-b:a", "128k", str(m4a)],
            check=True,
        )
    loop_end = round(len(y) / SR, 4)
    (OUT / f"{a.name}.json").write_text(json.dumps({"loopEnd": loop_end}) + "\n", encoding="utf-8")

    how = f"曲頭の繰り返しで1周（一致度 {score:.2f}）" if score >= MATCH_MIN else f"繰り返しなし→全体で1周（一致度 {score:.2f}）"
    print(f"{m4a.relative_to(ROOT).as_posix()}  1周 {loop_end} 秒  {how}  {m4a.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
