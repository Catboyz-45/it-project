#!/usr/bin/env python3
"""
sonar_report.py
สร้างรายงาน PDF สรุปผลการสแกนจาก SonarQube (Community Edition)
โดยดึงข้อมูลผ่าน Web API ของ SonarQube แล้วนำมาจัดรูปแบบเป็นไฟล์ PDF

การใช้งาน:
    python3 scripts/sonar_report.py --host http://localhost:9000 --project nestly --token <YOUR_TOKEN>

เก็บรายการ issue ทั้งหมดเป็นไฟล์ JSON แยกหน้าด้วย (issues_page1.json, issues_page2.json, ...)
รูปแบบเดียวกับผลของ GET /api/issues/search หน้าละ 200 รายการ:
    python3 scripts/sonar_report.py ... --issues-dir docs/sonarqube-history/run-62

ต้องติดตั้งไลบรารีก่อน:
    pip install requests reportlab
"""

import argparse
import json
import sys
from xml.sax.saxutils import escape
from datetime import datetime

import os

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
)

# ---------------------------------------------------------------------------
# ค่าคงที่ / mapping สำหรับแสดงผล
# ---------------------------------------------------------------------------

METRIC_KEYS = [
    "bugs",
    "vulnerabilities",
    "security_hotspots",
    "code_smells",
    "coverage",
    "duplicated_lines_density",
    "ncloc",
    "reliability_rating",
    "security_rating",
    "sqale_rating",
    "security_review_rating",
    "security_hotspots_reviewed",
    # SonarQube รุ่นใหม่โหมด MQR แสดง rating บนหน้าเว็บจากชุดนี้ ไม่ใช่จากชุดเดิมข้างบน
    "software_quality_security_rating",
    "software_quality_reliability_rating",
    "software_quality_maintainability_rating",
    "alert_status",
]

RATING_LABEL = {"1.0": "A", "2.0": "B", "3.0": "C", "4.0": "D", "5.0": "E"}

METRIC_TH_LABEL = {
    "bugs": "Bugs",
    "vulnerabilities": "Vulnerabilities",
    "security_hotspots": "Security Hotspots",
    "code_smells": "Code Smells",
    "coverage": "Test Coverage (%)",
    "duplicated_lines_density": "Duplicated Lines (%)",
    "ncloc": "Lines of Code",
    "reliability_rating": "Reliability Rating",
    "security_rating": "Security Rating",
    "sqale_rating": "Maintainability Rating",
    "security_review_rating": "Security Review Rating (Hotspots)",
    "security_hotspots_reviewed": "Security Hotspots Reviewed (%)",
    "software_quality_security_rating": "Security Rating (MQR)",
    "software_quality_reliability_rating": "Reliability Rating (MQR)",
    "software_quality_maintainability_rating": "Maintainability Rating (MQR)",
}

SEVERITY_ORDER = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"]

# ฟอนต์เริ่มต้นของ ReportLab (Helvetica) ไม่มีตัวอักษรไทย ข้อความไทยจะกลายเป็น ■■■
# จึงต้องหาไฟล์ฟอนต์ที่มีสระ/วรรณยุกต์ไทยจากเครื่องที่รันมาลงทะเบียนก่อน
THAI_FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Sathu.ttf",       # macOS
    "/System/Library/Fonts/Supplemental/Ayuthaya.ttf",    # macOS
    "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",  # Debian/Ubuntu
    "/usr/share/fonts/truetype/tlwg/Garuda.ttf",          # Thai Linux Working Group
    "C:/Windows/Fonts/tahoma.ttf",                        # Windows
]


def register_thai_font():
    """ลงทะเบียนฟอนต์ไทยตัวแรกที่หาเจอ คืนชื่อฟอนต์ที่ใช้ได้จริง"""
    for path in THAI_FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("ThaiFont", path))
                return "ThaiFont"
            except Exception:
                continue
    print(
        "คำเตือน: ไม่พบฟอนต์ภาษาไทยในเครื่อง ข้อความไทยในรายงานจะแสดงเป็นกล่องสี่เหลี่ยม",
        file=sys.stderr,
    )
    return "Helvetica"


# ---------------------------------------------------------------------------
# ฟังก์ชันเรียก SonarQube API
# ---------------------------------------------------------------------------

def fetch_measures(host, token, project_key):
    """ดึงค่าตัวชี้วัดสรุป (measures) ของโปรเจกต์"""
    url = f"{host}/api/measures/component"
    params = {
        "component": project_key,
        "metricKeys": ",".join(METRIC_KEYS),
    }
    resp = requests.get(url, params=params, auth=(token, ""))
    resp.raise_for_status()
    data = resp.json()
    measures = {m["metric"]: m.get("value", "-") for m in data["component"]["measures"]}
    return measures, data["component"].get("name", project_key)


