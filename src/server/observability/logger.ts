/**
 * หน้าที่ของไฟล์นี้: ระบบบันทึกเหตุการณ์แบบมีโครงสร้างสำหรับตรวจสอบปัญหา โดยหลีกเลี่ยงการบันทึกข้อมูลลับ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
type LogLevel = "info" | "warn" | "error";
type LogData = Record<string, string | number | boolean | null | undefined>;

const sensitive = /password|secret|token|cookie|authorization|recovery|totp/i;
function sanitize(data: LogData) {
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => !sensitive.test(key) && value !== undefined));
}

/** บันทึกเหตุการณ์ผ่าน log เพื่อให้ตรวจสอบย้อนหลังได้ โดยไม่ควรใส่รหัสผ่านหรือ token */
export function log(level: LogLevel, event: string, data: LogData = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(data) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

/** ฟังก์ชันสาธารณะ errorDetails เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function errorDetails(error: unknown) {
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message.slice(0, 500) };
  return { errorName: "UnknownError", errorMessage: "Non-error value thrown" };
}
