export type CsvCell = string | number | boolean | Date | null | undefined;

// อักขระที่ Excel กับ Google Sheets ตีความว่าเป็นสูตร
const formulaPrefix = /^[=+\-@\t\r]/;

function csvCell(value: CsvCell) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  // เติมอัญประกาศเดี่ยวนำหน้า กันช่องที่ขึ้นต้นด้วยอักขระพวกนี้ถูกรันเป็นสูตรตอนเปิดไฟล์
  // ข้อมูลในไฟล์มาจากที่ผู้ใช้กรอก จึงถือว่าเชื่อไม่ได้
  if (formulaPrefix.test(text)) text = `'${text}`;
  // ครอบทุกช่องด้วยอัญประกาศเสมอ และแปลงอัญประกาศข้างในเป็นสองตัวตามรูปแบบของ CSV
  return `"${text.replaceAll('"', '""')}"`;
}

// \uFEFF คือ BOM บอก Excel ว่าไฟล์เป็น UTF-8 ไม่งั้นภาษาไทยจะกลายเป็นตัวประหลาด
// \r\n เพราะเป็นตัวขึ้นบรรทัดที่มาตรฐาน CSV กำหนดและ Excel บน Windows คาดหวัง
export function createCsv(rows: CsvCell[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
