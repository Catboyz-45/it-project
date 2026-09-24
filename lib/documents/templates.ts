import sanitizeHtml from "sanitize-html";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import type { DocumentData } from "@/lib/documents/placeholders";
import { placeholderLabels } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";

// ช่อง {{key}} ที่จะถูกแทนด้วยข้อมูลจริง ยอมให้มีช่องว่างข้างในได้ เพราะคนแก้ Template อาจพิมพ์เว้นวรรค
const placeholderPattern = /{{\s*([a-z][a-z0-9_]*)\s*}}/g;
// แยกกรณี " กับ ' ออกจากกันแทนการใช้ backreference และใช้ [^"] / [^'] แทน .*?
// เพราะแบบเดิม (["'])(.*?)\1 ทำให้ engine ต้องไล่ลองทุกตำแหน่งของเครื่องหมายคำพูด
// กลายเป็น O(n²): HTML 128KB ใช้เวลา 6 วินาที และ Template ที่ API รับได้ใหญ่ถึง 2MB
// ซึ่งพอจะบล็อก event loop ของ Node ทั้งเซิร์ฟเวอร์ได้จากคำขอเดียว
const embeddedImagePattern = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
const embeddedImageDataPattern = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)$/i;
// รูปฝังใน Template จำกัด 1 MB เพราะถูกเก็บเป็น base64 อยู่ในตัว HTML ไม่ใช่ไฟล์แยก
const maxEmbeddedImageBytes = 1_000_000;

