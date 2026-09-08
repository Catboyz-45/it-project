/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “document styles”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “selector” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - scope: ค่า “scope” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function selector(scope: string, value: string) {
  const prefix = scope.trim();
  return value
    .split(",")
    .map((item) => `${prefix ? `${prefix} ` : ""}${item.trim()}`)
    .join(",");
}

/**
 * The single source of truth for document content styling.
 * It is used by both the on-screen A4 editor and the generated PDF.
 */
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Document Content Css” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - scope: ค่า “scope” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function getDocumentContentCss(scope = "") {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “rule” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - selectors: ค่า “selectors” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - declarations: ค่า “declarations” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const rule = (selectors: string, declarations: string) =>
    `${selector(scope, selectors)}{${declarations}}`;

  return [
    rule(".document", "width:100%"),
    rule("h1,h2,h3,p", "margin-top:0"),
    rule("h1", "font-size:28px;line-height:1.2"),
    rule("h2", "font-size:22px;line-height:1.25"),
    rule("h3", "font-size:18px;line-height:1.3"),
    rule(".document-title", "font-size:24px;line-height:1.3;margin-bottom:24px;text-align:center"),
    rule(".document-row", "display:flex;gap:24px;justify-content:space-between;margin:8px 0"),
    rule(".document-label", "color:#555"),
    rule(".document-value", "font-weight:700"),
    rule(".document-total", "border-top:2px solid #222;font-size:18px;font-weight:700;margin-top:16px;padding-top:12px"),
    rule(".signature-grid", "display:grid;gap:48px;grid-template-columns:1fr 1fr;margin-top:64px"),
    rule(".signature-line", "border-top:1px solid #555;padding-top:8px;text-align:center"),
    rule(".text-left", "text-align:left"),
    rule(".text-center", "text-align:center"),
    rule(".text-right", "text-align:right"),
    rule(".text-red", "color:#b42318"),
    rule(".text-blue", "color:#175cd3"),
    rule(".text-green", "color:#067647"),
    rule(".text-muted", "color:#667085"),
    rule(".text-sm", "font-size:12px"),
    rule(".text-base", "font-size:14px"),
    rule(".text-lg", "font-size:18px"),
    rule(".text-xl", "font-size:24px"),
    rule(".document-image", "display:block;height:auto;margin:12px auto;max-width:100%"),
    rule(".page-break", "break-before:page"),
    rule("hr", "border:0;border-top:1px solid #bbb;margin:16px 0"),
    rule("table", "border-collapse:collapse;margin:14px 0;width:100%"),
    rule("th,td", "border:1px solid #bbb;padding:8px;vertical-align:top"),
    rule("ul,ol", "padding-left:24px"),
  ].join("");
}
