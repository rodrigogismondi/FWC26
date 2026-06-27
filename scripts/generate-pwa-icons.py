"""Generate PWA icons for FWC26 (run once or when branding changes)."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public"

BG = "#0b1410"
GREEN = "#00c853"
WHITE = "#e8f0ea"
GOLD = "#ffd54f"


def draw_soccer_ball(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    pent_r = max(r // 3, 4)
    draw.ellipse([cx - pent_r, cy - pent_r, cx + pent_r, cy + pent_r], fill=BG)
    patch = max(r // 5, 3)
    for angle in range(0, 360, 72):
        rad = angle * 3.14159265 / 180
        px = cx + int((r * 0.62) * __import__("math").cos(rad))
        py = cy + int((r * 0.62) * __import__("math").sin(rad))
        draw.ellipse([px - patch, py - patch, px + patch, py + patch], fill=BG)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    if maskable:
        pad = size // 5
        draw.rounded_rectangle([0, 0, size, size], radius=size // 8, fill=BG)
        ball_r = (size - 2 * pad) // 2 - size // 16
        draw_soccer_ball(draw, size // 2, size // 2, ball_r)
    else:
        inset = size // 10
        draw.rounded_rectangle(
            [inset, inset, size - inset, size - inset],
            radius=size // 6,
            fill=GREEN,
        )
        ball_r = size // 3
        draw_soccer_ball(draw, size // 2, size // 2, ball_r)
        badge_r = size // 7
        bx = size - inset - badge_r
        by = inset + badge_r
        draw.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r], fill=GOLD)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "apple-touch-icon.png": (180, False),
        "pwa-192x192.png": (192, False),
        "pwa-512x512.png": (512, False),
        "pwa-maskable-512x512.png": (512, True),
        "favicon-32x32.png": (32, False),
    }
    for name, (size, maskable) in sizes.items():
        make_icon(size, maskable).save(OUT / name)
        print(f" wrote {name}")

    # favicon.ico from 32px
    small = make_icon(32, False)
    small.save(OUT / "favicon.ico", format="ICO", sizes=[(32, 32)])
    print(" wrote favicon.ico")


if __name__ == "__main__":
    main()
