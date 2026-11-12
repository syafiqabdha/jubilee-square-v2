#!/usr/bin/env python3
"""Generate branded "Coming soon" placeholder images.

Scans packages/db/src/seed-data.ts for every /images/{tenants,promotions,signage}/*.jpg
reference and writes a placeholder for each one that does not exist yet under
apps/web/public. Existing files are never overwritten, so dropping a real photo in
place of a placeholder is all it takes to replace it.

    python3 infra/scripts/generate-placeholders.py          # create missing only
    python3 infra/scripts/generate-placeholders.py --force  # regenerate all placeholders

Requires Pillow (pip install pillow).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "packages/db/src/seed-data.ts"
PUBLIC = ROOT / "apps/web/public"
LOGO = PUBLIC / "brand/jubilee-square-logo-white.png"

NAVY = (37, 47, 129)
NAVY_DARK = (20, 26, 74)
RED = (198, 10, 77)
WHITE = (255, 255, 255)

SIZES = {
    "tenants": (1600, 900),
    "promotions": (1200, 630),
    "signage": (1920, 1080),
}

FONT_DIRS = [
    Path("/usr/share/fonts/opentype/inter"),
    Path("/usr/share/fonts/truetype/dejavu"),
    Path("/System/Library/Fonts/Supplemental"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    names = {
        "bold": ["Inter-ExtraBold.otf", "Inter-Bold.otf", "DejaVuSans-Bold.ttf", "Arial Bold.ttf"],
        "medium": ["Inter-Medium.otf", "Inter-Regular.otf", "DejaVuSans.ttf", "Arial.ttf"],
    }[weight]
    for d in FONT_DIRS:
        for n in names:
            p = d / n
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def find_references() -> list[tuple[str, str]]:
    src = SEED.read_text(encoding="utf-8")
    refs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(r"'(/images/(tenants|promotions|signage)/[^']+\.jpg)'", src):
        path, kind = m.group(1), m.group(2)
        if path in seen:
            continue
        seen.add(path)
        before = src[: m.start()]
        key = "tenantName" if kind == "promotions" else ("title" if kind == "signage" else "name")
        labels = re.findall(rf"\b{key}: '([^']+)'", before)
        refs.append((path, labels[-1] if labels else ""))
    return refs


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:2]


def render(kind: str, label: str, out: Path) -> None:
    w, h = SIZES[kind]
    img = Image.new("RGB", (w, h), NAVY)
    draw = ImageDraw.Draw(img)

    # Diagonal gradient towards a darker navy.
    for y in range(h):
        t = y / h
        c = tuple(int(NAVY[i] * (1 - t * 0.55) + NAVY_DARK[i] * t * 0.55) for i in range(3))
        draw.line([(0, y), (w, y)], fill=c)

    # Brand "sq" square accent, bottom-right, partially off-canvas.
    s = int(h * 0.62)
    draw.rectangle([w - int(s * 0.72), h - int(s * 0.72), w + s, h + s], fill=RED)

    unit = h / 100
    pad = int(w * 0.07)

    # Logo, top-left.
    logo = Image.open(LOGO).convert("RGBA")
    lw = int(w * 0.24)
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (pad, int(unit * 9)), logo)

    # "COMING SOON" headline.
    head = font("bold", int(unit * 15))
    y = int(unit * 42)
    draw.text((pad, y), "Coming soon", font=head, fill=WHITE)

    # Red rule.
    y += int(unit * 19)
    draw.rectangle([pad, y, pad + int(unit * 12), y + max(4, int(unit * 1.1))], fill=RED)

    # Label (tenant / promotion / slide).
    if label:
        sub = font("medium", int(unit * 5.2))
        y += int(unit * 4.5)
        for line in wrap(draw, label, sub, int(w * 0.62)):
            draw.text((pad, y), line, font=sub, fill=(220, 224, 245))
            y += int(unit * 7)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=82, optimize=True, progressive=True)


def main() -> int:
    force = "--force" in sys.argv
    made = 0
    for path, label in find_references():
        kind = path.split("/")[2]
        out = PUBLIC / path.lstrip("/")
        if out.exists() and not force:
            continue
        render(kind, label, out)
        made += 1
        print(f"  wrote {out.relative_to(ROOT)}")
    print(f"{made} placeholder image(s) generated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
