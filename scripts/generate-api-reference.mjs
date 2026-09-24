import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// สร้างสารบัญ API จากไฟล์ route จริง เอกสารจึงตามโค้ดเสมอ ไม่ต้องมานั่งแก้มือแล้วลืม
// รันด้วย npm run docs:api ผลออกที่ docs/API_ENDPOINTS_TH.md
const root = process.cwd();
const apiRoot = path.join(root, "app", "api");
// ลำดับที่อยากให้ method เรียงในตาราง ไม่ใช่เรียงตามตัวอักษร
const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// ไล่หาไฟล์ route.ts ทุกชั้นใต้ app/api เรียกตัวเองซ้ำลงไปในโฟลเดอร์ย่อย
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

// แปลงพาธไฟล์เป็น URL ตามกติกาของ App Router โฟลเดอร์คือส่วนของ URL ตรง ๆ
// แทน path.sep ด้วย / เพราะบน Windows ตัวคั่นเป็น backslash
function endpointFromPath(absolutePath) {
  return `/${path.relative(path.join(root, "app"), path.dirname(absolutePath)).split(path.sep).join("/")}`;
}

// จัดกลุ่มตามคำนำหน้าของ URL ไล่จากเฉพาะเจาะจงไปกว้าง อันแรกที่ตรงชนะ
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

// พจนานุกรมแปลชื่อส่วนของ URL เป็นคำไทย เพิ่ม endpoint ใหม่แล้วอย่าลืมมาเติมคำที่นี่
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

// เดาคำอธิบายจากชื่อ URL ตัดส่วนที่เป็นพารามิเตอร์และคำที่ไม่มีความหมายทิ้งก่อน
function purposeFor(endpoint) {
  const segments = endpoint.split("/").filter(Boolean).filter((segment) => !segment.startsWith("[") && !["api", "v1", "admin", "tenant", "super-admin"].includes(segment));
  // ใช้คำหลังสุดที่แปลได้ เพราะมักเป็นสิ่งที่ endpoint นั้นทำงานด้วยจริง ๆ
  const known = segments.map((segment) => purposeWords.get(segment)).filter(Boolean);
  const subject = known.at(-1) ?? known.at(0) ?? segments.at(-1)?.replaceAll("-", " ") ?? "ข้อมูลระบบ";
  // คำลงท้ายบางคำบอกความหมายชัดกว่าชื่อทรัพยากร จึงดักไว้เป็นกรณีพิเศษ
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
  // หา method จาก export ของแต่ละไฟล์ ใช้ Set ตัดตัวซ้ำ เผื่อมีทั้งแบบ function และ const
  const methods = [...new Set([...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]))]
    .sort((left, right) => methodOrder.indexOf(left) - methodOrder.indexOf(right));
  routes.push({ endpoint: endpointFromPath(file), methods, category: categoryFor(endpointFromPath(file)), purpose: purposeFor(endpointFromPath(file)) });
}

// นับรวมทุก method ไม่ใช่นับจำนวน URL เพราะ URL เดียวมีได้หลาย method
const callableOperations = routes.reduce((sum, route) => sum + route.methods.length, 0);
// Map.groupBy รักษาลำดับที่เจอครั้งแรกไว้ หัวข้อในเอกสารจึงเรียงคงที่ทุกครั้งที่รัน
const categories = Map.groupBy(routes, (route) => route.category);
const generatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date());
// ประกอบ Markdown ทีละบรรทัดใส่อาร์เรย์ แล้วค่อยต่อกันตอนท้าย อ่านง่ายกว่าต่อสตริงยาว ๆ
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
    const methods = route.methods.map((method) => `\`${method}\``).join(" ") || "—";
  lines.push(`| ${methods} | \`${route.endpoint}\` | ${route.purpose} |`);
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

// เขียนทับไฟล์เดิมทั้งใบ ไฟล์นี้สร้างจากโค้ด ห้ามแก้ด้วยมือ
await writeFile(path.join(root, "docs", "API_ENDPOINTS_TH.md"), `${lines.join("\n")}\n`, "utf8");
console.log(`สร้าง docs/API_ENDPOINTS_TH.md: ${routes.length} URL, ${callableOperations} method operations`);