def fetch_issues_by_severity(host, token, project_key):
    """ดึงจำนวน issues แยกตาม severity"""
    counts = {}
    for sev in SEVERITY_ORDER:
        url = f"{host}/api/issues/search"
        params = {
            "componentKeys": project_key,
            "severities": sev,
            # นับเฉพาะ issue ที่ยังเปิดอยู่ ไม่งั้น issue ที่แก้ไปแล้วจะถูกนับรวมด้วย
            "resolved": "false",
            "ps": 1,  # ไม่ต้องดึงรายละเอียดทั้งหมด เอาแค่ total
        }
        resp = requests.get(url, params=params, auth=(token, ""))
        resp.raise_for_status()
        counts[sev] = resp.json().get("total", 0)
    return counts


def fetch_top_issues(host, token, project_key, limit=15):
    """ดึงรายการ issues ที่ severity สูงสุดมาแสดงเป็นตัวอย่าง"""
    url = f"{host}/api/issues/search"
    params = {
        "componentKeys": project_key,
        "resolved": "false",
        "ps": limit,
        "s": "SEVERITY",
        "asc": "false",
    }
    resp = requests.get(url, params=params, auth=(token, ""))
    resp.raise_for_status()
    return resp.json().get("issues", [])


ISSUES_PAGE_SIZE = 200  # เพดานของ API ต่อหนึ่งหน้า


