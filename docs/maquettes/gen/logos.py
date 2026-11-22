# Génère les 3 propositions de logo Scoutra (SVG). Logotype : contours de Mona Sans (SIL OFL), "t" redessiné.
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
F = '/tmp/claude-0/-home-user-automatic-eureka/46a28097-9136-5448-9a55-0ea1cd91f980/scratchpad/fonts/'
OUT = '/home/user/automatic-eureka/docs/design/logo/'
INK, PAPER, ORANGE, BLUE = '#12141A', '#FFFFFF', '#FF5B1F', '#2B59FF'

def f2(v): return ('%.2f' % v).rstrip('0').rstrip('.')

# ---------- Symboles (grille 64) ----------
def mark_trace(col, heavy=False):
    w = 11 if heavy else 10
    r = 6.5 if heavy else 6
    # "S" tracé comme un itinéraire (deux virages) qui aboutit à un point : le prospect trouvé.
    return (f'<path d="M9 52H33A10 10 0 0 0 33 32H21A10 10 0 0 1 21 12H39" fill="none" stroke="{col}" '
            f'stroke-width="{w}" stroke-linejoin="round"/><circle cx="{50 if not heavy else 51}" cy="12" r="{r}" fill="{col}"/>')

def mark_cap(col, heavy=False):
    w = 8 if heavy else 7
    cx, cy, R = 29, 35, 19
    a1, a2 = math.radians(-72), math.radians(-18)
    p1 = (cx + R*math.cos(a2), cy + R*math.sin(a2)); p2 = (cx + R*math.cos(a1), cy + R*math.sin(a1))
    ring = f'<path d="M{f2(p1[0])} {f2(p1[1])}A{R} {R} 0 1 1 {f2(p2[0])} {f2(p2[1])}" fill="none" stroke="{col}" stroke-width="{w}"/>'
    d = (math.sqrt(.5), -math.sqrt(.5)); p = (math.sqrt(.5), math.sqrt(.5))
    hw = 7.5 if heavy else 6.5
    def at(t, s=0): return (cx + t*d[0] + s*p[0], cy + t*d[1] + s*p[1])
    pts = [at(36), at(3, hw), at(-7), at(3, -hw)]
    needle = '<path d="M' + 'L'.join(f'{f2(x)} {f2(y)}' for x, y in pts) + f'Z" fill="{col}"/>'
    return ring + needle

def mark_repere(col, heavy=False):
    w = 9 if heavy else 8
    return (f'<path d="M8 27V8H27M56 37V56H37" fill="none" stroke="{col}" stroke-width="{w}"/>'
            f'<circle cx="38" cy="26" r="{9 if heavy else 8}" fill="{col}"/>')

MARKS = {'a-trace': mark_trace, 'b-cap': mark_cap, 'c-repere': mark_repere}

# ---------- Logotype ----------
def logotype(fontfile, tracking, custom_t=True, kern=None):
    f = TTFont(F + fontfile); gs = f.getGlyphSet(); cmap = f.getBestCmap()
    bp = BoundsPen(gs); gs[cmap[ord('l')]].draw(bp); stem = bp.bounds[2] - bp.bounds[0]
    xh = f['OS/2'].sxHeight
    paths, x = [], 0
    kern = kern or {}
    word = 'scoutra'
    for i, ch in enumerate(word):
        if ch == 't' and custom_t:
            # "t" maison : fût droit sans crochet, sommet biseauté vers l'avant (un cap), barre seulement à droite + petit ergot.
            sb = 0.40 * stem; hb = 0.78 * stem; top = xh + 0.30 * xh
            x0, x1 = x + sb, x + sb + stem
            bar_l, bar_r = x0 - 0.30 * stem, x1 + 0.90 * stem
            d = (f'M{f2(x0)} 0H{f2(x1)}V{f2(xh-hb)}H{f2(bar_r)}V{f2(xh)}H{f2(x1)}V{f2(top)}'
                 f'L{f2(x0)} {f2(top-0.62*stem)}V{f2(xh)}H{f2(bar_l)}V{f2(xh-hb)}H{f2(x0)}Z')
            paths.append(('raw', d)); adv = bar_r - x + 0.06 * stem
        else:
            g = cmap[ord(ch)]; pen = SVGPathPen(gs)
            gs[g].draw(TransformPen(pen, (1, 0, 0, 1, x, 0))); paths.append(('raw', pen.getCommands())); adv = gs[g].width
        x += adv + tracking + kern.get(word[i:i+2], 0)
    width = x - tracking
    return paths, width, xh

