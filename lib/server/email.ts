import { ApiError } from "@/lib/server/api";

// ส่งอีเมลผ่าน Resend ใช้ร่วมกันทั้งลิงก์ตั้งรหัสผ่าน คำเชิญผู้เช่า และอีเมลเตือนแพ็กเกจใกล้หมดอายุ
// ยิงด้วย fetch ตรง ๆ ไม่ต้องเพิ่ม dependency และตั้งค่าครั้งเดียวผ่านตัวแปรชุดเดิม

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
};

// sent = ส่งออกไปแล้ว skipped = ยังไม่ได้ตั้งค่าบริการส่งอีเมลในเครื่อง dev จึงข้ามไปเงียบ ๆ
export type EmailDelivery = "sent" | "skipped";

// ลิงก์ในอีเมลต้องเป็นที่อยู่เต็มของเว็บจริง ไม่ใช่พาธสั้น ๆ
export function appLink(pathWithHash: string) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new ApiError(503, "ระบบส่งอีเมลยังไม่พร้อมใช้งาน");
  return new URL(pathWithHash, appUrl).toString();
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_EMAIL_FROM && process.env.APP_URL);
}

export async function sendEmail(message: OutgoingEmail, failureMessage = "ไม่สามารถส่งอีเมลได้"): Promise<EmailDelivery> {
  // ตอน production ต้องตั้งค่าครบ ไม่งั้นถือว่าระบบไม่พร้อม
  // ตอน dev ปล่อยผ่านเงียบ ๆ เพื่อให้ทดสอบขั้นตอนอื่นได้โดยไม่ต้องตั้งบริการส่งอีเมล
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new ApiError(503, "ระบบส่งอีเมลยังไม่พร้อมใช้งาน");
    return "skipped";
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.PASSWORD_RESET_EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
    // ตั้ง timeout กับคำขอที่ออกไปข้างนอกเสมอ ไม่งั้นบริการปลายทางค้างแล้วคำขอของเราค้างตาม
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(503, failureMessage);
  return "sent";
}

// บันทึกว่าส่งไม่สำเร็จโดยไม่ใส่อีเมลผู้รับ โทเคน หรือเนื้อหา ใส่แค่ id ที่ใช้ตามหาเรื่องได้
export function logEmailFailure(event: string, subjectId: string, error: unknown) {
  console.error(JSON.stringify({
    level: "error", event, subjectId,
    message: error instanceof Error ? error.message : "Unknown error",
  }));
}