def export_issue_pages(host, token, project_key, out_dir):
    """เก็บ issue ที่ยังเปิดอยู่ทั้งหมดเป็นไฟล์ JSON หน้าละไฟล์ คืนรายชื่อไฟล์ที่สร้าง

    เก็บคำตอบของ API ไว้ทั้งก้อนโดยไม่แก้อะไร จะได้เทียบกับไฟล์ตัวอย่างและรอบก่อน ๆ ได้ตรงกัน
    """
    os.makedirs(out_dir, exist_ok=True)
    url = f"{host}/api/issues/search"
    written = []
    page = 1
    while True:
        params = {
            "componentKeys": project_key,
            "resolved": "false",
            "ps": ISSUES_PAGE_SIZE,
            "p": page,
        }
        resp = requests.get(url, params=params, auth=(token, ""))
        resp.raise_for_status()
        data = resp.json()
        path = os.path.join(out_dir, f"issues_page{page}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        written.append(path)
        total = data.get("paging", {}).get("total", data.get("total", 0))
        # หยุดเมื่อครบทุกรายการแล้ว ไม่มี issue เลยก็ยังเก็บหน้า 1 ไว้เป็นหลักฐานว่าว่าง
        if page * ISSUES_PAGE_SIZE >= total:
            return written, total
        page += 1


# ---------------------------------------------------------------------------
# ฟังก์ชันสร้าง PDF
# ---------------------------------------------------------------------------

def rating_text(value):
    return RATING_LABEL.get(str(value), str(value))


def build_pdf(output_path, project_name, project_key, host, measures, sev_counts, top_issues):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
    )
    font = register_thai_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleTH", parent=styles["Title"], fontSize=20, fontName=font)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6, fontName=font)
    normal = ParagraphStyle("NormalTH", parent=styles["Normal"], fontName=font)
    heading3 = ParagraphStyle("Heading3TH", parent=styles["Heading3"], fontName=font)
    # ช่องในตารางที่ข้อความยาว ต้องใช้ Paragraph เพื่อให้ตัดบรรทัดเองไม่ล้นออกนอกเซลล์
    cell = ParagraphStyle("Cell", parent=normal, fontSize=8, leading=10)

    elements = []

    # --- หน้าปก / หัวรายงาน ---
    elements.append(Paragraph("SonarQube Analysis Report", title_style))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph(f"Project: {project_name} ({project_key})", heading3))
    elements.append(Paragraph(f"Server: {host}", normal))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal))
    elements.append(Spacer(1, 0.5 * cm))

    # --- Quality Gate ---
    gate_status = measures.get("alert_status", "N/A")
    gate_color = colors.HexColor("#2e7d32") if gate_status == "OK" else colors.HexColor("#c62828")
    gate_labels = {"OK": "PASSED", "ERROR": "FAILED"}
    gate_label = gate_labels.get(gate_status, gate_status)
    gate_table = Table([[f"Quality Gate: {gate_label}"]], colWidths=[17 * cm])
    gate_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), gate_color),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 14),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(gate_table)
    elements.append(Spacer(1, 0.6 * cm))

    # --- ตารางตัวชี้วัดหลัก ---
    elements.append(Paragraph("สรุปตัวชี้วัดหลัก (Key Metrics)", h2_style))
    metric_rows = [["ตัวชี้วัด", "ค่า"]]
    for key in ["bugs", "vulnerabilities", "security_hotspots", "code_smells",
                "coverage", "duplicated_lines_density", "ncloc", "security_hotspots_reviewed"]:
        label = METRIC_TH_LABEL.get(key, key)
        value = measures.get(key, "-")
        metric_rows.append([label, str(value)])
    for key in ["software_quality_security_rating", "software_quality_reliability_rating",
                "software_quality_maintainability_rating", "security_review_rating",
                "reliability_rating", "security_rating", "sqale_rating"]:
        label = METRIC_TH_LABEL.get(key, key)
        value = rating_text(measures.get(key, "-"))
        metric_rows.append([label, value])

    metric_table = Table(metric_rows, colWidths=[10 * cm, 7 * cm])
    metric_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b3e99")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(metric_table)
    elements.append(Spacer(1, 0.6 * cm))

    # --- ตาราง Issues แยกตาม Severity ---
    elements.append(Paragraph("จำนวน Issues แยกตาม Severity", h2_style))
    sev_rows = [["Severity", "จำนวน"]]
    for sev in SEVERITY_ORDER:
        sev_rows.append([sev, str(sev_counts.get(sev, 0))])
    sev_table = Table(sev_rows, colWidths=[10 * cm, 7 * cm])
    sev_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b3e99")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(sev_table)
    elements.append(Spacer(1, 0.6 * cm))

    # --- ตัวอย่าง Issues ---
    elements.append(PageBreak())
    elements.append(Paragraph(f"ตัวอย่าง Issues (Top {len(top_issues)} เรียงตาม Severity)", h2_style))
    issue_rows = [["Severity", "Type", "File", "Message"]]
    for issue in top_issues:
        component = issue.get("component", "").split(":")[-1]
        issue_rows.append([
            issue.get("severity", "-"),
            issue.get("type", "-"),
            # Paragraph อ่านข้อความเป็น markup ข้อความ issue ที่มี < หรือ & จึงต้อง escape ก่อน
            Paragraph(escape(component), cell),
            Paragraph(escape(issue.get("message", "")), cell),
        ])
    issue_table = Table(issue_rows, colWidths=[2.2 * cm, 2.5 * cm, 5 * cm, 7.3 * cm])
    issue_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b3e99")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(issue_table)
    elements.append(Spacer(1, 0.4 * cm))
    elements.append(Paragraph(
        "หมายเหตุ: รายงานนี้สร้างจาก SonarQube Web API เพื่อวัตถุประสงค์ทางการศึกษา "
        "ดูรายละเอียดฉบับสมบูรณ์และคำแนะนำการแก้ไขได้ที่หน้า Dashboard บนเว็บ SonarQube",
        ParagraphStyle("note", parent=normal, fontSize=8, textColor=colors.grey),
    ))

    doc.build(elements)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    # console ของ Windows ใช้ cp1252 เป็นค่าเริ่มต้น พิมพ์ข้อความไทยแล้วพัง จึงบังคับเป็น UTF-8
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="สร้างรายงาน PDF จากผลสแกน SonarQube")
    parser.add_argument("--host", required=True, help="URL ของ SonarQube เช่น http://localhost:9000")
    parser.add_argument("--project", required=True, help="Project Key เช่น nestly")
    parser.add_argument("--token", required=True, help="SonarQube Analysis/User Token")
    parser.add_argument("--output", default=None, help="ชื่อไฟล์ PDF ผลลัพธ์ (default: <project>_report.pdf)")
    parser.add_argument("--top", type=int, default=15, help="จำนวนตัวอย่าง issues ที่จะแสดง (default 15)")
    parser.add_argument("--issues-dir", default=None, help="โฟลเดอร์ที่จะเก็บ issues_page1.json, issues_page2.json, ...")
    args = parser.parse_args()

    host = args.host.rstrip("/")
    output = args.output or f"{args.project}_report.pdf"

    try:
        print("กำลังดึงข้อมูล measures ...")
        measures, project_name = fetch_measures(host, args.token, args.project)

        print("กำลังดึงข้อมูล issues แยกตาม severity ...")
        sev_counts = fetch_issues_by_severity(host, args.token, args.project)

        print(f"กำลังดึงตัวอย่าง issues (top {args.top}) ...")
        top_issues = fetch_top_issues(host, args.token, args.project, args.top)

        print(f"กำลังสร้างไฟล์ PDF: {output}")
        build_pdf(output, project_name, args.project, host, measures, sev_counts, top_issues)

        print(f"เสร็จสิ้น! สร้างรายงานที่ {output}")

        if args.issues_dir:
            print(f"กำลังเก็บ issue แยกหน้าลง {args.issues_dir} ...")
            files, total = export_issue_pages(host, args.token, args.project, args.issues_dir)
            print(f"เก็บ issue {total} รายการ เป็น {len(files)} หน้า: {', '.join(os.path.basename(f) for f in files)}")

    except requests.exceptions.HTTPError as e:
        print(f"เกิดข้อผิดพลาดในการเรียก API: {e}", file=sys.stderr)
        print("ตรวจสอบว่า Token ถูกต้อง และ Project Key มีอยู่จริง", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"ไม่สามารถเชื่อมต่อไปยัง {host} ได้ ตรวจสอบว่า SonarQube กำลังรันอยู่", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
