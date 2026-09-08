/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “templates.test”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import { describe, expect, it } from "vitest";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import { renderTemplate, sanitizeTemplate, validateTemplatePlaceholders, wrapPrintableHtml } from "@/lib/documents/templates";

const contractData = {
  reference_id: "CONTRACT-1",
  property_name: "บ้านอยู่สบาย",
  room_number: "101",
  tenant_name: "<script>alert(1)</script>",
  tenant_phone: "0800000000",
  tenant_address: "นครปฐม",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  rent_amount: 3000,
  deposit_amount: 3000,
};

describe("document templates", () => {
  it("escapes mapped values before inserting them into HTML", () => {
    const rendered = renderTemplate("contract", "<p>{{tenant_name}}</p>", contractData);
    expect(rendered).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered).not.toContain("<script>");
  });

  it("removes scripts and event handlers", () => {
    const sanitized = sanitizeTemplate('<p onclick="alert(1)">ข้อความ</p><script>alert(1)</script>');
    expect(sanitized).toBe("<p>ข้อความ</p>");
  });

  it("keeps only allowlisted rich-text styles", () => {
    const sanitized = sanitizeTemplate('<p style="color:#175cd3;background-color:#fff2a8;font-size:18px;font-family:Tahoma;position:fixed">ข้อความ</p>');
    expect(sanitized).toContain("color:#175cd3");
    expect(sanitized).toContain("background-color:#fff2a8");
    expect(sanitized).toContain("font-size:18px");
    expect(sanitized).toContain("font-family:Tahoma");
    expect(sanitized).not.toContain("position");
    expect(sanitizeTemplate('<p style="font-size:999px;color:expression(alert(1))">ข้อความ</p>')).toBe("<p>ข้อความ</p>");
  });

  it("rejects remote images and files with forged image data", () => {
    expect(() => sanitizeTemplate('<img src="https://example.com/a.png">')).toThrow("รองรับเฉพาะรูป");
    expect(() => sanitizeTemplate('<img src="data:image/png;base64,dGV4dA==">')).toThrow("ข้อมูลรูปภาพไม่ตรงกับชนิดไฟล์");
  });

  it("keeps a validated embedded image and its safe presentation attributes", () => {
    const sanitized = sanitizeTemplate('<img class="document-image text-center" alt="โลโก้" width="120" onerror="alert(1)" src="data:image/png;base64,iVBORw0KGgo=">');
    expect(sanitized).toContain('class="document-image text-center"');
    expect(sanitized).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(sanitized).not.toContain("onerror");
  });

  it("rejects placeholders outside the kind allowlist", () => {
    expect(validateTemplatePlaceholders("invoice", "<p>{{tenant_name}} {{tenant_password}}</p>")).toEqual(["tenant_password"]);
  });

  it("uses the same document rules for the editor and printable output", () => {
    const editorCss = getDocumentContentCss(".document-editor-paper");
    const printableHtml = wrapPrintableHtml("<article></article>", "ตัวอย่าง");

    expect(editorCss).toContain(".document-editor-paper .signature-line{border-top:1px solid #555");
    expect(editorCss).toContain(".document-editor-paper .text-center{text-align:center}");
    expect(editorCss).toContain(".document-editor-paper table{border-collapse:collapse");
    expect(printableHtml).toContain(".signature-line{border-top:1px solid #555");
    expect(printableHtml).toContain(".text-center{text-align:center}");
    expect(printableHtml).toContain("table{border-collapse:collapse");
  });
});
