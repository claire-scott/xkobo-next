#!/usr/bin/env python3
"""Convert xkobo's scenes.C stage table into js/scenes.js (data only)."""
import re, sys, json

src = open(sys.argv[1]).read()
body = src[src.index('_scene scene[] = {') + len('_scene scene[] ='):]
body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)           # comments
body = body.rsplit(';', 1)[0]
toks = re.findall(r'\{|\}|&?\w+|-?\d+|,', body)

def parse(i):
    assert toks[i] == '{'
    out, i = [], i + 1
    while toks[i] != '}':
        if toks[i] == ',':
            i += 1
        elif toks[i] == '{':
            sub, i = parse(i)
            out.append(sub)
        else:
            t = toks[i].lstrip('&')
            out.append(int(t) if re.fullmatch(r'-?\d+', t) else t)
            i += 1
    return out, i + 1

top, _ = parse(toks.index('{'))
scenes = []
for s in top:
    ratio, sx, sy, ek1, i1, ek2, i2, emax, enemies, bmax, bases = s
    if ratio == -1:
        continue
    assert emax <= len(enemies) and bmax <= len(bases), s
    scenes.append(dict(ratio=ratio, startx=sx, starty=sy, ek1=ek1, ek1Interval=i1,
                       ek2=ek2, ek2Interval=i2,
                       enemies=[dict(kind=e[0], num=e[1], speed=e[2]) for e in enemies[:emax]],
                       bases=[dict(x=b[0], y=b[1], h=b[2], v=b[3]) for b in bases[:bmax]]))

lines = ['// Generated from xkobo scenes.C by tools/gen_scenes.py -- stage data only.',
         '// Enemy kinds are referenced by name and resolved in enemy.js.',
         'export const scenes = [']
for n, s in enumerate(scenes, 1):
    lines.append(f'  // {n}')
    lines.append('  ' + json.dumps(s, separators=(',', ':')) + ',')
lines.append('];')
open(sys.argv[2], 'w').write('\n'.join(lines) + '\n')
print(len(scenes), 'scenes')
