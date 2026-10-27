"""Generate the Sequence Diagrams (.drawio) in the style taught in บทที่ 10.

- One diagram per Use Case.
- Lifelines are objects of classes in the Class Diagram, written ":ClassName" (underlined).
- Every message is a method of the receiving class in the Class Diagram.
- Conditions use guards "[condition]" and repetition uses "*[condition]" (no alt/loop frames).
"""
import html
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONT = "fontFamily=Sarabun;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DSarabun;"

GAP_X = 250      # distance between lifelines
STEP = 46        # vertical distance between messages
TOP = 20
HEAD = 56        # lifeline header height
ACT_W = 14       # activation bar width

FILL = {  # same colours as the Class Diagram packages
    "actor": ("#ffffff", "#1f2d3d"),
    "blue": ("#dae8fc", "#6c8ebf"),
    "green": ("#d5e8d4", "#82b366"),
    "orange": ("#ffe6cc", "#d79b00"),
    "yellow": ("#fff2cc", "#d6b656"),
}


def esc(s):
    return html.escape(s, quote=True)


class SD:
    def __init__(self, name, title, participants):
        self.name, self.title = name, title
        self.parts = participants          # [(key, label, colour)]
        self.x = {k: 100 + i * GAP_X for i, (k, _, _) in enumerate(participants)}
        self.steps = []
        self.n = 0
        self.created = {}

    # ---- message kinds -------------------------------------------------
    def call(self, src, dst, text, guard=None):
        self.n += 1
        label = f"{self.n}: " + (f"{guard} " if guard else "") + text
        self.steps.append(("call", src, dst, label))

    def self_call(self, p, text, guard=None):
        self.n += 1
        label = f"{self.n}: " + (f"{guard} " if guard else "") + text
        self.steps.append(("self", p, p, label))

    def create(self, src, dst, text="«create»", guard=None):
        self.n += 1
        label = f"{self.n}: " + (f"{guard} " if guard else "") + text
        self.steps.append(("create", src, dst, label))
        self.created[dst] = len(self.steps) - 1

    def ret(self, src, dst, text=""):
        self.steps.append(("ret", src, dst, text))

    # ---- layout --------------------------------------------------------
    def y_of(self, i):
        return TOP + HEAD + 75 + i * STEP

    def build(self):
        cells = []
        cid = iter(range(2, 10_000))
        bottom = self.y_of(len(self.steps)) + 30
        ids = {}

        # Lifelines
        for key, label, colour in self.parts:
            fill, stroke = FILL[colour]
            x = self.x[key]
            i = next(cid)
            ids[key] = i
            if colour == "actor":
                style = ("shape=umlLifeline;participant=umlActor;perimeter=lifelinePerimeter;html=1;container=1;"
                         "dropTarget=0;collapsible=0;recursiveResize=0;verticalAlign=top;spacingTop=58;"
                         "labelBackgroundColor=#ffffff;outlineConnect=0;portConstraint=eastwest;size=56;fontSize=14;"
                         f"fontStyle=1;strokeWidth=1.3;fillColor={fill};strokeColor={stroke};{FONT}")
                w, y0 = 36, TOP
            else:
                style = ("shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;"
                         "dropTarget=0;collapsible=0;recursiveResize=0;outlineConnect=0;portConstraint=eastwest;"
                         f"size={HEAD};fontSize=14;fontStyle=5;strokeWidth=1.3;fillColor={fill};strokeColor={stroke};{FONT}")
                w = 160
                y0 = TOP
                if key in self.created:
                    y0 = self.y_of(self.created[key]) - HEAD // 2
            cells.append(f'<mxCell id="{i}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
                         f'<mxGeometry x="{x - w // 2}" y="{y0}" width="{w}" height="{bottom - y0}" as="geometry"/></mxCell>')

        # Activation bars: one bar per run of consecutive messages that involve the participant.
        actor = self.parts[0][0]
        for key, _, _ in self.parts:
            touch = [i for i, (_, a, b, _) in enumerate(self.steps) if key in (a, b)]
            if not touch:
                continue
            runs = [[touch[0], touch[0]]]
            for i in touch[1:]:
                if i == runs[-1][1] + 1 or key == actor:
                    runs[-1][1] = i
                else:
                    runs.append([i, i])
            fill, stroke = ("#ffffff", "#1f2d3d") if key == actor else FILL["green"]
            for lo, hi in runs:
                if key in self.created and lo == self.created[key]:
                    if lo == hi:
                        continue
                    y1 = self.y_of(lo) + HEAD // 2
                else:
                    y1 = self.y_of(lo) - 10
                y2 = self.y_of(hi) + 12
                cells.append(f'<mxCell id="{next(cid)}" value="" style="html=1;points=[];perimeter=orthogonalPerimeter;'
                             f'outlineConnect=0;strokeWidth=1.2;fillColor={fill};strokeColor={stroke};{FONT}" vertex="1" parent="1">'
                             f'<mxGeometry x="{self.x[key] - ACT_W // 2}" y="{y1}" width="{ACT_W}" height="{y2 - y1}" as="geometry"/></mxCell>')

        # Messages
        for i, (kind, a, b, label) in enumerate(self.steps):
            y = self.y_of(i)
            xa, xb = self.x[a], self.x[b]
            right = xb > xa
            if kind == "self":
                style = ("html=1;align=left;spacingLeft=6;verticalAlign=middle;endArrow=block;endFill=1;endSize=8;"
                         f"strokeWidth=1.2;fontSize=13;labelBackgroundColor=#ffffff;strokeColor=#1f2d3d;edgeStyle=orthogonalEdgeStyle;rounded=0;{FONT}")
                x0 = xa + ACT_W // 2
                cells.append(f'<mxCell id="{next(cid)}" value="{esc(label)}" style="{style}" edge="1" parent="1">'
                             f'<mxGeometry relative="1" as="geometry"><mxPoint x="{x0}" y="{y - 12}" as="sourcePoint"/>'
                             f'<mxPoint x="{x0}" y="{y + 12}" as="targetPoint"/><Array as="points">'
                             f'<mxPoint x="{x0 + 34}" y="{y - 12}"/><mxPoint x="{x0 + 34}" y="{y + 12}"/></Array>'
                             f'</mxGeometry></mxCell>')
                continue
            if kind == "ret":
                style = ("html=1;verticalAlign=bottom;endArrow=open;endSize=8;dashed=1;strokeWidth=1.1;fontSize=13;"
                         f"labelBackgroundColor=#ffffff;strokeColor=#55606c;fontColor=#33404d;{FONT}")
            elif kind == "create":
                style = ("html=1;verticalAlign=bottom;endArrow=open;endSize=8;dashed=1;strokeWidth=1.2;fontSize=13;"
                         f"labelBackgroundColor=#ffffff;strokeColor=#1f2d3d;{FONT}")
            else:
                style = ("html=1;verticalAlign=bottom;endArrow=block;endFill=1;endSize=8;strokeWidth=1.2;fontSize=13;"
                         f"labelBackgroundColor=#ffffff;strokeColor=#1f2d3d;{FONT}")
            sx = xa + (ACT_W // 2 if right else -ACT_W // 2)
            tx = xb - (ACT_W // 2 if right else -ACT_W // 2)
            if kind == "create":
                tx = xb - 80 if right else xb + 80
            cells.append(f'<mxCell id="{next(cid)}" value="{esc(label)}" style="{style}" edge="1" parent="1">'
                         f'<mxGeometry relative="1" as="geometry"><mxPoint x="{sx}" y="{y}" as="sourcePoint"/>'
                         f'<mxPoint x="{tx}" y="{y}" as="targetPoint"/></mxGeometry></mxCell>')

        body = "".join(cells)
        return (f'<mxfile host="drawio" type="device"><diagram id="{self.name}" name="{self.name}">'
                f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
                f'arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">'
                f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{body}</root></mxGraphModel></diagram></mxfile>')

    def save(self):
        (HERE / "drawio" / f"{self.name}.drawio").write_text(self.build(), encoding="utf-8")
        print("wrote", self.name)


def sd1():
    d = SD("SD-1_Login", "เข้าสู่ระบบ (UC-01)", [
        ("a", "ผู้ใช้งาน", "actor"), ("user", ":User", "blue"),
        ("log", ":AuditLog", "yellow"), ("session", ":Session", "blue")])
    d.call("a", "user", "login(email, password)")
    d.self_call("user", "verifyPassword(password)")
    d.call("user", "log", "record(LOGIN_FAILED)", "[ข้อมูลไม่ถูกต้อง]")
    d.ret("user", "a", "[ข้อมูลไม่ถูกต้อง] แจ้งข้อผิดพลาด")
    d.create("user", "session", "«create»", "[รหัสผ่านถูกต้อง และบัญชีอนุมัติแล้ว]")
    d.call("user", "log", "record(LOGIN_SUCCESS)")
    d.ret("user", "a", "session → เข้าหน้าหลักตามบทบาท")
    d.save()


def sd2():
    d = SD("SD-2_Submit_Payment", "ส่งหลักฐานการชำระเงิน (UC-09)", [
        ("a", "ผู้เช่า", "actor"), ("inv", ":Invoice", "orange"),
        ("log", ":AuditLog", "yellow"), ("ps", ":PaymentSubmission", "orange")])
    d.call("a", "inv", "submitPayment(slip)")
    d.self_call("inv", "canAcceptPayment()")
    d.ret("inv", "a", "[รับชำระไม่ได้] แจ้งข้อผิดพลาด")
    d.create("inv", "ps", "«create»(slip)", "[รับชำระได้]")
    d.call("inv", "log", "record(PAYMENT_SUBMIT)")
    d.ret("inv", "a", "ส่งแล้ว รอตรวจสอบ")
    d.save()


def sd3():
    d = SD("SD-3_Review_Payment", "ตรวจสอบหลักฐานการชำระเงิน (UC-24)", [
        ("a", "เจ้าของหอ", "actor"), ("ps", ":PaymentSubmission", "orange"),
        ("inv", ":Invoice", "orange"), ("log", ":AuditLog", "yellow")])
    d.call("a", "ps", "approve(reviewer)", "[สลิปถูกต้อง]")
    d.call("ps", "inv", "markPaid(at)")
    d.ret("inv", "ps", "บิล = PAID")
    d.call("ps", "log", "record(PAYMENT_APPROVE)")
    d.ret("ps", "a", "สลิป = APPROVED")
    d.call("a", "ps", "reject(reviewer, note)", "[สลิปไม่ถูกต้อง]")
    d.call("ps", "log", "record(PAYMENT_REJECT)")
    d.ret("ps", "a", "สลิป = REJECTED")
    d.save()


def sd4():
    d = SD("SD-4_Generate_Invoices", "สร้างและออกบิลประจำเดือน (UC-22, UC-23)", [
        ("a", "เจ้าของหอ", "actor"), ("room", ":Room", "green"),
        ("inv", ":Invoice", "orange"), ("lease", ":Lease", "orange"),
        ("meter", ":MeterReading", "green"), ("item", ":InvoiceItem", "orange")])
    d.call("a", "room", "isReadyForBilling(month)", "*[ทุกห้อง]")
    d.ret("room", "a", "ผลตรวจความพร้อม")
    d.create("a", "inv", "«create»(room, month)", "*[ห้องที่พร้อม]")
    d.call("inv", "lease", "rentFor(month)")
    d.ret("lease", "inv", "ค่าเช่า")
    d.call("inv", "meter", "amount()", "*[น้ำ, ไฟ]")
    d.ret("meter", "inv", "ค่าน้ำ / ค่าไฟ")
    d.create("inv", "item", "«create»(type, amount)", "*[ค่าเช่า, ค่าน้ำ, ค่าไฟ]")
    d.ret("inv", "a", "ร่างบิล (DRAFT)")
    d.call("a", "inv", "issue(version)", "[ตรวจร่างบิลแล้ว]")
    d.ret("inv", "a", "บิล = PENDING (รอชำระ)")
    d.save()


if __name__ == "__main__":
    sd1(); sd2(); sd3(); sd4()
