#!/usr/bin/env python3
"""Compactor pixel assets — Endesga32-ish scrapyard industrial, living pixel UI."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, ramp, mix  # type: ignore

OUT = Path(__file__).resolve().parent / "export"
OUT.mkdir(parents=True, exist_ok=True)

# Hard palette (shared dark outline = soul of the set)
INK = "#1a1c2c"
PANEL = "#2d3142"
PANEL2 = "#3d4258"
STEEL = "#5a6178"
STEEL2 = "#7b849c"
PAPER = "#e4e0d2"
MUTED = "#9aa0b0"
OIL = "#c45c1a"
OIL2 = "#e8903a"
OIL3 = "#8a3a0e"
LAMP = "#ff4d2e"
LAMP2 = "#ffb199"
GOOD = "#8fbf5a"
PLASTIC = ramp("#3aa0c8", 4)
METAL = ramp("#8b9299", 4)
GLASS = ramp("#5aaa78", 4)
ORGANIC = ramp("#b87a4a", 4)
ELEC = ramp("#7d6bb0", 4)

PAL = (
    [INK, PANEL, PANEL2, STEEL, STEEL2, PAPER, MUTED, OIL, OIL2, OIL3, LAMP, LAMP2, GOOD]
    + PLASTIC
    + METAL
    + GLASS
    + ORGANIC
    + ELEC
)


def save(s: Sprite, name: str, scale: int = 4) -> None:
    s.save_png(str(OUT / f"{name}.png"), scale=1)
    s.preview(str(OUT / f"{name}@4x.png"), scale=scale)
    print("wrote", name)


def tile_empty() -> None:
    s = Sprite(16, 16, palette=PAL)
    s.rect(0, 0, 15, 15, PANEL, fill=True)
    s.rect(1, 1, 14, 14, PANEL2, fill=True)
    s.rect(0, 0, 15, 0, INK)
    s.rect(0, 0, 0, 15, INK)
    s.rect(0, 15, 15, 15, mix(INK, STEEL, 0.35))
    s.rect(15, 0, 15, 15, mix(INK, STEEL, 0.35))
    # rivet dots
    s.px(2, 2, STEEL)
    s.px(13, 2, STEEL)
    s.px(2, 13, STEEL)
    s.px(13, 13, STEEL)
    save(s, "cell-empty")


def tile_mat(name: str, colors: list[str], pattern: str) -> None:
    s = Sprite(16, 16, palette=PAL)
    base, mid, hi, shadow = colors[1], colors[2], colors[3], colors[0]
    s.rect(0, 0, 15, 15, INK, fill=True)
    s.rect(1, 1, 14, 14, mid, fill=True)
    s.rect(1, 1, 14, 3, hi, fill=True)
    s.rect(1, 13, 14, 14, shadow, fill=True)
    s.rect(1, 1, 2, 14, hi, fill=True)
    s.rect(13, 1, 14, 14, shadow, fill=True)

    if pattern == "diag":
        for i in range(-16, 16, 3):
            for t in range(16):
                x, y = i + t, t
                if 2 <= x <= 13 and 2 <= y <= 13:
                    s.px(x, y, mix(mid, hi, 0.45))
    elif pattern == "hatch":
        for y in range(3, 14, 2):
            for x in range(2, 14):
                s.px(x, y, shadow)
    elif pattern == "glass":
        for x in range(3, 8):
            for y in range(3, 7):
                s.px(x, y, hi)
        s.px(11, 10, hi)
        s.px(12, 11, hi)
    elif pattern == "dots":
        for y in range(4, 13, 3):
            for x in range(4, 13, 3):
                s.px(x, y, hi)
    elif pattern == "chips":
        for y in range(3, 14, 4):
            for x in range(3, 14):
                s.px(x, y, hi)
            for x in range(3, 14, 4):
                for yy in range(y, min(y + 3, 14)):
                    s.px(x, yy, shadow)

    # living highlight sparkle (static, CSS animates opacity via alt frame)
    s.px(4, 4, PAPER)
    save(s, f"cell-{name}")


def tile_ghost() -> None:
    s = Sprite(16, 16, palette=PAL)
    for x in range(16):
        for y in range(16):
            if (x + y) % 2 == 0 and 1 <= x <= 14 and 1 <= y <= 14:
                s.px(x, y, STEEL2)
    s.rect(0, 0, 15, 0, OIL2)
    s.rect(0, 15, 15, 15, OIL2)
    s.rect(0, 0, 0, 15, OIL2)
    s.rect(15, 0, 15, 15, OIL2)
    save(s, "cell-ghost")


def lamp(on: bool) -> None:
    s = Sprite(16, 16, palette=PAL)
    s.circle(7, 8, 6, INK, fill=True)
    if on:
        s.circle(7, 8, 5, LAMP, fill=True)
        s.circle(6, 6, 2, LAMP2, fill=True)
        s.px(5, 5, PAPER)
    else:
        s.circle(7, 8, 5, mix(INK, LAMP, 0.25), fill=True)
        s.circle(6, 6, 2, mix(PANEL, LAMP, 0.2), fill=True)
    s.rect(6, 13, 9, 15, STEEL, fill=True)
    save(s, "lamp-on" if on else "lamp-off")


def press_btn() -> None:
    s = Sprite(80, 28, palette=PAL)
    s.rect(0, 0, 79, 27, INK, fill=True)
    s.rect(2, 2, 77, 23, OIL3, fill=True)
    s.rect(3, 3, 76, 20, OIL, fill=True)
    s.rect(3, 3, 76, 8, OIL2, fill=True)
    for x in (8, 71):
        s.circle(x, 13, 3, OIL3, fill=True)
        s.px(x - 1, 11, OIL2)

    # 5x5 block capitals: P R E S S
    glyphs = {
        "P": ["11110", "10001", "11110", "10000", "10000"],
        "R": ["11110", "10001", "11110", "10100", "10010"],
        "E": ["11111", "10000", "11110", "10000", "11111"],
        "S": ["01111", "10000", "01110", "00001", "11110"],
    }
    word = "PRESS"
    ox0 = 18
    for gi, ch in enumerate(word):
        g = glyphs[ch]
        ox = ox0 + gi * 9
        for y, row in enumerate(g):
            for x, bit in enumerate(row):
                if bit == "1":
                    s.px(ox + x, 10 + y, INK)
                    s.px(ox + x, 9 + y, PAPER)
    save(s, "btn-press", scale=3)


def chamber_frame() -> None:
    # 96x96 decorative frame around grid (will be used as border bg)
    s = Sprite(96, 96, palette=PAL)
    s.rect(0, 0, 95, 95, INK, fill=True)
    s.rect(4, 4, 91, 91, PANEL, fill=True)
    s.rect(8, 8, 87, 87, INK, fill=True)
    # bolts
    for x, y in ((6, 6), (89, 6), (6, 89), (89, 89), (48, 6), (48, 89), (6, 48), (89, 48)):
        s.circle(x, y, 3, STEEL, fill=True)
        s.px(x - 1, y - 1, STEEL2)
    # label strip
    s.rect(28, 2, 67, 10, PANEL2, fill=True)
    for i, col in enumerate([STEEL2, PAPER, STEEL2, PAPER, MUTED]):
        s.px(34 + i * 5, 5, col)
        s.px(34 + i * 5, 6, col)
    save(s, "chamber-frame", scale=2)


def panel_tile() -> None:
    s = Sprite(32, 32, palette=PAL)
    s.rect(0, 0, 31, 31, PANEL, fill=True)
    for y in range(0, 32, 4):
        s.rect(0, y, 31, y, mix(PANEL, INK, 0.35))
    for x in range(0, 32, 8):
        s.rect(x, 0, x, 31, mix(PANEL, STEEL, 0.25))
    s.rect(0, 0, 31, 0, STEEL2)
    s.rect(0, 31, 31, 31, INK)
    save(s, "panel-tile", scale=2)


def queue_slot() -> None:
    s = Sprite(48, 40, palette=PAL)
    s.rect(0, 0, 47, 39, INK, fill=True)
    s.rect(2, 2, 45, 37, PANEL, fill=True)
    s.rect(4, 4, 43, 35, mix(INK, PANEL, 0.5), fill=True)
    s.rect(2, 2, 45, 2, STEEL)
    save(s, "queue-slot", scale=3)


def queue_slot_active() -> None:
    s = Sprite(48, 40, palette=PAL)
    s.rect(0, 0, 47, 39, OIL3, fill=True)
    s.rect(2, 2, 45, 37, PANEL, fill=True)
    s.rect(4, 4, 43, 35, mix(INK, OIL, 0.35), fill=True)
    s.rect(2, 2, 45, 2, OIL2)
    s.rect(2, 37, 45, 37, OIL)
    save(s, "queue-slot-active", scale=3)


def floor_bg() -> None:
    s = Sprite(64, 64, palette=PAL)
    s.rect(0, 0, 63, 63, mix(PANEL, INK, 0.4), fill=True)
    for y in range(0, 64, 8):
        for x in range(0, 64, 8):
            if (x // 8 + y // 8) % 2 == 0:
                s.rect(x, y, x + 7, y + 7, mix(PANEL, INK, 0.55), fill=True)
    # scuff
    for x, y in ((10, 20), (40, 12), (22, 50), (55, 40)):
        s.px(x, y, mix(STEEL, INK, 0.5))
        s.px(x + 1, y, mix(STEEL, INK, 0.5))
    save(s, "floor", scale=2)


def ram() -> None:
    s = Sprite(48, 20, palette=PAL)
    s.rect(18, 0, 29, 8, STEEL, fill=True)
    s.rect(8, 8, 39, 19, STEEL2, fill=True)
    s.rect(8, 8, 39, 10, PAPER)
    s.rect(8, 17, 39, 19, INK)
    for x in (12, 24, 36):
        s.px(x, 13, INK)
        s.px(x, 14, PANEL)
    save(s, "ram", scale=3)


def swatch() -> None:
    s = Sprite(16, 16, palette=PAL)
    cols = [PLASTIC[2], METAL[2], GLASS[2], ORGANIC[2], ELEC[2], OIL, LAMP, PAPER]
    for i, c in enumerate(cols):
        x = (i % 4) * 4
        y = (i // 4) * 4
        s.rect(x, y, x + 3, y + 3, c, fill=True)
    save(s, "swatch", scale=8)


def main() -> None:
    tile_empty()
    tile_mat("plastic", PLASTIC, "diag")
    tile_mat("metal", METAL, "hatch")
    tile_mat("glass", GLASS, "glass")
    tile_mat("organic", ORGANIC, "dots")
    tile_mat("electronics", ELEC, "chips")
    tile_ghost()
    lamp(False)
    lamp(True)
    press_btn()
    chamber_frame()
    panel_tile()
    queue_slot()
    queue_slot_active()
    floor_bg()
    ram()
    swatch()
    print("done ->", OUT)


if __name__ == "__main__":
    main()
