"""Build UML_Nestly.pdf from the draw.io PNG exports and usecases.json.

Usage:  <venv-with-pymupdf>/bin/python build.py
Needs Google Chrome (headless print) and the TH Sarabun New font.

Layout: no cover / no table of contents. Every page carries the student's
name and ID at the top-left and one heading saying which diagram it is.
Use Case descriptions follow the format from the course slides (บทที่ 8):
Use Case Title / Use Case Id / Primary Actor / Stakeholder Actor /
Main Flow / Exceptional Flow 1..n.
"""
import html
import json
import os
import re
import subprocess
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT_DIR = Path.home() / "Library/Fonts"
OUT_PDF = HERE / "UML_Nestly.pdf"

STUDENT = "นายณัฐภัทร ยืนยง"
STUDENT_ID = "6621655231"

# (kind, subtitle, png, orientation)
DIAGRAMS_UC = [
    ("Use Case Diagram", "ภาพรวมของระบบ", "UC-0_Overview", "portrait"),
    ("Use Case Diagram", "ผู้เช่า", "UC-1_Tenant", "portrait"),
    ("Use Case Diagram", "เจ้าของหอ", "UC-2_Owner", "portrait"),
    ("Use Case Diagram", "ผู้ดูแลแพลตฟอร์มและระบบตั้งเวลา", "UC-3_SuperAdmin", "portrait"),
]
DIAGRAMS_REST = [
    ("Class Diagram", "ส่วนบัญชีผู้ใช้ สิทธิ์ และแพ็กเกจ SaaS", "CD-1_Account_Platform", "landscape"),
    ("Class Diagram", "ส่วนโครงสร้างหอพัก ผู้เช่า และสัญญาเช่า", "CD-2_Property_Tenancy", "landscape"),
    ("Class Diagram", "ส่วนมิเตอร์ บิล และการชำระเงิน", "CD-3_Billing_Payment", "landscape"),
    ("Class Diagram", "ส่วนงานบริการและการสื่อสาร", "CD-4_Service_Communication", "landscape"),
    ("Sequence Diagram", "เข้าสู่ระบบ (UC-01)", "SD-1_Login", "landscape"),
    ("Sequence Diagram", "ส่งหลักฐานการชำระเงิน (UC-09)", "SD-2_Submit_Payment", "landscape"),
    ("Sequence Diagram", "ตรวจสอบหลักฐานการชำระเงิน (UC-24)", "SD-3_Review_Payment", "landscape"),
    ("Sequence Diagram", "สร้างและออกบิลประจำเดือน (UC-22 include UC-23)", "SD-4_Generate_Invoices", "landscape"),
    ("Activity Diagram", "การลงทะเบียนผู้เช่าและอนุมัติการเข้าพัก", "AD-1_Tenant_Onboarding", "portrait"),
    ("Activity Diagram", "การออกบิลและชำระเงินรายเดือน", "AD-2_Billing_Payment", "portrait"),
    ("Activity Diagram", "การแจ้งซ่อมและร้องเรียน", "AD-3_Service_Ticket", "portrait"),
    ("Activity Diagram", "การซื้อและต่ออายุแพ็กเกจ", "AD-4_Subscription_Renewal", "portrait"),
    ("State Diagram", "บิล (Invoice)", "ST-1_Invoice", "landscape"),
    ("State Diagram", "หลักฐานการชำระเงิน (PaymentSubmission)", "ST-2_PaymentSubmission", "landscape"),
    ("State Diagram", "งานแจ้งซ่อม/ร้องเรียน (ServiceTicket)", "ST-3_ServiceTicket", "landscape"),
    ("State Diagram", "สัญญาเช่า (Lease)", "ST-4_Lease", "landscape"),
    ("State Diagram", "การเข้าพัก (RoomOccupancy)", "ST-5_RoomOccupancy", "landscape"),
    ("State Diagram", "ห้องพัก (Room)", "ST-6_Room", "landscape"),
]

TENANT, OWNER, ADMIN = "ผู้เช่า", "เจ้าของหอ", "ผู้ดูแลแพลตฟอร์ม"


def stakeholder(num):
    """Stakeholder Actor: who is affected by the use case but does not drive it."""
    if num in (1, 2, 3, 30, 37):
        return "-"
    if num == 4:
        return "คู่สนทนาอีกฝ่าย (ผู้เช่า / เจ้าของหอ / ผู้ดูแลแพลตฟอร์ม)"
    if 5 <= num <= 13:
        return OWNER
    if num in (28, 29):
        return ADMIN
    if 14 <= num <= 27:
        return TENANT
    if 31 <= num <= 36:
        return OWNER
    return f"{OWNER}, {TENANT}"  # UC-38 Scheduler


THAI = re.compile(r"[฀-๿]")
CODE = re.compile(r"^\d+[a-z]?\.\s*")
# Lines in the old PDF that start a new exceptional case although they carry no "3a." code.
NEW_ITEM_LINES = {"เจ้าของหอยกเลิกคำเชิญได้ สถานะเป็น REVOKED"}


def join(prev, line):
    thai_join = THAI.match(prev[-1]) and THAI.match(line[0])
    return prev + ("" if thai_join else " ") + line


def items(text, split_on_colon=False):
    """Split a cell into items, re-joining lines the old PDF wrapped mid-sentence."""
    out = []
    for line in (l.strip() for l in text.split("\n")):
        if not line:
            continue
        new = bool(CODE.match(line)) or line in NEW_ITEM_LINES
        if split_on_colon and ":" in line and not out[-1:] == [] and not out[-1].endswith("และ"):
            new = True
        if out and not new:
            out[-1] = join(out[-1], line)
        else:
            out.append(line)
    return out


