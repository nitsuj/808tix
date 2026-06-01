#!/usr/bin/env python3
"""Regenerate supabase/functions/wallet-apple/wallet-assets.ts embedded PassKit PNGs."""

from __future__ import annotations

import base64
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "supabase/functions/wallet-apple/wallet-assets.ts"


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def png_rgb(w: int, h: int, pixel_fn) -> bytes:
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw.extend(pixel_fn(x, y, w, h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


PURPLE = (162, 91, 255)
PINK = (255, 45, 120)
DARK = (10, 6, 20)
LIGHT = (226, 204, 255)
WHITE = (255, 255, 255)


def icon_pixel(x: int, y: int, w: int, h: int) -> bytes:
    t = (x + y) / max(w + h - 2, 1)
    r, g, b = lerp(PURPLE[0], PINK[0], t), lerp(PURPLE[1], PINK[1], t), lerp(PURPLE[2], PINK[2], t)
    cx, cy = w / 2, h / 2
    if abs(x - cx) < w * 0.22 and abs(y - cy) < h * 0.18:
        return bytes(WHITE)
    return bytes([r, g, b])


def logo_pixel(x: int, y: int, w: int, h: int) -> bytes:
    t = x / max(w - 1, 1)
    r = lerp(PURPLE[0], PINK[0], t * 0.85)
    g = lerp(PURPLE[1], PINK[1], t * 0.85)
    b = lerp(PURPLE[2], PINK[2], t * 0.85)
    bar_h = max(2, h // 5)
    if y < bar_h or y > h - bar_h:
        return bytes([r, g, b])
    if x < w * 0.55 and (x % max(w // 8, 1)) < max(w // 16, 1):
        return bytes(LIGHT)
    return bytes([r, g, b])


def strip_pixel(x: int, y: int, w: int, h: int) -> bytes:
    t = x / max(w - 1, 1)
    ty = y / max(h - 1, 1)
    r = lerp(DARK[0], PURPLE[0], t * 0.7 + ty * 0.2)
    g = lerp(DARK[1], PURPLE[1], t * 0.7 + ty * 0.2)
    b = lerp(DARK[2], PURPLE[2], t * 0.7 + ty * 0.2)
    if ty < 0.35:
        r = lerp(r, PINK[0], 0.35)
        g = lerp(g, PINK[1], 0.35)
        b = lerp(b, PINK[2], 0.35)
    return bytes([int(r), int(g), int(b)])


def main() -> None:
    assets = {
        "ICON_PNG_1X_B64": png_rgb(29, 29, icon_pixel),
        "ICON_PNG_2X_B64": png_rgb(58, 58, icon_pixel),
        "ICON_PNG_3X_B64": png_rgb(87, 87, icon_pixel),
        "LOGO_PNG_1X_B64": png_rgb(160, 50, logo_pixel),
        "LOGO_PNG_2X_B64": png_rgb(320, 100, logo_pixel),
        "LOGO_PNG_3X_B64": png_rgb(480, 150, logo_pixel),
        "STRIP_PNG_1X_B64": png_rgb(375, 98, strip_pixel),
        "STRIP_PNG_2X_B64": png_rgb(750, 196, strip_pixel),
        "STRIP_PNG_3X_B64": png_rgb(1125, 294, strip_pixel),
    }

    lines = [
        "/**",
        " * PassKit images embedded for Supabase Edge (no runtime filesystem).",
        " * Wallet Visual v1 — purple/pink 808Tix branding.",
        " * Regenerate: python3 scripts/generate-wallet-assets.py",
        " */",
        "",
        "function decodeBase64Png(base64: string): Uint8Array {",
        "  const binary = atob(base64);",
        "  const bytes = new Uint8Array(binary.length);",
        "  for (let i = 0; i < binary.length; i++) {",
        "    bytes[i] = binary.charCodeAt(i);",
        "  }",
        "  return bytes;",
        "}",
        "",
    ]

    for name, data in assets.items():
        lines.append(f"const {name} = '{base64.b64encode(data).decode()}';")
        lines.append("")

    for var, const in [
        ("walletIcon1x", "ICON_PNG_1X_B64"),
        ("walletIcon2x", "ICON_PNG_2X_B64"),
        ("walletIcon3x", "ICON_PNG_3X_B64"),
        ("walletLogo1x", "LOGO_PNG_1X_B64"),
        ("walletLogo2x", "LOGO_PNG_2X_B64"),
        ("walletLogo3x", "LOGO_PNG_3X_B64"),
        ("walletStrip1x", "STRIP_PNG_1X_B64"),
        ("walletStrip2x", "STRIP_PNG_2X_B64"),
        ("walletStrip3x", "STRIP_PNG_3X_B64"),
    ]:
        lines.append(f"export const {var} = decodeBase64Png({const});")
        lines.append("")

    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
