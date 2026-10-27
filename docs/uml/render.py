"""Render .drawio files to PNG (3x) with the draw.io viewer in headless Chrome.

Usage:  <venv>/bin/python render.py drawio/SD-1_Login.drawio [more.drawio ...]
Output: png/<name>.png
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SCALE = 3
PAD = 20  # px (before scaling) of white border kept around the diagram

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,700;1,400&display=block" rel="stylesheet">
<style>html,body{{margin:0;background:#fff}} .mxgraph{{padding:{pad}px}}</style></head><body>
<div class="mxgraph" data-mxgraph="{cfg}"></div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body></html>"""


def extent(xml):
    pts = re.findall(r'<mxGeometry(?=[^>]*width)(?:[^>]*?x="([-\d.]+)")?(?:[^>]*?y="([-\d.]+)")?'
                     r'[^>]*?width="([\d.]+)"[^>]*?height="([\d.]+)"', xml)
    w = max(float(x or 0) + float(wd) for x, _, wd, _ in pts)
    h = max(float(y or 0) + float(ht) for _, y, _, ht in pts)
    return int(w), int(h)


def render(src):
    src = Path(src)
    xml = src.read_text(encoding="utf-8")
    w, h = extent(xml)
    cfg = json.dumps({"xml": xml, "toolbar": "", "lightbox": False, "nav": False,
                      "resize": False, "border": 0})
    with tempfile.TemporaryDirectory() as td:
        page = Path(td) / "page.html"
        page.write_text(PAGE.format(pad=PAD, cfg=html.escape(cfg, quote=True)), encoding="utf-8")
        shot = Path(td) / "shot.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        f"--force-device-scale-factor={SCALE}",
                        f"--window-size={w + 2 * PAD + 200},{h + 2 * PAD + 200}",
                        "--virtual-time-budget=15000", f"--screenshot={shot}", page.as_uri()],
                       check=True, capture_output=True)
        img = Image.open(shot).convert("RGB")
    bg = Image.new("RGB", img.size, (255, 255, 255))
    box = ImageChops.difference(img, bg).getbbox()
    if not box:
        raise SystemExit(f"{src.name}: nothing rendered")
    p = PAD * SCALE
    box = (max(box[0] - p, 0), max(box[1] - p, 0), min(box[2] + p, img.width), min(box[3] + p, img.height))
    out = HERE / "png" / (src.stem + ".png")
    img.crop(box).save(out, optimize=True)
    print(f"{out.name}: {box[2] - box[0]}x{box[3] - box[1]}")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        render(f)
