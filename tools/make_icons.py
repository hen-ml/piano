#!/usr/bin/env python3
"""Regenerate the PNG app icons from the same shapes as icon.svg.

iOS ignores SVG for `apple-touch-icon`, and the web manifest wants raster
sizes, so the repository ships PNGs next to the SVG. There is no SVG
rasterizer in CI or in the browser, and adding an image dependency for four
rectangles is not worth it — this draws them with zlib and struct only.

Usage: python3 tools/make_icons.py
"""

import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIZES = {'icon-180.png': 180, 'icon-192.png': 192, 'icon-512.png': 512}
SS = 4                      # supersampling factor


def px(c):
    return (c >> 16 & 255, c >> 8 & 255, c & 255)


BG = px(0x0a0a0c)
BODY = px(0x141416)
BODY_EDGE = px(0x2a2a32)
FELT = px(0xa01a24)
WHITE = px(0xfdfdfd)
WHITE_RX = [px(0xfdfdfd), px(0xfdfdfd), px(0xe6ddff), px(0xfdfdfd),
            px(0xfdfdfd), px(0xcbb8ff), px(0xfdfdfd)]
WHITE_EDGE = px(0xb9bcc4)
BLACK = px(0x17181c)


def rounded_rect(buf, w, x, y, rw, rh, radius, color):
    """Fill a rounded rectangle into a flat RGBA bytearray (hard edges)."""
    x0, y0, x1, y1 = x, y, x + rw, y + rh

    def inside(px_, py_):
        if px_ < x0 or px_ >= x1 or py_ < y0 or py_ >= y1:
            return False
        # clamp to the corner circle centre nearest this point
        cx = min(max(px_ + 0.5, x0 + radius), x1 - radius)
        cy = min(max(py_ + 0.5, y0 + radius), y1 - radius)
        dx, dy = px_ + 0.5 - cx, py_ + 0.5 - cy
        return dx * dx + dy * dy <= radius * radius

    for py_ in range(max(0, int(y0)), min(w, int(y1) + 1)):
        for px_ in range(max(0, int(x0)), min(w, int(x1) + 1)):
            if inside(px_, py_):
                i = (py_ * w + px_) * 4
                buf[i:i + 4] = bytes(color) + b'\xff'


def render(size):
    """Draw at SS× and box-downsample, so curved edges are antialiased."""
    n = size * SS
    s = n / 512.0                          # SVG units -> pixels
    buf = bytearray(n * n * 4)
    rounded_rect(buf, n, 0, 0, n, n, 96 * s, BG)
    # body with its 4px stroke, then the red felt strip
    rounded_rect(buf, n, 70 * s, 150 * s, 372 * s, 230 * s, 18 * s, BODY_EDGE)
    rounded_rect(buf, n, 72 * s, 152 * s, 368 * s, 226 * s, 17 * s, BODY)
    rounded_rect(buf, n, 86 * s, 150 * s, 16 * s, 212 * s, 0, FELT)
    # white keys, each with a thin outline
    for i in range(7):
        x = (110 + 46 * i) * s
        rounded_rect(buf, n, x, 176 * s, 44 * s, 180 * s, 6 * s, WHITE_RX[i])
        rounded_rect(buf, n, x, 176 * s, 44 * s, 2 * s, 0, WHITE_EDGE)
        rounded_rect(buf, n, x, 176 * s, 2 * s, 180 * s, 0, WHITE_EDGE)
        rounded_rect(buf, n, x + 42 * s, 176 * s, 2 * s, 180 * s, 0, WHITE_EDGE)
    # black keys
    for x in (142, 188, 280, 326, 372):
        rounded_rect(buf, n, x * s, 176 * s, 26 * s, 112 * s, 4 * s, BLACK)

    # box downsample SS×SS -> 1
    out = bytearray(size * size * 3)
    area = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = 0
            for dy in range(SS):
                row = ((y * SS + dy) * n + x * SS) * 4
                for dx in range(SS):
                    i = row + dx * 4
                    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]
            o = (y * size + x) * 3
            out[o:o + 3] = bytes((r // area, g // area, b // area))
    return out


def write_png(path, size, rgb):
    raw = bytearray()
    for y in range(size):
        raw.append(0)                       # filter: none
        raw += rgb[y * size * 3:(y + 1) * size * 3]

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) +
           chunk(b'IDAT', zlib.compress(bytes(raw), 9)) +
           chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    for name, size in SIZES.items():
        path = os.path.join(OUT, name)
        write_png(path, size, render(size))
        print('wrote', name)
