#!/usr/bin/env python3
"""One coherent object sprite per item — opaque ONLY on gameplay cells."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, ramp, mix  # type: ignore

OUT = Path(__file__).resolve().parent / "export"
PUBLIC = ROOT / "public" / "pixel"
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

CS = 16
INK = "#1a1c2c"
PAPER = "#e4e0d2"

ITEMS = [
    {"id": "bottle", "material": "plastic", "cells": [[1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]},
    {"id": "canister", "material": "plastic", "cells": [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]},
    {"id": "brick", "material": "plastic", "cells": [[0, 0], [1, 0], [0, 1], [1, 1]]},
    {"id": "lid", "material": "plastic", "cells": [[0, 0], [1, 0], [2, 0]]},
    {"id": "tin", "material": "metal", "cells": [[0, 0], [1, 0], [0, 1], [1, 1]]},
    {"id": "wrench", "material": "metal", "cells": [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]},
    {"id": "pipe", "material": "metal", "cells": [[1, 0], [0, 1], [1, 1], [2, 1]]},
    {"id": "plate", "material": "metal", "cells": [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]},
    {"id": "flask", "material": "glass", "cells": [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2]]},
    {"id": "shard", "material": "glass", "cells": [[0, 0], [0, 1], [1, 1], [1, 2]]},
    {"id": "pane", "material": "glass", "cells": [[0, 0], [1, 0], [2, 0], [3, 0]]},
    {"id": "jar", "material": "glass", "cells": [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]},
    {"id": "banana", "material": "organic", "cells": [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]]},
    {"id": "apple", "material": "organic", "cells": [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]},
    {"id": "leaf", "material": "organic", "cells": [[0, 0], [1, 0], [1, 1]]},
    {"id": "chip", "material": "electronics", "cells": [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]},
    {"id": "phone", "material": "electronics", "cells": [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]},
    {"id": "board", "material": "electronics", "cells": [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]},
]

MAT = {
    "plastic": ramp("#3aa0c8", 4),
    "metal": ramp("#8b9299", 4),
    "glass": ramp("#5aaa78", 4),
    "organic": ramp("#b87a4a", 4),
    "electronics": ramp("#7d6bb0", 4),
}


def normalize(cells):
    min_x = min(c[0] for c in cells)
    min_y = min(c[1] for c in cells)
    return sorted([[c[0] - min_x, c[1] - min_y] for c in cells], key=lambda c: (c[1], c[0]))


def rotate_once(cells):
    return normalize([[c[1], -c[0]] for c in cells])


def bounds(cells):
    return max(c[0] for c in cells) + 1, max(c[1] for c in cells) + 1


def clear(s: Sprite) -> None:
    for y in range(s.h):
        for x in range(s.w):
            s.px(x, y, None)


def mask_to_cells(s: Sprite, cells: list[list[int]]) -> None:
    occupied = {(c[0], c[1]) for c in cells}
    for y in range(s.h):
        for x in range(s.w):
            if (x // CS, y // CS) not in occupied:
                s.px(x, y, None)


def outline_object(s: Sprite, color: str = INK) -> None:
    """1px outline around opaque pixels."""
    opaque = []
    for y in range(s.h):
        for x in range(s.w):
            if s.get(x, y) is not None:
                opaque.append((x, y))
    for x, y in opaque:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < s.w and 0 <= ny < s.h and s.get(nx, ny) is None:
                s.px(nx, ny, color)


def draw_object(s: Sprite, item_id: str, cols: list[str]) -> None:
    c0, c1, c2, c3 = cols[0], cols[1], cols[2], cols[3]
    W, H = s.w, s.h

    if item_id == "bottle":
        # plastic bottle: narrow neck + rounded body with label
        s.rect(CS + 6, 1, CS + 9, CS + 1, c3, True)  # neck
        s.rect(CS + 5, CS, CS + 10, CS + 3, c2, True)  # shoulder
        s.rect(4, CS + 3, 2 * CS - 5, 3 * CS - 3, c2, True)  # body
        s.rect(4, CS + 3, 2 * CS - 5, CS + 6, c3, True)
        s.rect(4, 3 * CS - 6, 2 * CS - 5, 3 * CS - 3, c0, True)
        s.rect(7, CS + 9, 2 * CS - 8, 2 * CS + 2, mix(c1, PAPER, 0.35), True)  # label
        s.px(CS + 7, 2, PAPER)
    elif item_id == "canister":
        s.rect(2, 2, 3 * CS - 3, 3 * CS - 3, c2, True)
        s.rect(2, 2, 3 * CS - 3, 8, c3, True)
        s.rect(CS - 2, 0, 2 * CS + 1, 4, c1, True)
        s.rect(4, CS + 2, 8, 2 * CS - 2, INK, True)
        s.rect(3 * CS - 9, CS + 2, 3 * CS - 5, 2 * CS - 2, INK, True)
        s.rect(2, 3 * CS - 6, 3 * CS - 3, 3 * CS - 3, c0, True)
    elif item_id == "brick":
        s.rect(1, 1, 2 * CS - 2, 2 * CS - 2, c2, True)
        s.rect(1, 1, 2 * CS - 2, 4, c3, True)
        s.rect(1, CS - 1, 2 * CS - 2, CS, c0, True)
        s.rect(CS - 1, 1, CS, 2 * CS - 2, c0, True)
        s.rect(1, 2 * CS - 5, 2 * CS - 2, 2 * CS - 2, c0, True)
    elif item_id == "lid":
        s.rect(2, 4, 3 * CS - 3, CS - 4, c2, True)
        s.rect(2, 4, 3 * CS - 3, 7, c3, True)
        s.circle(W // 2, H // 2, 3, c1, True)
        s.px(W // 2 - 1, H // 2 - 1, PAPER)
    elif item_id == "tin":
        s.rect(2, 2, 2 * CS - 3, 2 * CS - 3, c2, True)
        s.rect(2, 2, 2 * CS - 3, 5, c3, True)
        s.rect(4, 7, 2 * CS - 5, 10, mix(c2, PAPER, 0.3), True)
        s.rect(2, 2 * CS - 6, 2 * CS - 3, 2 * CS - 3, c0, True)
    elif item_id == "wrench":
        # open-end wrench: handle vertical, jaw horizontal
        s.rect(5, 2, 10, 2 * CS + 4, c2, True)  # handle
        s.rect(5, 2, 10, 5, c3, True)
        s.rect(3, 2 * CS + 2, 3 * CS - 4, 3 * CS - 3, c2, True)  # head
        for yy in range(2 * CS + 5, 3 * CS - 5):
            for xx in range(CS + 2, 2 * CS + 2):
                s.px(xx, yy, None)
        s.rect(3, 2 * CS + 2, 3 * CS - 4, 2 * CS + 4, c3, True)
        s.rect(3, 3 * CS - 5, 3 * CS - 4, 3 * CS - 3, c0, True)
    elif item_id == "pipe":
        s.rect(CS + 4, 2, 2 * CS - 5, CS + 4, c2, True)
        s.rect(2, CS + 4, 3 * CS - 3, 2 * CS - 5, c2, True)
        s.rect(2, CS + 4, 3 * CS - 3, CS + 7, c3, True)
        s.rect(CS + 4, 2, 2 * CS - 5, 5, c3, True)
    elif item_id == "plate":
        s.rect(1, 1, 3 * CS - 2, 2 * CS - 2, c2, True)
        s.rect(1, 1, 3 * CS - 2, 4, c3, True)
        for i in range(4, 3 * CS - 4, 5):
            s.px(i, 7, c1)
            s.px(i, 2 * CS - 6, c0)
        s.rect(1, 2 * CS - 5, 3 * CS - 2, 2 * CS - 2, c0, True)
    elif item_id == "flask":
        s.rect(CS + 5, 1, 2 * CS - 6, CS + 2, c3, True)
        s.rect(3, 2 * CS - 2, 3 * CS - 4, 3 * CS - 2, c2, True)
        s.rect(3, 2 * CS - 2, 3 * CS - 4, 2 * CS + 2, c3, True)
        s.rect(6, 2 * CS + 4, 3 * CS - 7, 3 * CS - 5, mix(c2, PAPER, 0.3), True)
    elif item_id == "shard":
        pts = [(2, 2), (CS - 2, 4), (2 * CS - 3, 2 * CS - 3), (CS + 2, 2 * CS - 2), (3, CS + 2)]
        s.polygon(pts, c2)
        s.px(6, 6, PAPER)
        s.px(CS + 4, CS + 2, c3)
    elif item_id == "pane":
        s.rect(1, 3, 4 * CS - 2, CS - 4, c2, True)
        s.rect(1, 3, 4 * CS - 2, 5, c3, True)
        s.rect(4, 5, CS + 2, CS - 6, mix(c3, PAPER, 0.45), True)
        s.rect(1, CS - 6, 4 * CS - 2, CS - 4, c0, True)
    elif item_id == "jar":
        s.rect(3, 1, 2 * CS - 4, 4, c1, True)
        s.rect(2, 4, 2 * CS - 3, 3 * CS - 2, c2, True)
        s.rect(2, 4, 2 * CS - 3, 8, c3, True)
        s.rect(5, CS, 2 * CS - 6, 2 * CS, mix(c2, PAPER, 0.2), True)
        s.rect(2, 3 * CS - 5, 2 * CS - 3, 3 * CS - 2, c0, True)
    elif item_id == "banana":
        s.rect(CS + 2, 2, 2 * CS - 3, CS + 4, c2, True)
        s.rect(2, CS + 2, CS + 6, 2 * CS - 2, c2, True)
        s.rect(2 * CS - 4, CS + 6, 3 * CS - 3, 3 * CS - 3, c2, True)
        s.rect(CS + 2, 2, 2 * CS - 3, 5, c3, True)
        s.px(CS, 4, c0)
    elif item_id == "apple":
        s.circle(W // 2, H // 2 + 1, min(W, H) // 2 - 2, c2, True)
        s.circle(W // 2 - 3, H // 2 - 2, 3, c3, True)
        s.rect(W // 2 - 1, 2, W // 2, CS - 2, mix(c0, "#3d5a2a", 0.45), True)
    elif item_id == "leaf":
        s.ellipse(2, 2, 2 * CS - 3, 2 * CS - 3, c2)
        s.rect(CS - 1, 3, CS, 2 * CS - 4, c0, True)
        s.px(5, 6, c3)
    elif item_id == "chip":
        s.rect(CS - 2, CS - 2, 2 * CS + 1, 2 * CS + 1, c2, True)
        s.rect(CS - 2, CS - 2, 2 * CS + 1, CS + 1, c3, True)
        for i in range(CS, 2 * CS, 3):
            s.rect(i, 2, i + 1, CS - 3, c1, True)
            s.rect(i, 2 * CS + 2, i + 1, 3 * CS - 3, c1, True)
            s.rect(2, i, CS - 3, i + 1, c1, True)
            s.rect(2 * CS + 2, i, 3 * CS - 3, i + 1, c1, True)
    elif item_id == "phone":
        s.rect(2, 2, 2 * CS - 3, 3 * CS - 3, c2, True)
        s.rect(2, 2, 2 * CS - 3, 5, c3, True)
        s.rect(4, 6, 2 * CS - 5, 2 * CS + 2, INK, True)
        s.rect(CS - 3, 3 * CS - 7, CS + 2, 3 * CS - 5, c3, True)
    elif item_id == "board":
        s.rect(2, 2, 3 * CS - 3, CS - 2, c2, True)
        s.rect(2, 2, 6, 2 * CS - 3, c2, True)
        s.rect(3 * CS - 7, 2, 3 * CS - 3, 2 * CS - 3, c2, True)
        s.rect(2, 2, 3 * CS - 3, 5, c3, True)
        s.px(4, 4, PAPER)
        s.px(3 * CS - 5, 4, c1)
    else:
        s.rect(2, 2, W - 3, H - 3, c2, True)


def rotate_sprite_90(s: Sprite) -> Sprite:
    """Clockwise 90°: (x,y) -> (h-1-y, x)."""
    out = Sprite(s.h, s.w, palette=s.palette)
    clear(out)
    for y in range(s.h):
        for x in range(s.w):
            col = s.get(x, y)
            if col is None:
                continue
            out.px(s.h - 1 - y, x, col)
    return out


def bake(item_id: str, material: str, base_cells: list[list[int]]) -> None:
    cells = normalize(base_cells)
    w, h = bounds(cells)
    cols = MAT[material]
    s = Sprite(w * CS, h * CS, palette=[INK, PAPER] + cols)
    clear(s)
    draw_object(s, item_id, cols)
    mask_to_cells(s, cells)
    # crisp outline around the masked silhouette
    try:
        s.outline(INK, where="outside")
    except Exception:
        pass

    frames = [s]
    cur = s
    for _ in range(3):
        cur = rotate_sprite_90(cur)
        frames.append(cur)

    for rot, frame in enumerate(frames):
        name = f"item-{item_id}-r{rot}"
        frame.save_png(str(OUT / f"{name}.png"), scale=1)
        frame.preview(str(OUT / f"{name}@4x.png"), scale=4)
        (PUBLIC / f"{name}.png").write_bytes((OUT / f"{name}.png").read_bytes())
        if rot == 0:
            frame.save_png(str(OUT / f"item-{item_id}.png"), scale=1)
            (PUBLIC / f"item-{item_id}.png").write_bytes((OUT / f"item-{item_id}.png").read_bytes())


def main() -> None:
    meta = []
    for item in ITEMS:
        cells = normalize(item["cells"])
        bake(item["id"], item["material"], cells)
        w, h = bounds(cells)
        meta.append({"id": item["id"], "w": w, "h": h, "cells": cells})
        print("baked", item["id"])
    (OUT / "items.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
