"""Add the methods that the new Sequence Diagrams call to the Class Diagrams.

Teacher's rule (บทที่ 10): every message in a Sequence Diagram must be a method
of a class in the Class Diagram — if it is missing, add it to the Class Diagram.
Run once; it is idempotent (skips methods already present).
"""
import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
LINE = 18

ADD = {
    "CD-1_Account_Platform.drawio": {
        "User": ["+ verifyPassword(password): Boolean"],
        "AuditLog": ["+ record(action, result): void"],
    },
    "CD-2_Property_Tenancy.drawio": {
        "Room": ["+ isReadyForBilling(month): Boolean"],
        "Lease": ["+ rentFor(month): Decimal"],
    },
    "CD-3_Billing_Payment.drawio": {
        "Invoice": ["+ submitPayment(slip): PaymentSubmission", "+ canAcceptPayment(): Boolean"],
    },
}


def cells(xml):
    return re.findall(r"<mxCell [^>]*?(?:/>|>.*?</mxCell>)", xml)


def attr(cell, name):
    m = re.search(rf'\b{name}="([^"]*)"', cell)
    return m.group(1) if m else None


def bump(cell, key, delta):
    return re.sub(rf'({key}=")([-\d.]+)(")', lambda m: f"{m.group(1)}{float(m.group(2)) + delta:g}{m.group(3)}",
                  cell, count=1)


def patch(path, classes):
    xml = path.read_text(encoding="utf-8")
    all_cells = cells(xml)
    for cname, methods in classes.items():
        cls = next(c for c in all_cells if attr(c, "value") == cname and "swimlane" in (attr(c, "style") or ""))
        cid = attr(cls, "id")
        kids = [c for c in all_cells if attr(c, "parent") == cid]
        text_kids = [k for k in kids if attr(k, "value")]
        has_methods = len(kids) >= 3
        if has_methods:
            mcell = text_kids[-1]
            inner = html.unescape(attr(mcell, "value"))
            new = [m for m in methods if m not in inner]
            if not new:
                continue
            inner2 = inner.replace("</div>", "".join(f"<br>{m}" for m in new) + "</div>", 1)
            mcell2 = mcell.replace(f'value="{attr(mcell, "value")}"', f'value="{html.escape(inner2, quote=True)}"', 1)
            mcell2 = bump(mcell2, "height", LINE * len(new))
            xml = xml.replace(mcell, mcell2)
            grow = LINE * len(new)
        else:
            # Class without an operations compartment: add divider + methods cell (copied from a sibling class).
            proto_div = next(c for c in all_cells if "line;strokeWidth" in (attr(c, "style") or ""))
            proto_m = next(c for c in all_cells if (attr(c, "value") or "").startswith("&lt;div") and "+ " in attr(c, "value"))
            attrs_cell = text_kids[-1]
            geo = re.search(r"<mxGeometry[^>]*>", attrs_cell).group(0)
            w = float(re.search(r'width="([\d.]+)"', geo).group(1))
            y0 = float(re.search(r' y="([\d.]+)"', geo).group(1)) + float(re.search(r'height="([\d.]+)"', geo).group(1))
            h = LINE * len(methods) + 8
            div = re.sub(r'id="[^"]+"', f'id="{cid}_div"', proto_div, count=1)
            div = re.sub(r'parent="[^"]+"', f'parent="{cid}"', div, count=1)
            div = re.sub(r"<mxGeometry[^>]*>", f'<mxGeometry y="{y0:g}" width="{w:g}" height="8" as="geometry"/>', div, count=1)
            div = div.replace('as="geometry"/>/>', 'as="geometry"/>')
            val = html.escape('<div style="line-height:18px">' + "<br>".join(methods) + "</div>", quote=True)
            mc = re.sub(r'id="[^"]+"', f'id="{cid}_ops"', proto_m, count=1)
            mc = re.sub(r'parent="[^"]+"', f'parent="{cid}"', mc, count=1)
            mc = re.sub(r'value="[^"]*"', f'value="{val}"', mc, count=1)
            mc = re.sub(r"<mxGeometry[^>]*?/?>", f'<mxGeometry y="{y0 + 8:g}" width="{w:g}" height="{h:g}" as="geometry"/>', mc, count=1)
            mc = re.sub(r"</mxGeometry>", "", mc)
            last = kids[-1]
            xml = xml.replace(last, last + div + mc)
            grow = 8 + h
        cls2 = bump(cls, "height", grow)
        xml = xml.replace(cls, cls2)
        all_cells = cells(xml)
        print(f"{path.name}: {cname} +{grow}px")
    path.write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    for fname, classes in ADD.items():
        patch(HERE / "drawio" / fname, classes)