// แปลงอักขระพิเศษก่อนใส่ลง HTML ป้องกัน XSS จากข้อมูลที่ผู้ใช้กรอก เช่นชื่อผู้เช่าที่มี <script>
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// จัดรูปแบบตามชนิดของช่อง ตัวเลขใส่ทศนิยมสองตำแหน่ง ส่วนช่องที่ลงท้าย _date แปลงเป็นวันที่แบบไทย
// +07:00 ตรึงเขตเวลาไทย เพราะข้อมูลที่ส่งมาเป็นแค่วันที่ ไม่มีเวลาติดมาด้วย
function formatValue(key: string, value: string | number) {
  if (typeof value === "number") return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (key.endsWith("_date")) return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${value}T00:00:00+07:00`));
  return value;
}

// เช็คไบต์แรก ๆ ของไฟล์ว่าตรงกับชนิดที่อ้างมาจริง ไม่เชื่อแค่ที่เขียนไว้ใน data URL
// กันคนเปลี่ยนแค่ข้อความหน้าไฟล์แล้วยัดอย่างอื่นเข้ามา
function hasValidImageSignature(type: string, bytes: Buffer) {
  if (type === "png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return type === "webp" && bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

// ตรวจรูปทุกรูปใน Template สามชั้น ต้องเป็น data URL ของชนิดที่อนุญาต ขนาดไม่เกิน และไบต์จริงตรงกับชนิด
export function validateEmbeddedImages(html: string) {
  for (const match of html.matchAll(embeddedImagePattern)) {
    // กลุ่มที่ 1 คือค่าที่อยู่ใน " ส่วนกลุ่มที่ 2 คือค่าที่อยู่ใน ' จะมีค่าแค่กลุ่มเดียวเสมอ
    const source = match[1] ?? match[2];
    const dataMatch = source.match(embeddedImageDataPattern);
    // ไม่รับ URL จากภายนอก เพราะการดึงรูปจาก URL ที่ผู้ใช้กำหนดเป็นช่องทาง SSRF
    if (!dataMatch) throw new Error("รองรับเฉพาะรูป PNG, JPEG หรือ WebP ที่อัปโหลดจากเครื่อง");
    const bytes = Buffer.from(dataMatch[2].replace(/\s/g, ""), "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > maxEmbeddedImageBytes) throw new Error("รูปภาพต้องมีขนาดไม่เกิน 1 MB");
    if (!hasValidImageSignature(dataMatch[1].toLowerCase(), bytes)) throw new Error("ข้อมูลรูปภาพไม่ตรงกับชนิดไฟล์");
  }
}

// ล้าง HTML ก่อนเก็บและก่อนแสดงผล เพราะ Template มาจากที่ผู้ใช้แก้เองได้
// ใช้วิธีระบุสิ่งที่อนุญาต ไม่ใช่ไล่ห้ามทีละอย่าง แท็กหรือแอตทริบิวต์ที่ไม่อยู่ในรายการจะถูกตัดทิ้งหมด
export function sanitizeTemplate(html: string) {
  validateEmbeddedImages(html);
  return sanitizeHtml(html, {
    // ไม่มี script iframe object หรือ form อยู่ในรายการ จึงใส่เข้ามาไม่ได้เลย
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
    // สไตล์จำกัดด้วย regex สีต้องเป็น #rrggbb ขนาดตัวอักษรต้องเป็นค่าที่กำหนดไว้เท่านั้น
    // กัน CSS ที่ใช้เล่นงานผู้ใช้ เช่น position ที่เอาไปวางทับปุ่มจริง
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{6}$/i],
        "background-color": [/^#[0-9a-f]{6}$/i],
        "font-family": [/^(Arial|Tahoma|Georgia|"Times New Roman"|'Times New Roman'|Times New Roman)$/],
        "font-size": [/^(10|11|12|14|16|18|20|22|24|28|32|36)px$/],
      },
    },
    // รูปรับได้เฉพาะ data URL ห้ามดึงจากเว็บภายนอก
    allowedSchemesByTag: { img: ["data"] },
    // discard คือตัดทั้งแท็กทิ้ง ไม่ใช่แปลงเป็นข้อความให้โผล่ในเอกสาร
    disallowedTagsMode: "discard",
  }).trim();
}

// หาช่อง {{...}} ที่ไม่รู้จัก คืนเป็นรายการ ไม่โยน error เพื่อให้หน้าจอบอกผู้ใช้ได้ว่าพิมพ์ชื่ออะไรผิด
export function validateTemplatePlaceholders(kind: DocumentKind, html: string) {
  const allowed = new Set(Object.keys(placeholderLabels[kind]));
  const unknown = Array.from(html.matchAll(placeholderPattern), (match) => match[1]).filter((key) => !allowed.has(key));
  return Array.from(new Set(unknown));
}

// แทนช่องด้วยข้อมูลจริง ล้าง HTML ซ้ำอีกรอบตรงนี้ ถึงจะล้างตอนบันทึกไปแล้ว
// เพราะข้อมูลในฐานอาจถูกเขียนมาจากทางอื่นที่ไม่ผ่านการล้าง
export function renderTemplate(kind: DocumentKind, html: string, data: DocumentData) {
  const sanitized = sanitizeTemplate(html);
  const unknown = validateTemplatePlaceholders(kind, sanitized);
  // เจอช่องที่ไม่รู้จักตอนสร้างจริงถือว่าผิดพลาด ดีกว่าปล่อยให้ {{...}} ไปโผล่ในเอกสารที่ส่งให้ผู้เช่า
  if (unknown.length > 0) throw new Error(`Unknown placeholders: ${unknown.join(", ")}`);

  return sanitized.replace(placeholderPattern, (_match, key: keyof DocumentData) => {
    const value = data[key];
    // escape ทุกค่าที่แทนเข้าไป ต่อให้ข้อมูลมาจากฐานของเราเองก็ไม่เชื่อ
    return value === undefined ? "" : escapeHtml(String(formatValue(String(key), value)));
  });
}

export function wrapPrintableHtml(body: string, title: string) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Thai",sans-serif;color:#171717;font-size:14px;line-height:1.65;margin:0}
    ${getDocumentContentCss()}
  </style></head><body>${body}</body></html>`;
}
