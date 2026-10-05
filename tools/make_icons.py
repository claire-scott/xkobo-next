#!/usr/bin/env python3
"""Generate the PWA icons (pure python, no dependencies): pixel-art 'XK' on a dark tile."""
import struct, zlib, sys, os

GLYPHS = {
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
}
BG = (5, 6, 13)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def color_at(t):
    stops = [(0.0, (217, 243, 255)), (0.45, (95, 240, 255)), (0.55, (42, 143, 168)), (1.0, (255, 79, 208))]
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return stops[-1][1]

def render(size):
    cols, rows = 11, 7                      # X + gap + K
    cell = int(size * 0.62 / cols)          # keeps the art inside the maskable safe zone
    w, h = cols * cell, rows * cell
    ox, oy = (size - w) // 2, (size - h) // 2
    px = [[BG] * size for _ in range(size)]
    # subtle vignette-ish tile glow
    for y in range(size):
        for x in range(size):
            d = ((x - size / 2) ** 2 + (y - size / 2) ** 2) ** 0.5 / (size * 0.7)
            px[y][x] = lerp((14, 24, 48), BG, min(1, d))
    for gi, ch in enumerate('XK'):
        for r, row in enumerate(GLYPHS[ch]):
            for c, v in enumerate(row):
                if v != '1': continue
                x0 = ox + (gi * 6 + c) * cell
                y0 = oy + r * cell
                col = color_at((r + 0.5) / rows)
                for y in range(y0, y0 + cell - max(1, cell // 14)):
                    for x in range(x0, x0 + cell - max(1, cell // 14)):
                        px[y][x] = col
    return px

def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p) for row in px)
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

out = sys.argv[1] if len(sys.argv) > 1 else 'assets'
for s in (180, 192, 512):
    write_png(os.path.join(out, f'icon-{s}.png'), render(s))
    print('icon', s)
