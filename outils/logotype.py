"""logotype.py: the house's name, « Belai’s Garden », written once in Pinyon Script (SIL OFL 1.1) and kept as an SVG path,
so the shop never asks a font server for it (owner, 2026-10-31: no request to Google, China and the GDPR).

The text is shaped by HarfBuzz (the script's joins and alternates), each glyph drawn as an outline, the whole set in one
path. The font itself is not kept in the repository; its licence allows the outlines to be used.

    python -m pip install --user fonttools uharfbuzz
    python outils/logotype.py <PinyonScript-Regular.ttf>   # writes public/squelette/logotype.svg
"""
import os
import sys

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

TEXT = 'Belai’s Garden'
HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'squelette')


def main(ttf):
    blob = hb.Blob.from_file_path(ttf)
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(TEXT)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True, 'calt': True})
    tt = TTFont(ttf)
    glyphs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    upm = tt['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        # y up in the font, down in SVG: flipped, then shifted by the advance
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        x += pos.x_advance
    d = pen.getCommands()
    # the ink's box, from the outlines themselves
    from fontTools.pens.boundsPen import BoundsPen
    bp = BoundsPen(glyphs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyphs[order[info.codepoint]].draw(TransformPen(bp, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        x += pos.x_advance
    x0, y0, x1, y1 = bp.bounds
    pad = upm * 0.02
    vb = f'{x0 - pad:.0f} {y0 - pad:.0f} {x1 - x0 + 2 * pad:.0f} {y1 - y0 + 2 * pad:.0f}'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{TEXT}">'
           f'<!-- Pinyon Script, SIL Open Font License 1.1, (c) The Pinyon Project Authors -->'
           f'<path fill="currentColor" d="{d}"/></svg>\n')
    out = os.path.join(HERE, 'logotype.svg')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(svg)
    print(out, len(svg), 'octets, viewBox', vb)


if __name__ == '__main__':
    main(sys.argv[1])
