"""
Generates all PWA icons for HamVajeh — a minimal chain-link mark: two capsule
"rings" (like the classic link/chain glyph) interlocked diagonally, symbolizing
a collocation (two words locked together). Pure vector drawing via Pillow,
no external assets or font-shaping dependencies.
"""

from PIL import Image, ImageDraw, ImageChops

BRAND = (231, 111, 31)       # matches --color-brand-500
BRAND_DARK = (168, 58, 18)
WHITE = (255, 255, 255)

OUTPUT_DIR = "/home/claude/proj_review/frontend/public"


def capsule_ring(canvas: int, length: int, thickness: int, ring_width: int) -> Image.Image:
    """A horizontal capsule OUTLINE (a rounded-rectangle ring, like one link
    of a chain) centered on a transparent square canvas, ready to be rotated."""
    outer_mask = Image.new("L", (canvas, canvas), 0)
    d = ImageDraw.Draw(outer_mask)
    x0 = (canvas - length) // 2
    x1 = x0 + length
    y0 = (canvas - thickness) // 2
    y1 = y0 + thickness
    d.rounded_rectangle([x0, y0, x1, y1], radius=thickness // 2, fill=255)

    inner_mask = Image.new("L", (canvas, canvas), 0)
    d2 = ImageDraw.Draw(inner_mask)
    ix0, iy0 = x0 + ring_width, y0 + ring_width
    ix1, iy1 = x1 - ring_width, y1 - ring_width
    inner_thickness = iy1 - iy0
    d2.rounded_rectangle([ix0, iy0, ix1, iy1], radius=max(inner_thickness // 2, 1), fill=255)

    ring_mask = ImageChops.subtract(outer_mask, inner_mask)

    ring = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    ring.paste(Image.new("RGBA", (canvas, canvas), (*WHITE, 255)), (0, 0), ring_mask)
    return ring


def draw_mark(size: int, safe_zone_ratio: float = 1.0) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Background: rounded square, diagonal brand gradient
    corner_radius = int(size * 0.22)
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / size
        r = int(BRAND[0] + (BRAND_DARK[0] - BRAND[0]) * t)
        g = int(BRAND[1] + (BRAND_DARK[1] - BRAND[1]) * t)
        b = int(BRAND[2] + (BRAND_DARK[2] - BRAND[2]) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # Foreground: two chain-link capsule rings, interlocked at ~90 degrees
    length = int(size * 0.52 * safe_zone_ratio)
    thickness = int(size * 0.24 * safe_zone_ratio)
    ring_width = max(int(size * 0.075 * safe_zone_ratio), 4)
    canvas_size = int(length * 1.8)

    ring = capsule_ring(canvas_size, length, thickness, ring_width)

    ring_a = ring.rotate(45, resample=Image.BICUBIC, expand=False)
    ring_b = ring.rotate(-45, resample=Image.BICUBIC, expand=False)

    cx, cy = size // 2, size // 2
    pos = (cx - canvas_size // 2, cy - canvas_size // 2)

    img.alpha_composite(ring_b, pos)
    img.alpha_composite(ring_a, pos)

    return img


def save(img: Image.Image, name: str):
    path = f"{OUTPUT_DIR}/{name}"
    img.save(path, "PNG")
    print(f"saved {path} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    save(draw_mark(192), "pwa-192x192.png")
    save(draw_mark(512), "pwa-512x512.png")
    save(draw_mark(192, safe_zone_ratio=0.72), "maskable-192x192.png")
    save(draw_mark(512, safe_zone_ratio=0.72), "maskable-512x512.png")
    save(draw_mark(180), "apple-touch-icon.png")
