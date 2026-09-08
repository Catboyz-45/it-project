/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “password reset” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createHash, randomBytes } from "node:crypto";
import { platformProfile } from "@/lib/platform-profile";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

const resetLifetimeMs = 30 * 60 * 1000;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “hash Token” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Password Reset” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function requestPasswordReset(email: string) {
  const user = await getDatabase().user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true, isActive: true },
  });
  if (!user?.isActive) return;
  const token = randomBytes(32).toString("base64url");
  await getDatabase().$transaction([
    getDatabase().passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    getDatabase().passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + resetLifetimeMs),
      },
    }),
  ]);
  try {
    await sendResetEmail(user.email, user.displayName, token);
  } catch {
    // Keep the public response indistinguishable for known and unknown accounts.
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “send Reset Email” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - displayName: ค่า “display Name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function sendResetEmail(email: string, displayName: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_EMAIL_FROM;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !from || !appUrl) {
    if (process.env.NODE_ENV === "production") throw new ApiError(503, "ระบบส่งอีเมลยังไม่พร้อมใช้งาน");
    return;
  }
  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `ตั้งรหัสผ่าน ${platformProfile.name} ใหม่`,
      text: `สวัสดี ${displayName}\n\nเปิดลิงก์นี้ภายใน 30 นาทีเพื่อตั้งรหัสผ่านใหม่:\n${resetUrl.toString()}\n\nหากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(503, "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “reset Password” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function resetPassword(token: string, password: string) {
  const now = new Date();
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);
  return getDatabase().$transaction(async (database) => {
    const record = await database.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new ApiError(400, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
    }
    await database.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await database.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    await database.session.deleteMany({ where: { userId: record.userId } });
    return record.userId;
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change Temporary Password” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function changeTemporaryPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  await getDatabase().$transaction([
    getDatabase().user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    getDatabase().session.deleteMany({ where: { userId } }),
    getDatabase().passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “issue Temporary Password” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function issueTemporaryPassword(userId: string) {
  const temporaryPassword = `Df1-${randomBytes(15).toString("base64url")}`;
  const passwordHash = await hashPassword(temporaryPassword);
  await getDatabase().$transaction(async (database) => {
    const updated = await database.user.updateMany({
      where: { id: userId, role: "PROPERTY_ADMIN", isActive: true },
      data: { passwordHash, mustChangePassword: true },
    });
    if (updated.count !== 1) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    await database.session.deleteMany({ where: { userId } });
    await database.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
  return temporaryPassword;
}
