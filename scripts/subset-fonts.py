#!/usr/bin/env python3
"""Subset Noto Sans TC / Figtree to the characters the site uses. Writes site/fonts/*.woff2.

Usage: subset-fonts.py <dir-with-source-ttf>  (sources from github.com/google/fonts, OFL)
Rerun after adding data with new CJK characters; build.mjs reports how many are missing.
"""
import json, sys
from pathlib import Path
from fontTools import subset

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site/fonts"; OUT.mkdir(exist_ok=True)

text = set()
for f in list((ROOT / "site").glob("*.html")) + list((ROOT / "site").glob("*.js")) + [ROOT / "site/data.json"]:
    text |= set(f.read_text(encoding="utf-8"))
text |= set("０１２３４５６７８９，。、；：？！「」『』（）《》〈〉…—・·")
cjk = "".join(sorted(c for c in text if ord(c) > 0x2E7F))
basic = "".join(chr(c) for c in range(0x20, 0x250)) + "‘’“”–—•…€₩¥£→←↗✓×"
(OUT / "chars.txt").write_text(cjk, encoding="utf-8")

def run(src, dst, chars):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(str(src), opts)
    s = subset.Subsetter(opts)
    s.populate(text=chars)
    s.subset(font)
    subset.save_font(font, str(dst), opts)
    print(dst.name, f"{dst.stat().st_size / 1024:.0f} KB")

run(SRC / "NotoSansTC[wght].ttf", OUT / "NotoSansTC-subset.woff2", cjk + basic)
run(SRC / "Figtree[wght].ttf", OUT / "Figtree.woff2", basic)
run(SRC / "Figtree-Italic[wght].ttf", OUT / "Figtree-Italic.woff2", basic)
print(len(cjk), "CJK chars")
