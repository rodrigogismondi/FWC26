"""Generate PWA icons from src/assets/icon.png."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "assets" / "icon.png"
OUT = ROOT / "public"
BG = "#0b1410"


def fit_icon(size: int, content_scale: float = 0.92) -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source icon: {SOURCE}")

    src = Image.open(SOURCE).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), BG)

    target = int(size * content_scale)
    fitted = src.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)

    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "apple-touch-icon.png": (180, 0.92),
        "pwa-192x192.png": (192, 0.92),
        "pwa-512x512.png": (512, 0.92),
        "pwa-maskable-512x512.png": (512, 0.72),
        "favicon-32x32.png": (32, 0.88),
    }
    for name, (size, scale) in sizes.items():
        fit_icon(size, scale).save(OUT / name)
        print(f" wrote {name}")

    small = fit_icon(32, 0.88).convert("RGB")
    small.save(OUT / "favicon.ico", format="ICO", sizes=[(32, 32)])
    print(" wrote favicon.ico")


if __name__ == "__main__":
    main()
