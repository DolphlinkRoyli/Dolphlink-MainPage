"""
Generate PWA icons from the master logo.

Run from project root:
    python3 integrations/pwa/generate-icons.py

Source:  media/icon/3D/logo.webp
Outputs: media/icon/pwa/icon-{192,512}.png
         media/icon/pwa/icon-maskable-512.png
         media/icon/pwa/apple-touch-icon.png

Re-run whenever the master logo changes.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'media/icon/3D/logo.webp')
DST_DIR = os.path.join(ROOT, 'media/icon/pwa')

# DOLPHLINK brand blue (matches CSS --baiwu-blue-primary)
BRAND_BLUE = (0, 89, 179, 255)

os.makedirs(DST_DIR, exist_ok=True)
logo = Image.open(SRC).convert('RGBA')
print(f"Source: {SRC} ({logo.size[0]}x{logo.size[1]})")

# Standard 192 — transparent background, full-bleed logo
icon192 = logo.resize((192, 192), Image.LANCZOS)
out = os.path.join(DST_DIR, 'icon-192.png')
icon192.save(out, 'PNG', optimize=True)
print(f"  ✓ {out}  ({os.path.getsize(out):,} bytes)")

# Standard 512
icon512 = logo.resize((512, 512), Image.LANCZOS)
out = os.path.join(DST_DIR, 'icon-512.png')
icon512.save(out, 'PNG', optimize=True)
print(f"  ✓ {out}  ({os.path.getsize(out):,} bytes)")

# Maskable 512 — brand blue background + 80% safe zone
# Android crops icons into circles/squircles; the safe zone keeps the logo
# inside the visible mask area no matter the device shape.
canvas = Image.new('RGBA', (512, 512), BRAND_BLUE)
inner = logo.resize((360, 360), Image.LANCZOS)
canvas.paste(inner, (76, 76), inner)
out = os.path.join(DST_DIR, 'icon-maskable-512.png')
canvas.save(out, 'PNG', optimize=True)
print(f"  ✓ {out}  ({os.path.getsize(out):,} bytes)")

# Apple touch icon 180 — brand blue background, slightly larger logo
apple = Image.new('RGBA', (180, 180), BRAND_BLUE)
inner_apple = logo.resize((140, 140), Image.LANCZOS)
apple.paste(inner_apple, (20, 20), inner_apple)
out = os.path.join(DST_DIR, 'apple-touch-icon.png')
apple.save(out, 'PNG', optimize=True)
print(f"  ✓ {out}  ({os.path.getsize(out):,} bytes)")

print("\nAll PWA icons regenerated.")