def flip_group(paths, scale, tx, ty, col):
    inner = ''.join(f'<path d="{d}"/>' for _, d in paths)
    return f'<g transform="translate({f2(tx)} {f2(ty)}) scale({scale:.6f} {-scale:.6f})" fill="{col}">{inner}</g>'

TYPES = {
    'a-trace':  dict(font='mona-112.5-600.ttf', tracking=-22, kern={'ou': -6, 'ra': -10}),
    'b-cap':    dict(font='mona-100-600.ttf', tracking=-14, kern={'ra': -8}),
    'c-repere': dict(font='mona-125-600.ttf', tracking=-30, kern={'ou': -8, 'ra': -14}),
}

def lockup(key, text_col, mark_col):
    paths, wunits, xh = logotype(**{k: v for k, v in TYPES[key].items() if k != 'font'}, fontfile=TYPES[key]['font'])
    H = 64                     # hauteur de la planche
    s = 30 / xh                # x-height = 30 px
    base = 47                  # ligne de base
    mark_size = 44             # symbole un peu plus haut que la x-height
    gap = 14
    mark = MARKS[key](mark_col)
    mk = f'<g transform="translate(0 {f2((H-mark_size)/2)}) scale({mark_size/64})">{mark}</g>'
    tx = mark_size + gap
    W = tx + wunits * s
    txt = flip_group(paths, s, tx, base, text_col)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f2(W)} {H}" width="{f2(W)}" height="{H}" role="img" aria-label="Scoutra">'
            f'<title>Scoutra</title>{mk}{txt}</svg>\n')

def wordmark_only(key, col):
    paths, wunits, xh = logotype(**{k: v for k, v in TYPES[key].items() if k != 'font'}, fontfile=TYPES[key]['font'])
    s = 30 / xh; W = wunits * s
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f2(W)} 44" width="{f2(W)}" height="44" role="img" aria-label="Scoutra">'
            f'{flip_group(paths, s, 0, 40, col)}</svg>\n')

def symbol(key, col, heavy=False, size=64):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" role="img" aria-label="Scoutra">'
            f'{MARKS[key](col, heavy)}</svg>\n')

def app_icon(key, bg, fg):
    # Tuile 512 : le symbole occupe ~56 % de la tuile (zone de sécurité iOS/Android respectée).
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Scoutra">'
            f'<rect width="512" height="512" rx="114" fill="{bg}"/>'
            f'<g transform="translate(112 112) scale(4.5)">{MARKS[key](fg, True)}</g></svg>\n')

def favicon(key, bg, fg):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
            f'<rect width="32" height="32" rx="7" fill="{bg}"/>'
            f'<g transform="translate(4 4) scale(.375)">{MARKS[key](fg, True)}</g></svg>\n')

os.makedirs(OUT, exist_ok=True)
for key in MARKS:
    files = {
        f'{key}-symbole.svg': symbol(key, ORANGE),
        f'{key}-logo-clair.svg': lockup(key, INK, ORANGE),
        f'{key}-logo-sombre.svg': lockup(key, PAPER, ORANGE),
        f'{key}-logotype.svg': wordmark_only(key, INK),
        f'{key}-icone-app.svg': app_icon(key, ORANGE, INK),
        f'{key}-favicon-32.svg': favicon(key, ORANGE, INK),
        f'{key}-favicon-32-bleu.svg': favicon(key, BLUE, PAPER),
    }
    for n, c in files.items():
        open(OUT + n, 'w').write(c)
print(sorted(os.listdir(OUT)))

# Extrait inline pour les maquettes : symbole = currentColor du groupe .logo-mark (accent), texte = currentColor.
def inline_logo():
    key = 'a-trace'
    paths, wunits, xh = logotype(**{k: v for k, v in TYPES[key].items() if k != 'font'}, fontfile=TYPES[key]['font'])
    s = 30 / xh; H = 64; mark_size = 44; gap = 14; tx = mark_size + gap; W = tx + wunits * s
    inner = ''.join(f'<path d="{d}"/>' for _, d in paths)
    mark = MARKS[key]('currentColor')
    return (f'<svg class="logo" viewBox="0 0 {f2(W)} {H}" role="img" aria-label="Scoutra"><g class="logo-mark" transform="translate(0 10) scale(.6875)">{mark}</g>'
            f'<g transform="translate({f2(tx)} 47) scale({s:.6f} {-s:.6f})" fill="currentColor">{inner}</g></svg>')
open('/tmp/claude-0/-home-user/46a28097-9136-5448-9a55-0ea1cd91f980/scratchpad/logo-inline.svg', 'w').write(inline_logo())
