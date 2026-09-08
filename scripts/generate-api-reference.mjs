/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: สร้างสารบัญ API ภาษาไทยจากไฟล์ route จริง เพื่อลดปัญหาเอกสารไม่ตรงกับโค้ด
 * การทำงาน: อ่านไฟล์ route.ts ทุกชั้นใต้ app/api, ตรวจ HTTP method, จัดหมวดหมู่ และเขียนผลไปที่ docs/API_ENDPOINTS_TH.md
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const apiRoot = path.join(root, "app", "api");
const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find Routes” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - directory: ค่า “directory” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function findRoutes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findRoutes(absolutePath));
    else if (entry.name === "route.ts") files.push(absolutePath);
  }
  return files;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “endpoint From Path” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - absolutePath: ค่า “absolute Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function endpointFromPath(absolutePath) {
  return `/${path.relative(path.join(root, "app"), path.dirname(absolutePath)).split(path.sep).join("/")}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “category For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - endpoint: ค่า “endpoint” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function categoryFor(endpoint) {
  if (endpoint.startsWith("/api/v1/super-admin/")) return "Super Admin — ดูแลแพลตฟอร์ม";
  if (endpoint.startsWith("/api/v1/admin/")) return "Owner/Admin — ดูแลหอพัก";
  if (endpoint.startsWith("/api/v1/tenant/")) return "Tenant — ผู้เช่า";
  if (endpoint.startsWith("/api/v1/chat/")) return "แชทเวอร์ชันหลัก";
  if (endpoint.startsWith("/api/auth/")) return "เข้าสู่ระบบและบัญชี";
  if (endpoint.startsWith("/api/account/")) return "บัญชีผู้ใช้ส่วนกลาง";
  if (endpoint.startsWith("/api/chat/")) return "แชทเดิม/เส้นทางรองรับย้อนหลัง";
  if (endpoint.startsWith("/api/document")) return "เอกสาร";
  if (endpoint.startsWith("/api/internal/")) return "งานภายในระบบ";
  if (endpoint === "/api/health") return "ตรวจสุขภาพระบบ";
  return "API ส่วนกลางและเส้นทางรองรับย้อนหลัง";
}

const purposeWords = new Map([
  ["dashboard", "ข้อมูลสรุปแดชบอร์ด"], ["users", "บัญชีผู้ใช้"], ["properties", "หอพัก"],
  ["plans", "แพ็กเกจ SaaS"], ["subscription-payments", "หลักฐานชำระค่าสมาชิก"],
  ["subscription-orders", "คำสั่งซื้อสมาชิก"], ["subscription", "สถานะสมาชิก"],
  ["audit-logs", "ประวัติการทำงานของระบบ"], ["invitations", "คำเชิญผู้เช่า"],
  ["tenants", "ผู้เช่า"], ["rooms", "ห้องพัก"], ["buildings", "อาคารและชั้น"],
  ["leases", "สัญญาเช่า"], ["invoices", "บิล"], ["payments", "การชำระเงิน"],
  ["meter-readings", "เลขมิเตอร์"], ["parcels", "พัสดุ"], ["tickets", "งานแจ้งเรื่อง"],
  ["announcements", "ประกาศ"], ["documents", "เอกสาร"], ["document-templates", "แม่แบบเอกสาร"],
  ["conversations", "ห้องสนทนา"], ["messages", "ข้อความแชท"], ["attachments", "ไฟล์แนบ"],
  ["settings", "การตั้งค่าหอพัก"], ["notifications", "การแจ้งเตือน"], ["me", "ข้อมูลบัญชีปัจจุบัน"],
  ["profile", "ข้อมูลส่วนตัว"], ["password", "รหัสผ่าน"], ["health", "ความพร้อมของเซิร์ฟเวอร์และฐานข้อมูล"],
]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “purpose For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - endpoint: ค่า “endpoint” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function purposeFor(endpoint) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “segments” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - segment: ค่า “segment” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const segments = endpoint.split("/").filter(Boolean).filter((segment) => !segment.startsWith("[") && !["api", "v1", "admin", "tenant", "super-admin"].includes(segment));
  const known = segments.map((segment) => purposeWords.get(segment)).filter(Boolean);
  const subject = known.at(-1) ?? known.at(0) ?? segments.at(-1)?.replaceAll("-", " ") ?? "ข้อมูลระบบ";
  if (endpoint.endsWith("/export")) return `ส่งออก${subject}เป็นไฟล์`;
  if (endpoint.endsWith("/download")) return `ดาวน์โหลด${subject}`;
  if (endpoint.endsWith("/stream")) return "รับข้อความหรือสถานะแชทใหม่แบบต่อเนื่อง (stream)";
  if (endpoint.endsWith("/preview")) return "สร้างตัวอย่างเอกสารก่อนบันทึกจริง";
  if (endpoint.endsWith("/slip")) return "เปิดดูไฟล์สลิปที่มีสิทธิ์เข้าถึง";
  if (endpoint.endsWith("/approval")) return "อนุมัติหรือปฏิเสธบัญชี";
  if (endpoint.endsWith("/temporary-password")) return "ออกหรือเปลี่ยนรหัสผ่านชั่วคราว";
  if (endpoint.endsWith("/summary")) return `อ่านข้อมูลสรุป${subject}`;
  if (endpoint.endsWith("/accept")) return `ยืนยันรับ${subject}`;
  if (endpoint.endsWith("/login")) return "ตรวจอีเมล/รหัสผ่านและสร้าง session";
  if (endpoint.endsWith("/logout")) return "ยกเลิก session และออกจากระบบ";
  if (endpoint.endsWith("/forgot-password")) return "เริ่มขั้นตอนลืมรหัสผ่าน";
  if (endpoint.endsWith("/reset-password")) return "ตั้งรหัสผ่านใหม่ด้วย token แบบใช้ครั้งเดียว";
  if (endpoint.endsWith("/change-password")) return "เปลี่ยนรหัสผ่านของบัญชีที่เข้าสู่ระบบ";
  if (endpoint.endsWith("/maintenance")) return "เรียกงานบำรุงรักษาภายในด้วย secret ของระบบ";
  return `อ่านหรือจัดการ${subject}ตาม HTTP method และสิทธิ์ของผู้ใช้`;
}

const routeFiles = (await findRoutes(apiRoot)).sort();
const routes = [];
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “methods” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - left: ค่า “left” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - right: ค่า “right” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const methods = [...new Set([...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]))]
    .sort((left, right) => methodOrder.indexOf(left) - methodOrder.indexOf(right));
  routes.push({ endpoint: endpointFromPath(file), methods, category: categoryFor(endpointFromPath(file)), purpose: purposeFor(endpointFromPath(file)) });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “callable Operations” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - route: ค่า “route” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const callableOperations = routes.reduce((sum, route) => sum + route.methods.length, 0);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “categories” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - route: ค่า “route” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const categories = Map.groupBy(routes, (route) => route.category);
const generatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date());
const lines = [
  "# สารบัญ API ของ Nestly",
  "",
  "> ไฟล์นี้สร้างอัตโนมัติจากโค้ดด้วย `npm run docs:api` จึงไม่ควรแก้รายการ endpoint ด้วยมือ",
  "",
  `อัปเดตล่าสุด: ${generatedAt}`,
  "",
  "## สรุปแบบสั้น",
  "",
  `- มี URL API ทั้งหมด **${routes.length} เส้นทาง**`,
  `- เมื่อนับ HTTP method แยกกัน มีการทำงานที่เรียกได้ทั้งหมด **${callableOperations} รายการ**`,
  "- `[propertyId]`, `[invoiceId]` หรือข้อความในวงเล็บเหลี่ยมหมายถึงค่าที่เปลี่ยนไปตามรายการ เช่น ID ของหอหรือบิล",
  "- `GET` = อ่าน, `POST` = สร้าง/สั่งทำงาน, `PUT` = แทนค่าทั้งชุด, `PATCH` = แก้บางส่วน, `DELETE` = ลบหรือยกเลิก",
  "",
  "ทุก endpoint ที่มีข้อมูลส่วนตัวหรือเปลี่ยนข้อมูลต้องตรวจ session, role, สิทธิ์ในหอพัก และข้อมูลขาเข้าบนเซิร์ฟเวอร์ การซ่อนปุ่มในหน้าเว็บเพียงอย่างเดียวไม่ถือว่าเป็นการป้องกัน",
  "",
];

for (const [category, categoryRoutes] of categories) {
  lines.push(`## ${category}`, "", "| Method | URL | ใช้ทำอะไร |", "|---|---|---|");
  for (const route of categoryRoutes) {
    lines.push(`| ${route.methods.map((method) => `\`${method}\``).join(" ") || "—"} | \`${route.endpoint}\` | ${route.purpose} |`);
  }
  lines.push("");
}

lines.push(
  "## หมายเหตุสำหรับผู้พัฒนา",
  "",
  "- รายการนี้บอกขอบเขตและหน้าที่ระดับภาพรวม ส่วนรูปแบบ request/response ที่ใช้เป็นสัญญาทางเทคนิคอยู่ใน `docs/openapi.json` และไฟล์ validation ของแต่ละโมดูล",
  "- หากเพิ่ม ลบ หรือเปลี่ยน route ให้รัน `npm run docs:api` และ `npm run openapi:check` ก่อนส่งงาน",
  "- เส้นทางเก่าที่ไม่มี `/v1` ยังมีไว้เพื่อรองรับส่วนเดิมของระบบ ควรใช้ `/api/v1/...` สำหรับงานใหม่เมื่อมี endpoint เทียบเท่า",
  ""
);

await writeFile(path.join(root, "docs", "API_ENDPOINTS_TH.md"), `${lines.join("\n")}\n`, "utf8");
console.log(`สร้าง docs/API_ENDPOINTS_TH.md: ${routes.length} URL, ${callableOperations} method operations`);