def load_usecases():
    tables = json.load(open(HERE / "usecases.json", encoding="utf-8"))
    summary, details = [], []
    for t in tables:
        if t[0][0] == "รหัส":
            summary += [[" ".join(items(c)) for c in row] for row in t[1:]]
            continue
        d = {row[0].split("\n")[0]: row[1] for row in t}
        uid = d["รหัส Use Case"].strip()
        exc = [] if d["ขั้นตอนทางเลือก"].strip() == "-" else [
            CODE.sub("", s) for s in items(d["ขั้นตอนทางเลือก"], split_on_colon=True)]
        details.append({
            "id": uid,
            "title": " ".join(items(d["ชื่อ Use Case"])),
            "primary": " ".join(items(d["Actor"])),
            "stake": stakeholder(int(uid.split("-")[1])),
            "main": items(d["ขั้นตอนหลัก"]),
            "exc": exc,
        })
    return summary, details


def esc(s):
    return html.escape(s)


def heading(kind, sub):
    return f'<h1><span class="kind">{esc(kind)}</span>{" : " + esc(sub) if sub else ""}</h1>'


def diagram_page(kind, sub, png, orient):
    return (f'<section class="pg {orient}">{heading(kind, sub)}'
            f'<div class="img"><img src="png/{png}.png" alt=""></div></section>')


def uc_table(u):
    main = "".join(f"<div>{esc(s)}</div>" for s in u["main"])
    rows = [
        f'<tr><td class="lbl">Use Case Title: <b>{esc(u["title"])}</b></td>'
        f'<td class="lbl id">Use Case Id: <b>{u["id"]}</b></td></tr>',
        f'<tr><td colspan="2" class="lbl">Primary Actor: <b>{esc(u["primary"])}</b></td></tr>',
        f'<tr><td colspan="2" class="lbl">Stakeholder Actor: <b>{esc(u["stake"])}</b></td></tr>',
        f'<tr><td colspan="2"><div class="h">Main Flow:</div>{main}</td></tr>',
    ]
    if u["exc"]:
        rows += [f'<tr><td colspan="2"><div class="h">Exceptional Flow {i}:</div>{esc(s)}</td></tr>'
                 for i, s in enumerate(u["exc"], 1)]
    else:
        rows.append('<tr><td colspan="2"><div class="h">Exceptional Flow:</div>-</td></tr>')
    return f'<table class="ucd">{"".join(rows)}</table>'


def build_html():
    summary, details = load_usecases()
    parts = [diagram_page(*d) for d in DIAGRAMS_UC]

    srows = "".join(
        f"<tr><td class='c'>{esc(r[0])}</td><td>{esc(r[1])}</td><td>{esc(r[2])}</td><td>{esc(r[3])}</td></tr>"
        for r in summary)
    parts.append(
        f'<section class="flow">{heading("ตารางสรุป Use Case", "")}'
        '<table class="sum"><thead><tr><th>Use Case Id</th><th>Use Case Title</th><th>Primary Actor</th>'
        f'<th>คำอธิบายโดยย่อ</th></tr></thead><tbody>{srows}</tbody></table></section>')
    parts.append(f'<section class="flow">{heading("ตารางอธิบาย Use Case", "UC-01 – UC-" + details[-1]["id"][-2:])}'
                 + "".join(uc_table(u) for u in details) + "</section>")

    parts += [diagram_page(*d) for d in DIAGRAMS_REST]

    css = (HERE / "style.css").read_text(encoding="utf-8").replace("{FONT_DIR}", FONT_DIR.as_uri())
    return (f'<!doctype html><html lang="th"><head><meta charset="utf-8">'
            f'<title>UML Nestly</title><style>{css}</style></head><body>{"".join(parts)}</body></html>')


def render(html_text):
    src = HERE / "_build.html"
    src.write_text(html_text, encoding="utf-8")
    tmp = HERE / "_build.pdf"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--allow-file-access-from-files", f"--print-to-pdf={tmp}", src.as_uri()],
                   check=True, capture_output=True)
    return tmp


def main():
    tmp = render(build_html())
    doc = pymupdf.open(tmp)
    font = pymupdf.Font(fontfile=str(FONT_DIR / "THSarabunNew.ttf"))
    bold = pymupdf.Font(fontfile=str(FONT_DIR / "THSarabunNew Bold.ttf"))
    for pno, page in enumerate(doc, 1):
        page.wrap_contents()
        r = page.rect
        tw = pymupdf.TextWriter(r, color=(0.2, 0.24, 0.3))
        tw.append((34, 26), STUDENT, font=bold, fontsize=13)
        tw.append((34 + bold.text_length(STUDENT, 13) + 10, 26), f"รหัสนิสิต {STUDENT_ID}", font=font, fontsize=13)
        num = str(pno)
        tw.append((r.width - 34 - font.text_length(num, 11), r.height - 18), num, font=font, fontsize=11)
        tw.write_text(page)
        page.draw_line((34, 32), (r.width - 34, 32), color=(0.84, 0.86, 0.89), width=0.6)
    doc.set_metadata({"title": "UML Diagrams — Nestly", "author": f"{STUDENT} {STUDENT_ID}",
                      "subject": "Use Case, Class, Sequence, Activity, State Diagram"})
    doc.save(OUT_PDF, garbage=4, deflate=True)
    doc.close()
    for f in ("_build.pdf", "_build.html"):
        os.remove(HERE / f)
    print("wrote", OUT_PDF, "pages:", pymupdf.open(OUT_PDF).page_count)


if __name__ == "__main__":
    main()
