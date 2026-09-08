/**
 * ภาพรวมไฟล์: เครื่องมือสำหรับเติมคำอธิบายภาษาไทยไว้บนหัวไฟล์ซอร์สโค้ดของ Nestly
 * การทำงาน: ค้นหาเฉพาะไฟล์ที่ทีมดูแลเอง สร้างคำอธิบายตามตำแหน่งและชนิดไฟล์ และข้ามไฟล์ที่เคยเติมแล้ว
 * หมายเหตุ: ไม่แก้ generated code, migration เดิม, dependency, ไฟล์สื่อ และไฟล์ JSON ที่ห้ามมีคอมเมนต์
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const marker = "คำอธิบายสำหรับผู้เริ่มต้น";
const sourceRoots = [".github/workflows", "app", "components", "lib", "scripts", "tests", "types"];
const rootFiles = [
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.e2e.yml",
  "eslint.config.mjs",
  "next.config.ts",
  "playwright.config.ts",
  "postcss.config.mjs",
  "prisma.config.ts",
  "proxy.ts",
  "vitest.config.ts",
  "vitest.integration.config.ts",
  "prisma/schema.prisma",
];
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".prisma", ".yml", ".yaml", ".sh"]);
const skippedDirectories = new Set(["node_modules", ".next", "generated", "migrations", "coverage", "playwright-report", "test-results"]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “route From File” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function routeFromFile(relativePath) {
  return `/${relativePath
    .replace(/^app\//, "")
    .replace(/\/(page|layout|loading|error|not-found|route)\.(?:ts|tsx|js|jsx)$/, "")
    .replace(/\/route\.(?:ts|tsx|js|jsx)$/, "")}`.replace(/\/+/g, "/");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “readable Name” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function readableName(relativePath) {
  return path.basename(relativePath, path.extname(relativePath))
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “api Audience” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function apiAudience(relativePath) {
  if (relativePath.includes("/super-admin/")) return "ผู้ดูแลแพลตฟอร์ม (Super Admin)";
  if (relativePath.includes("/tenant/")) return "ผู้เช่า";
  if (relativePath.includes("/admin/properties/")) return "เจ้าของหอหรือผู้ดูแลหอ";
  if (relativePath.includes("/auth/")) return "การยืนยันตัวตนและบัญชีผู้ใช้";
  if (relativePath.includes("/internal/")) return "งานภายในของเซิร์ฟเวอร์";
  if (relativePath.includes("/chat/")) return "ระบบสนทนา";
  if (relativePath.includes("/documents")) return "ระบบเอกสาร";
  return "ส่วนกลางของระบบ";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “describe” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - content: ค่า “content” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function describe(relativePath, content) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  const name = readableName(normalized);

  if (normalized === "prisma/schema.prisma") {
    return [
      "เป็นพิมพ์เขียวฐานข้อมูลหลักของ Nestly ซึ่งกำหนดตาราง ฟิลด์ ความสัมพันธ์ ดัชนี และชนิดสถานะทั้งหมด",
      "Prisma อ่านไฟล์นี้เพื่อสร้างตัวช่วย TypeScript และ migration; เมื่อเปลี่ยนโครงสร้างต้องสร้าง migration ใหม่ ห้ามแก้ migration เก่าที่ใช้งานแล้ว",
    ];
  }
  if (normalized.endsWith("route.ts") && normalized.startsWith("app/api/")) {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “methods” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - match: ค่า “match” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const methods = [...content.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]);
    const endpoint = routeFromFile(normalized);
    return [
      `เป็น API ${methods.join(", ") || "HTTP"} ที่ URL ${endpoint} สำหรับ${apiAudience(normalized)}`,
      "รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน",
    ];
  }
  if (/^app\/.+\/(page|layout|loading|error|not-found)\.tsx$/.test(normalized) || /^app\/(page|layout|loading|error|not-found)\.tsx$/.test(normalized)) {
    const kind = normalized.includes("/layout.") || normalized === "app/layout.tsx" ? "โครงหน้าและส่วนที่ใช้ร่วมกัน" : normalized.includes("/loading.") ? "หน้าระหว่างรอข้อมูล" : normalized.includes("/error.") ? "หน้ารองรับข้อผิดพลาด" : normalized.includes("/not-found.") ? "หน้าเมื่อไม่พบข้อมูล" : "หน้าจอ";
    return [
      `เป็น${kind}ของเส้นทาง ${routeFromFile(normalized)} ใน Next.js App Router`,
      "ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล",
    ];
  }
  if (normalized === "app/globals.css") {
    return ["รวม design tokens และสไตล์ส่วนกลางที่ทุกหน้าของ Nestly ใช้ร่วมกัน", "กำหนดสี ระยะห่าง ฟอร์ม ตาราง modal responsive layout และ accessibility โดยคลาสเฉพาะหน้าควรอยู่ใกล้คอมโพเนนต์เมื่อทำได้"];
  }
  if (normalized.startsWith("components/")) {
    return [
      `เป็นคอมโพเนนต์หน้าจอ “${name}” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React`,
      "รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component",
    ];
  }
  if (normalized.startsWith("lib/domain/")) {
    return [`เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “${name}” โดยไม่ผูกกับหน้าจอ`, "ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้"];
  }
  if (normalized.startsWith("lib/repositories/")) {
    return [`เป็นชั้นเข้าถึงข้อมูลสำหรับ “${name}” เพื่อไม่ให้หน้าจอหรือ route ติดต่อฐานข้อมูลโดยตรง`, "รวมคำสั่งอ่านและเขียนข้อมูลไว้จุดเดียว เลือกเฉพาะฟิลด์ที่จำเป็น และเปิดทางให้ตรวจสิทธิ์/transaction ใน service ชั้นบน"];
  }
  if (normalized.startsWith("lib/server/")) {
    return [`เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “${name}” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ`, "ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component"];
  }
  if (normalized.startsWith("lib/client/")) {
    return [`เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “${name}” เช่น interaction การเรียก API หรือสถานะหน้าจอ`, "ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ"];
  }
  if (normalized.startsWith("lib/documents/")) {
    return [`ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “${name}”`, "รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้"];
  }
  if (normalized.startsWith("lib/")) {
    return [`เป็นโมดูลกลาง “${name}” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน`, "ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว"];
  }
  if (normalized.startsWith("tests/")) {
    return [`เป็นการทดสอบอัตโนมัติของ “${name}” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย`, "เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ"];
  }
  if (normalized.startsWith("types/")) {
    return [`รวม TypeScript type ของ “${name}” เพื่อบอกโครงสร้างข้อมูลที่ส่วนต่าง ๆ ต้องใช้ร่วมกัน`, "ไม่มีข้อมูลจริงอยู่ในไฟล์นี้ แต่ช่วยให้ compiler แจ้งเตือนเมื่อส่งข้อมูลผิดรูปแบบก่อนนำระบบไปรัน"];
  }
  if (normalized.startsWith("scripts/")) {
    return [`เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “${name}”`, "เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล"];
  }
  if (normalized.endsWith(".yml") || normalized.endsWith(".yaml") || normalized === "Dockerfile") {
    return [`เป็นไฟล์ตั้งค่าสภาพแวดล้อม “${name}” สำหรับ container หรือระบบอัตโนมัติ`, "ระบุบริการ ขั้นตอน build และค่าที่เชื่อมกัน โดยรับความลับจาก environment แทนการเขียนไว้ในไฟล์"];
  }
  if (normalized === ".env.example") {
    return ["เป็นรายการตัวแปรแวดล้อมตัวอย่างที่จำเป็นต่อการรัน Nestly โดยไม่มีรหัสลับจริง", "คัดลอกเป็นไฟล์ .env สำหรับเครื่องพัฒนาแล้วใส่ค่าของสภาพแวดล้อมนั้น; ห้าม commit ไฟล์ .env ที่มีข้อมูลจริง"];
  }
  return [`เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “${name}” ของโปรเจกต์ Nestly`, "กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง"];
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Comment” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - overview: ค่า “overview” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - flow: ค่า “flow” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function formatComment(relativePath, overview, flow) {
  const extension = path.extname(relativePath);
  if (extension === ".prisma") return `// ${marker}\n// ภาพรวมไฟล์: ${overview}\n// การทำงาน: ${flow}\n\n`;
  if ([".yml", ".yaml", ".sh"].includes(extension) || relativePath === "Dockerfile" || relativePath === ".env.example") {
    return `# ${marker}\n# ภาพรวมไฟล์: ${overview}\n# การทำงาน: ${flow}\n\n`;
  }
  if ([".css", ".scss"].includes(extension)) return `/*\n * ${marker}\n * ภาพรวมไฟล์: ${overview}\n * การทำงาน: ${flow}\n */\n\n`;
  return `/**\n * ${marker}\n * ภาพรวมไฟล์: ${overview}\n * การทำงาน: ${flow}\n */\n\n`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Comment” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - relativePath: ค่า “relative Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - content: ค่า “content” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - comment: ค่า “comment” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function insertComment(relativePath, content, comment) {
  const lines = content.split("\n");
  let insertAt = 0;
  if (lines[0]?.startsWith("#!")) insertAt = 1;
  if (lines[insertAt]?.includes("@vitest-environment")) insertAt += 1;
  if (/^["']use (client|server)["'];?$/.test(lines[insertAt]?.trim() ?? "")) insertAt += 1;
  if (insertAt === 0) return comment + content;
  lines.splice(insertAt, 0, "", comment.trimEnd());
  return lines.join("\n");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “collect Files” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - directory: ค่า “directory” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function collectFiles(directory) {
  const absoluteDirectory = path.join(projectRoot, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(relativePath));
    else if (supportedExtensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

const discoveredFiles = (await Promise.all(sourceRoots.map(async (root) => collectFiles(root)))).flat();
const candidates = [...new Set([...discoveredFiles, ...rootFiles])].sort();
let updated = 0;
let alreadyDocumented = 0;

for (const relativePath of candidates) {
  const absolutePath = path.join(projectRoot, relativePath);
  let content;
  try {
    content = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  if (content.includes(marker)) {
    alreadyDocumented += 1;
    continue;
  }
  const [overview, flow] = describe(relativePath, content);
  const comment = formatComment(relativePath, overview, flow);
  await writeFile(absolutePath, insertComment(relativePath, content, comment), "utf8");
  updated += 1;
}

console.log(`เพิ่มคำอธิบายแล้ว ${updated} ไฟล์; มีคำอธิบายอยู่ก่อนแล้ว ${alreadyDocumented} ไฟล์`);
