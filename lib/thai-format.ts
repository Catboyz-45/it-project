// จัดรูปแบบตัวเลขและวันที่ให้อ่านแบบที่คนไทยคุ้นตา ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ
// ทุกฟังก์ชันคืนค่าเดิมกลับไปถ้ารูปแบบไม่ตรง จะได้ไม่ทำข้อมูลที่แปลกหายไปจากหน้าจอ

const onlyDigits = (value: string) => value.replace(/\D/g, "");

// เลขบัญชีธนาคาร 10 หลักเขียนแบบ 123-4-56789-0 ตามสมุดบัญชีของธนาคารส่วนใหญ่
// บัญชี 12 หลัก (เช่นออมสิน ธ.ก.ส.) แบ่งทีละสี่หลัก
export function formatBankAccount(value: string | null | undefined) {
  if (!value) return "";
  const digits = onlyDigits(value);
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 12) return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  return value;
}

// เบอร์มือถือ 10 หลักเป็น 089-123-4567 เบอร์บ้านกรุงเทพ 9 หลักเป็น 02-123-4567 ต่างจังหวัดเป็น 053-123-456
export function formatThaiPhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = onlyDigits(value);
  if (digits.length === 10 && digits.startsWith("0")) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  if (digits.length === 9 && digits.startsWith("0")) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

// ล็อกเป็นเวลาไทย หน้าที่สร้างบนเซิร์ฟเวอร์ (ตั้งเป็น UTC) จะได้ไม่แสดงเวลาช้าไป 7 ชั่วโมง
const timeZone = "Asia/Bangkok";

// วันที่แบบ "4 ก.ค. 2569" ไม่ใช้ 4/7/2569 เพราะสลับวันกับเดือนได้ง่ายและอ่านช้ากว่า
export function formatThaiDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone });
}

// วันและเวลาแบบ "4 ก.ค. 2569 · 06:46 น." ตัดวินาทีออก คนอ่านไม่ได้ใช้และทำให้ข้อความรก
export function formatThaiDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const time = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
  return `${formatThaiDate(date)} · ${time} น.`;
}

// เดือนรอบบิลแบบ "พฤศจิกายน 2569" จากค่า "2026-11"
export function formatThaiMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
}

// เดือนปัจจุบันตามเวลาไทยแบบ "YYYY-MM" ไม่ใช้ toISOString เพราะเป็นเวลา UTC
// ช่วงตีหนึ่งถึงเจ็ดโมงเช้าวันที่ 1 จะยังได้เดือนก่อน
export function currentThaiMonth(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).format(now);
}

// รายการเดือนย้อนหลังนับจากเดือนล่าสุด ใช้เป็นตัวเลือกในดรอปดาวน์ เรียงจากใหม่ไปเก่า
export function recentMonths(latest: string, count: number) {
  const [year, month] = latest.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return date.toISOString().slice(0, 7);
  });
}

// ตัวเลือกเดือนพร้อมชื่อภาษาไทย ถ้าค่าที่เลือกอยู่เก่ากว่าช่วงที่แสดง ก็ใส่เพิ่มท้ายรายการไว้ให้ ไม่ให้หายไปจากช่อง
export function thaiMonthOptions(latest: string, count: number, selected?: string) {
  const months = recentMonths(latest, count);
  if (selected && !months.includes(selected)) months.push(selected);
  return months.map((value) => ({ value, label: formatThaiMonth(value) }));
}
