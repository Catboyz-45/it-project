/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “templates”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import sanitizeHtml from "sanitize-html";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import type { DocumentData } from "@/lib/documents/placeholders";
import { placeholderLabels } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";

const placeholderPattern = /{{\s*([a-z][a-z0-9_]*)\s*}}/g;
const embeddedImagePattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
const embeddedImageDataPattern = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)$/i;
const maxEmbeddedImageBytes = 1_000_000;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “escape Html” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Value” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function formatValue(key: string, value: string | number) {
  if (typeof value === "number") return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (key.endsWith("_date")) return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${value}T00:00:00+07:00`));
  return value;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “has Valid Image Signature” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - bytes: ค่า “bytes” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function hasValidImageSignature(type: string, bytes: Buffer) {
  if (type === "png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return type === "webp" && bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “validate Embedded Images” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - html: ค่า “html” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function validateEmbeddedImages(html: string) {
  for (const match of html.matchAll(embeddedImagePattern)) {
    const source = match[2];
    const dataMatch = source.match(embeddedImageDataPattern);
    if (!dataMatch) throw new Error("รองรับเฉพาะรูป PNG, JPEG หรือ WebP ที่อัปโหลดจากเครื่อง");
    const bytes = Buffer.from(dataMatch[2].replace(/\s/g, ""), "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > maxEmbeddedImageBytes) throw new Error("รูปภาพต้องมีขนาดไม่เกิน 1 MB");
    if (!hasValidImageSignature(dataMatch[1].toLowerCase(), bytes)) throw new Error("ข้อมูลรูปภาพไม่ตรงกับชนิดไฟล์");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “sanitize Template” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - html: ค่า “html” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function sanitizeTemplate(html: string) {
  validateEmbeddedImages(html);
  return sanitizeHtml(html, {
    allowedTags: ["article", "section", "header", "footer", "h1", "h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "hr", "img"],
    allowedAttributes: { "*": ["class", "style"], img: ["src", "alt", "width", "height"], ol: ["start"], table: ["cellpadding", "cellspacing"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedClasses: {
      "*": [
        "document", "document-header", "document-title", "document-section", "document-row",
        "document-label", "document-value", "document-total", "signature-grid", "signature-line",
        "text-left", "text-center", "text-right", "text-red", "text-blue", "text-green",
        "text-muted", "text-sm", "text-base", "text-lg", "text-xl", "document-image", "page-break",
      ],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{6}$/i],
        "background-color": [/^#[0-9a-f]{6}$/i],
        "font-family": [/^(Arial|Tahoma|Georgia|"Times New Roman"|'Times New Roman'|Times New Roman)$/],
        "font-size": [/^(10|11|12|14|16|18|20|22|24|28|32|36)px$/],
      },
    },
    allowedSchemesByTag: { img: ["data"] },
    disallowedTagsMode: "discard",
  }).trim();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “validate Template Placeholders” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - html: ค่า “html” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function validateTemplatePlaceholders(kind: DocumentKind, html: string) {
  const allowed = new Set(Object.keys(placeholderLabels[kind]));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “unknown” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const unknown = Array.from(html.matchAll(placeholderPattern), (match) => match[1]).filter((key) => !allowed.has(key));
  return Array.from(new Set(unknown));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างผลลัพธ์สำหรับแสดงส่วน “render Template” บนหน้าจอ
 * รับค่า:
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - html: ค่า “html” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - data: ข้อมูลที่ฟังก์ชันนำไปประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function renderTemplate(kind: DocumentKind, html: string, data: DocumentData) {
  const sanitized = sanitizeTemplate(html);
  const unknown = validateTemplatePlaceholders(kind, sanitized);
  if (unknown.length > 0) throw new Error(`Unknown placeholders: ${unknown.join(", ")}`);

  return sanitized.replace(placeholderPattern, (_match, key: keyof DocumentData) => {
    const value = data[key];
    return value === undefined ? "" : escapeHtml(String(formatValue(String(key), value)));
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “wrap Printable Html” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - title: ค่า “title” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function wrapPrintableHtml(body: string, title: string) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Thai",sans-serif;color:#171717;font-size:14px;line-height:1.65;margin:0}
    ${getDocumentContentCss()}
  </style></head><body>${body}</body></html>`;
}
