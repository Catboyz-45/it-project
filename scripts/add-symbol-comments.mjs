/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เติมคำอธิบายระดับฟังก์ชันและก้อนโค้ดสำคัญให้ซอร์สโค้ดที่ทีมดูแลเอง
 * การทำงาน: ใช้ TypeScript parser หา function, method, component, class, type และ interface แล้วแทรก JSDoc ภาษาไทยแบบรันซ้ำได้
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const projectRoot = process.cwd();
const marker = "คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น";
const roots = ["app", "components", "lib", "scripts", "tests", "types"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const excludedDirectories = new Set(["node_modules", ".next", "generated", "migrations", "coverage", "playwright-report", "test-results"]);
const dryRun = process.argv.includes("--dry-run");
const removeGeneratedComments = process.argv.includes("--remove");

const parameterMeanings = new Map([
  ["request", "คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้"],
  ["response", "ผลตอบกลับ HTTP ที่กำลังจัดเตรียม"],
  ["context", "ข้อมูลประกอบของ route เช่นค่าจาก URL"],
  ["params", "ค่าที่ระบุใน URL หรือพารามิเตอร์ของการทำงาน"],
  ["props", "ข้อมูลที่คอมโพเนนต์แม่ส่งเข้ามาเพื่อใช้แสดงผล"],
  ["children", "เนื้อหาหรือคอมโพเนนต์ลูกที่ต้องแสดงภายใน"],
  ["event", "เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์"],
  ["input", "ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล"],
  ["data", "ข้อมูลที่ฟังก์ชันนำไปประมวลผล"],
  ["options", "ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน"],
  ["database", "ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้"],
  ["error", "ข้อผิดพลาดที่ต้องแปลง บันทึก หรือแสดงอย่างปลอดภัย"],
  ["propertyId", "รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล"],
  ["userId", "รหัสภายในของบัญชีผู้ใช้"],
  ["tenantProfileId", "รหัสโปรไฟล์ผู้เช่า"],
  ["roomId", "รหัสภายในของห้องพัก"],
  ["invoiceId", "รหัสภายในของบิล"],
  ["ticketId", "รหัสภายในของงานแจ้งเรื่อง"],
]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “human Name” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function humanName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “describe Action” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filePath: ค่า “file Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function describeAction(name, kind, filePath) {
  const readable = humanName(name);
  const lower = name.toLowerCase();
  if (name === "GET") return "ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL";
  if (name === "POST") return "ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์";
  if (name === "PUT") return "ตอบคำขอแทนค่าข้อมูลทั้งชุดของ API เส้นทางนี้ โดยรักษากฎธุรกิจของระบบ";
  if (name === "PATCH") return "ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้";
  if (name === "DELETE") return "ตอบคำขอลบ ยกเลิก หรือปิดรายการของ API เส้นทางนี้ตามสิทธิ์และกฎธุรกิจ";
  if (kind === "constructor") return `เตรียมค่าเริ่มต้นเมื่อสร้างออบเจ็กต์ ${humanName(path.basename(filePath, path.extname(filePath)))}`;
  if (kind === "component") return `คอมโพเนนต์ React “${readable}” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น`;
  if (/^(get|load|fetch|find|list|read|resolve)/.test(lower)) return `อ่านหรือค้นหาข้อมูลสำหรับ “${readable}” แล้วส่งผลที่เหมาะสมกลับไป`;
  if (/^(create|add|insert|register|issue|submit|send)/.test(lower)) return `สร้างหรือส่งข้อมูลในขั้นตอน “${readable}” หลังผ่านการตรวจที่เกี่ยวข้อง`;
  if (/^(update|edit|save|set|patch|change|mark|review|approve|reject)/.test(lower)) return `เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “${readable}” โดยใช้ค่าที่รับเข้ามา`;
  if (/^(delete|remove|clear|purge|revoke|cancel|close|logout)/.test(lower)) return `ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “${readable}” ตามกฎของระบบ`;
  if (/^(require|assert|validate|check|verify|ensure)/.test(lower)) return `ตรวจเงื่อนไขของ “${readable}” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน`;
  if (/^(parse|normalize|sanitize|format|serialize|deserialize|convert|map|to|hash|encrypt|sign)/.test(lower)) return `แปลงข้อมูลในขั้นตอน “${readable}” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้`;
  if (/^(is|has|can|should|matches|allows)([A-Z_]|$)/.test(name)) return `ตอบว่าเงื่อนไข “${readable}” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป`;
  if (/^(build|generate|make|compose|calculate|compute|derive)/.test(lower)) return `ประกอบหรือคำนวณผลลัพธ์ของ “${readable}” จากข้อมูลที่ได้รับ`;
  if (/^(handle|on)/.test(lower)) return `รับเหตุการณ์ “${readable}” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง`;
  if (/^(render)/.test(lower)) return `สร้างผลลัพธ์สำหรับแสดงส่วน “${readable}” บนหน้าจอ`;
  if (/^(use)/.test(lower)) return `React hook “${readable}” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ`;
  return `รวมขั้นตอนย่อยของ “${readable}” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “parameter Description” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - parameterName: ค่า “parameter Name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function parameterDescription(parameterName) {
  if (parameterName.startsWith("{")) return "ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้";
  const exact = parameterMeanings.get(parameterName);
  if (exact) return exact;
  if (parameterName.endsWith("Id")) return `รหัสภายในของ ${humanName(parameterName.slice(0, -2))}`;
  if (parameterName.startsWith("is") || parameterName.startsWith("has") || parameterName.startsWith("can")) return "ค่าจริง/เท็จที่ใช้เปิดหรือปิดเงื่อนไขนี้";
  return `ค่า “${humanName(parameterName)}” ที่จำเป็นต่อการทำงานของก้อนนี้`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is React Component” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filePath: ค่า “file Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isReactComponent(name, filePath) {
  return filePath.endsWith(".tsx") && /^[A-Z]/.test(name);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “has Function Inside” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - depth: ค่า “depth” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function hasFunctionInside(node, depth = 0) {
  if (!node || depth > 3) return false;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
  if (ts.isCallExpression(node)) return node.arguments.some((argument) => hasFunctionInside(argument, depth + 1));
  if (ts.isParenthesizedExpression(node)) return hasFunctionInside(node.expression, depth + 1);
  return false;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “name Of” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function nameOf(node, sourceFile) {
  if (!node) return "anonymous";
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText(sourceFile).slice(0, 80);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “parameter Name” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - parameter: ค่า “parameter” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function parameterName(parameter, sourceFile) {
  if (ts.isIdentifier(parameter.name)) return parameter.name.text;
  return parameter.name.getText(sourceFile).replace(/\s+/g, " ").slice(0, 60);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “return Description” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function returnDescription(node, sourceFile) {
  if (ts.isConstructorDeclaration(node) || ts.isSetAccessorDeclaration(node)) return "ไม่มีค่าคืน; ผลคือออบเจ็กต์หรือสถานะภายในได้รับการตั้งค่า";
  const explicitType = node.type?.getText(sourceFile).replace(/\s+/g, " ");
  if (explicitType === "void" || explicitType === "Promise<void>") return "ไม่มีข้อมูลคืนให้ผู้เรียก; ความสำเร็จหรือข้อผิดพลาดเกิดจากขั้นตอนที่สั่งทำ";
  if (explicitType) return `คืนข้อมูลชนิด ${explicitType} ตามสัญญา TypeScript ของฟังก์ชัน`;
  if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) return "คืนค่าที่คำนวณจาก expression นี้โดยตรง";
  if (node.body?.getText(sourceFile).includes("return ")) return "คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก";
  return "คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “function Comment” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filePath: ค่า “file Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function functionComment(name, node, sourceFile, filePath, kind = "function") {
  const component = isReactComponent(name, filePath);
  const parameters = node.parameters ?? [];
  const lines = [
    ` * ${marker}`,
    ` * หน้าที่: ${describeAction(name, component ? "component" : kind, filePath)}`,
  ];
  if (parameters.length === 0) lines.push(" * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้");
  else {
    lines.push(" * รับค่า:");
    for (const parameter of parameters) {
      const name = parameterName(parameter, sourceFile);
      lines.push(` * - ${name}: ${parameterDescription(name)}`);
    }
  }
  lines.push(` * ผลลัพธ์: ${component ? "คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ" : returnDescription(node, sourceFile)}`);
  return ["/**", ...lines, " */"].join("\n");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “declaration Comment” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function declarationComment(name, kind) {
  const readable = humanName(name);
  const meaning = kind === "class"
    ? `คลาส “${readable}” รวมข้อมูลและพฤติกรรมที่ต้องทำงานร่วมกันเป็นออบเจ็กต์เดียว`
    : kind === "interface"
      ? `interface “${readable}” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน`
      : kind === "enum"
        ? `enum “${readable}” จำกัดค่าที่เลือกได้ไว้เฉพาะสถานะที่ประกาศในก้อนนี้`
        : `type “${readable}” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime`;
  return ["/**", ` * ${marker}`, ` * หน้าที่: ${meaning}`, " */"].join("\n");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “variable Comment” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - names: ค่า “names” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function variableComment(names) {
  const readable = names.map(humanName).join(", ");
  return [
    "/**",
    ` * ${marker}`,
    ` * หน้าที่: ประกาศค่าหรือ schema “${readable}” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว`,
    " */",
  ].join("\n");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is Documentable Variable” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - statement: ค่า “statement” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isDocumentableVariable(statement) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “exported” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - modifier: ค่า “modifier” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  return statement.declarationList.declarations.some((declaration) => {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "";
    return hasFunctionInside(declaration.initializer) || (exported && /(Schema|Config|Map|Options|Fields|Columns|Statuses|Kinds|Roles)$/.test(name));
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “leading Trivia Contains Marker” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - source: ค่า “source” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function leadingTriviaContainsMarker(source, node, sourceFile) {
  return source.slice(node.getFullStart(), node.getStart(sourceFile)).includes(marker);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “structural Indentation” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function structuralIndentation(node) {
  let depth = 0;
  let parent = node.parent;
  while (parent) {
    if (
      ts.isBlock(parent)
      || ts.isModuleBlock(parent)
      || ts.isClassDeclaration(parent)
      || ts.isClassExpression(parent)
      || ts.isCaseClause(parent)
      || ts.isDefaultClause(parent)
    ) {
      depth += 1;
    }
    parent = parent.parent;
  }
  return "  ".repeat(depth);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “collect Insertions” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - source: ค่า “source” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - sourceFile: ค่า “source File” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filePath: ค่า “file Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function collectInsertions(source, sourceFile, filePath) {
  const insertions = [];
  const seenPositions = new Set();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - comment: ค่า “comment” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  function add(node, comment) {
    const position = node.getStart(sourceFile);
    const lineStart = source.lastIndexOf("\n", position - 1) + 1;
    if (seenPositions.has(lineStart) || leadingTriviaContainsMarker(source, node, sourceFile)) return;
    const indentation = structuralIndentation(node);
    const indentedComment = comment.split("\n").map((line) => `${indentation}${line}`).join("\n");
    insertions.push({ start: lineStart, end: position, text: `${indentedComment}\n${indentation}` });
    seenPositions.add(lineStart);
  }
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “visit” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body && node.name) {
      add(node, functionComment(node.name.text, node, sourceFile, filePath));
    } else if ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.body) {
      add(node, functionComment(nameOf(node.name, sourceFile), node, sourceFile, filePath, "method"));
    } else if (ts.isConstructorDeclaration(node) && node.body) {
      add(node, functionComment("constructor", node, sourceFile, filePath, "constructor"));
    } else if (ts.isVariableStatement(node) && isDocumentableVariable(node)) {
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “declarations” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - declaration: ค่า “declaration” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const declarations = node.declarationList.declarations.filter((declaration) => hasFunctionInside(declaration.initializer) || ts.isIdentifier(declaration.name));
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “names” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - declaration: ค่า “declaration” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const names = declarations.map((declaration) => nameOf(declaration.name, sourceFile));
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “function Declaration” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - declaration: ค่า “declaration” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const functionDeclaration = declarations.find((declaration) => hasFunctionInside(declaration.initializer));
      if (functionDeclaration) {
        const functionNode = findContainedFunction(functionDeclaration.initializer);
        add(node, functionComment(nameOf(functionDeclaration.name, sourceFile), functionNode, sourceFile, filePath));
      } else if (names.length > 0) add(node, variableComment(names));
    } else if (ts.isClassDeclaration(node) && node.name) {
      add(node, declarationComment(node.name.text, "class"));
    } else if (ts.isInterfaceDeclaration(node)) {
      add(node, declarationComment(node.name.text, "interface"));
    } else if (ts.isTypeAliasDeclaration(node)) {
      add(node, declarationComment(node.name.text, "type"));
    } else if (ts.isEnumDeclaration(node)) {
      add(node, declarationComment(node.name.text, "enum"));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return insertions;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find Contained Function” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - depth: ค่า “depth” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function findContainedFunction(node, depth = 0) {
  if (!node || depth > 3) return node;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node;
  if (ts.isCallExpression(node)) {
    for (const argument of node.arguments) {
      const found = findContainedFunction(argument, depth + 1);
      if (found && (ts.isArrowFunction(found) || ts.isFunctionExpression(found))) return found;
    }
  }
  if (ts.isParenthesizedExpression(node)) return findContainedFunction(node.expression, depth + 1);
  return node;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “collect Files” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - directory: ค่า “directory” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function collectFiles(directory) {
  const entries = await readdir(path.join(projectRoot, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(relativePath));
    else if (extensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

const files = (await Promise.all(roots.map((root) => collectFiles(root)))).flat().sort();
let changedFiles = 0;
let addedComments = 0;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “remove Comment Blocks” ตามกฎของระบบ
 * รับค่า:
 * - source: ค่า “source” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function removeCommentBlocks(source) {
  const lines = source.split("\n");
  const output = [];
  let removed = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === "/**") {
      let end = index;
      while (end < lines.length && lines[end].trim() !== "*/") end += 1;
      const block = lines.slice(index, Math.min(end + 1, lines.length)).join("\n");
      if (block.includes(marker)) {
        removed += 1;
        index = end;
        continue;
      }
    }
    output.push(lines[index]);
  }
  return { source: output.join("\n"), removed };
}

if (removeGeneratedComments) {
  let removedComments = 0;
  let cleanedFiles = 0;
  for (const relativePath of files) {
    const absolutePath = path.join(projectRoot, relativePath);
    const source = await readFile(absolutePath, "utf8");
    const cleaned = removeCommentBlocks(source);
    if (cleaned.removed === 0) continue;
    await writeFile(absolutePath, cleaned.source, "utf8");
    cleanedFiles += 1;
    removedComments += cleaned.removed;
  }
  const prismaPath = path.join(projectRoot, "prisma", "schema.prisma");
  const prismaLines = (await readFile(prismaPath, "utf8")).split("\n");
  const cleanedPrismaLines = [];
  let prismaRemoved = 0;
  for (let index = 0; index < prismaLines.length; index += 1) {
    if (prismaLines[index].includes(marker)) {
      prismaRemoved += 1;
      if (prismaLines[index + 1]?.startsWith("/// ")) index += 1;
      continue;
    }
    cleanedPrismaLines.push(prismaLines[index]);
  }
  if (prismaRemoved > 0) {
    await writeFile(prismaPath, cleanedPrismaLines.join("\n"), "utf8");
    cleanedFiles += 1;
    removedComments += prismaRemoved;
  }
  console.log(`ลบคำอธิบายที่สคริปต์สร้าง ${removedComments} ก้อน จาก ${cleanedFiles} ไฟล์`);
  process.exit(0);
}

for (const relativePath of files) {
  const absolutePath = path.join(projectRoot, relativePath);
  const source = await readFile(absolutePath, "utf8");
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : relativePath.endsWith(".jsx") ? ts.ScriptKind.JSX : relativePath.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insertions” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - left: ค่า “left” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - right: ค่า “right” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const insertions = collectInsertions(source, sourceFile, relativePath).sort((left, right) => right.start - left.start);
  if (insertions.length === 0) continue;
  changedFiles += 1;
  addedComments += insertions.length;
  if (!dryRun) {
    let output = source;
    for (const insertion of insertions) output = output.slice(0, insertion.start) + insertion.text + output.slice(insertion.end);
    await writeFile(absolutePath, output, "utf8");
  }
}

const prismaPath = path.join(projectRoot, "prisma", "schema.prisma");
const prismaSource = await readFile(prismaPath, "utf8");
const prismaLines = prismaSource.split("\n");
const prismaOutput = [];
let prismaComments = 0;
for (const line of prismaLines) {
  const declaration = line.match(/^(model|enum)\s+([A-Za-z0-9_]+)\s*\{/);
  if (declaration && !prismaOutput.slice(-4).join("\n").includes(marker)) {
    const [, kind, name] = declaration;
    prismaOutput.push(
      `/// ${marker}`,
      kind === "model"
        ? `/// ตาราง ${name}: เก็บข้อมูลและความสัมพันธ์ของ “${humanName(name)}”; แต่ละบรรทัดด้านในคือฟิลด์หรือกฎเชื่อมกับตารางอื่น`
        : `/// กลุ่มสถานะ ${name}: จำกัดค่าที่ฐานข้อมูลยอมรับ เพื่อไม่ให้บันทึกข้อความสถานะที่สะกดหรือมีความหมายไม่ตรงกัน`,
    );
    prismaComments += 1;
  }
  prismaOutput.push(line);
}
if (prismaComments > 0) {
  changedFiles += 1;
  addedComments += prismaComments;
  if (!dryRun) await writeFile(prismaPath, prismaOutput.join("\n"), "utf8");
}

console.log(`${dryRun ? "พบ" : "เพิ่ม"}คำอธิบาย ${addedComments} ก้อน ใน ${changedFiles} ไฟล์${dryRun ? " (ยังไม่ได้แก้ไฟล์)" : ""}`);
