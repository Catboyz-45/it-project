import { describe, expect, it } from "vitest";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import { renderTemplate, sanitizeTemplate, validateTemplatePlaceholders, wrapPrintableHtml } from "@/lib/documents/templates";

// ชื่อผู้เช่าตั้งใจใส่ script tag เข้าไป เพื่อพิสูจน์ว่าข้อมูลถูก escape ก่อนลง HTML
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
  // เคสสำคัญด้านความปลอดภัย ข้อมูลที่แทนลงช่อง {{...}} ต้องกลายเป็นข้อความ ไม่ใช่โค้ดที่รันได้
  it("escapes mapped values before inserting them into HTML", () => {
    const rendered = renderTemplate("contract", "<p>{{tenant_name}}</p>", contractData);
    expect(rendered).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered).not.toContain("<script>");
  });

  // script กับ onclick ต้องหายไปทั้งคู่ เพราะ Template มาจากที่ผู้ใช้แก้เองได้
  it("removes scripts and event handlers", () => {
    const sanitized = sanitizeTemplate('<p onclick="alert(1)">ข้อความ</p><script>alert(1)</script>');
    expect(sanitized).toBe("<p>ข้อความ</p>");
  });

  // สไตล์ที่อนุญาตต้องคงอยู่ ส่วน position กับค่าที่ผิดรูปแบบต้องถูกตัดทิ้ง
  // position ใช้วางทับปุ่มจริงเพื่อหลอกผู้ใช้ได้ จึงไม่อยู่ในรายการที่อนุญาต
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

  // ไบต์หัวไฟล์ต้องตรงกับชนิดที่อ้างทุกชนิด ไม่ใช่แค่ PNG
  it("accepts real JPEG and WebP images and rejects ones whose bytes do not match", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64");
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]).toString("base64");
    expect(sanitizeTemplate(`<img src="data:image/jpeg;base64,${jpeg}">`)).toContain("data:image/jpeg");
    expect(sanitizeTemplate(`<img src="data:image/webp;base64,${webp}">`)).toContain("data:image/webp");
    expect(() => sanitizeTemplate(`<img src="data:image/jpeg;base64,${webp}">`)).toThrow("ข้อมูลรูปภาพไม่ตรงกับชนิดไฟล์");
    expect(() => sanitizeTemplate(`<img src="data:image/webp;base64,${jpeg}">`)).toThrow("ข้อมูลรูปภาพไม่ตรงกับชนิดไฟล์");
  });

  it("rejects an empty or oversized embedded image", () => {
    expect(() => sanitizeTemplate('<img src="data:image/png;base64,">')).toThrow();
    const huge = Buffer.alloc(1_000_001, 1).toString("base64");
    expect(() => sanitizeTemplate(`<img src="data:image/png;base64,${huge}">`)).toThrow("รูปภาพต้องมีขนาดไม่เกิน 1 MB");
  });

  // ตอนสร้างเอกสารจริง ถ้าแม่แบบมีช่องที่ไม่รู้จักต้องหยุด ไม่ปล่อย {{...}} ไปโผล่ในเอกสารที่ส่งผู้เช่า
  it("refuses to render a template with an unknown placeholder and leaves missing values blank", () => {
    expect(() => renderTemplate("contract", "<p>{{tenant_password}}</p>", contractData)).toThrow("Unknown placeholders");
    const partial = { ...contractData, tenant_address: undefined } as unknown as typeof contractData;
    expect(renderTemplate("contract", "<p>[{{tenant_address}}]</p>", partial)).toBe("<p>[]</p>");
  });

  it("finds an embedded image regardless of which quote style wraps the source", () => {
    expect(() => sanitizeTemplate("<img src='https://example.com/a.png'>")).toThrow("รองรับเฉพาะรูป");
    expect(() => sanitizeTemplate('<img alt="x" src = "https://example.com/a.png" width="5">')).toThrow("รองรับเฉพาะรูป");
  });

  // Template ที่ผู้ใช้ส่งมามีได้ถึง 2MB ก่อนหน้านี้ตัวจับรูปเป็น O(n²) ทำให้ HTML ที่จงใจ
  // ใส่เครื่องหมายคำพูดจำนวนมากโดยไม่ปิดแท็ก บล็อก event loop ของทั้งเซิร์ฟเวอร์ได้
  it("scans a hostile template without super-linear slowdown", () => {
    const hostile = `<img src="${'"'.repeat(200_000)}`;
    const startedAt = performance.now();
    sanitizeTemplate(hostile);
    expect(performance.now() - startedAt).toBeLessThan(1000);
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
