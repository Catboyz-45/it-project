import { createHash, randomBytes } from "node:crypto";
import { platformProfile } from "@/lib/platform-profile";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

// ลิงก์อยู่ได้ 30 นาที สั้นเพราะลิงก์ที่ค้างในกล่องอีเมลเป็นความเสี่ยงถ้าอีเมลหลุด
const resetLifetimeMs = 30 * 60 * 1000;

// ฐานข้อมูลเก็บแต่ค่า hash ฐานข้อมูลรั่วก็เอาโทเคนไปตั้งรหัสผ่านใหม่ไม่ได้
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// ขอลิงก์ตั้งรหัสผ่านใหม่ ตอบเหมือนกันเสมอไม่ว่าอีเมลนั้นจะมีอยู่จริงหรือไม่
// ไม่โยน error และไม่คืนค่าอะไร เพื่อไม่ให้ใครใช้หน้านี้ไล่เดาว่าอีเมลไหนสมัครไว้แล้ว
export async function requestPasswordReset(email: string) {
  const user = await getDatabase().user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true, isActive: true },
  });
  // ไม่มีบัญชีหรือบัญชีถูกระงับก็เงียบ ๆ ผู้เรียกจะได้ไม่รู้ว่าติดข้อไหน
  if (!user?.isActive) return;
  const token = await createResetToken(user.id);
  try {
    await sendResetEmail(user.email, user.displayName, token);
  } catch (error) {
    // ส่งอีเมลไม่สำเร็จก็ยังตอบเหมือนเดิม ไม่งั้นเวลาที่ใช้ตอบจะต่างกันจนเดาได้ว่าอีเมลนั้นมีอยู่จริง
    // แต่ต้องเขียน log ไว้ ไม่งั้นระบบส่งอีเมลพังแล้วไม่มีใครรู้ บันทึกแค่ id ผู้ใช้ ไม่บันทึกอีเมลหรือโทเคน
    logResetEmailFailure(user.id, error);
  }
}

// Super Admin ส่งลิงก์ตั้งรหัสผ่านให้เจ้าของหอที่ขอความช่วยเหลือ
// ต่างจากหน้าลืมรหัสผ่านตรงที่ต้องบอกผลจริง เพราะคนกดเป็นผู้ดูแลระบบ ไม่ใช่คนนอกที่มาไล่เดาอีเมล
export async function sendOwnerPasswordResetLink(userId: string) {
  const user = await getDatabase().user.findFirst({
    // ใส่บทบาทกับสถานะไว้ในเงื่อนไขเลย ส่งลิงก์ให้บัญชีประเภทอื่นหรือบัญชีที่ยังไม่อนุมัติไม่ได้
    where: { id: userId, role: "PROPERTY_ADMIN", isActive: true, approvalStatus: "APPROVED" },
    select: { id: true, email: true, displayName: true },
  });
  if (!user) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
  const token = await createResetToken(user.id);
  try {
    await sendResetEmail(user.email, user.displayName, token, true);
  } catch (error) {
    logResetEmailFailure(user.id, error);
    throw error instanceof ApiError ? error : new ApiError(503, "ไม่สามารถส่งอีเมลตั้งรหัสผ่านได้");
  }
  return { email: user.email };
}

// ทำโทเคนเก่าที่ยังไม่ได้ใช้ให้หมดอายุก่อน ขอใหม่แล้วอันเก่าต้องใช้ไม่ได้ทันที
async function createResetToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await getDatabase().$transaction([
    getDatabase().passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    getDatabase().passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + resetLifetimeMs),
      },
    }),
  ]);
  return token;
}

function logResetEmailFailure(userId: string, error: unknown) {
  console.error(JSON.stringify({
    level: "error", event: "password_reset_email_failed", userId,
    message: error instanceof Error ? error.message : "Unknown error",
  }));
}

async function sendResetEmail(email: string, displayName: string, token: string, sentByAdmin = false) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_EMAIL_FROM;
  const appUrl = process.env.APP_URL;
  // ตอน production ต้องตั้งค่าครบ ไม่งั้นถือว่าระบบไม่พร้อม
  // ตอน dev ปล่อยผ่านเงียบ ๆ เพื่อให้ทดสอบขั้นตอนอื่นได้โดยไม่ต้องตั้งบริการส่งอีเมล
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
      text: sentByAdmin
        ? `สวัสดี ${displayName}\n\nผู้ดูแลระบบ ${platformProfile.name} ส่งลิงก์ตั้งรหัสผ่านให้คุณตามที่ขอความช่วยเหลือ เปิดลิงก์นี้ภายใน 30 นาทีเพื่อตั้งรหัสผ่านใหม่:\n${resetUrl.toString()}\n\nหากคุณไม่ได้ติดต่อขอความช่วยเหลือ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านเดิมยังใช้ได้ตามปกติ`
        : `สวัสดี ${displayName}\n\nเปิดลิงก์นี้ภายใน 30 นาทีเพื่อตั้งรหัสผ่านใหม่:\n${resetUrl.toString()}\n\nหากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้`,
    }),
    // ตั้ง timeout กับคำขอที่ออกไปข้างนอกเสมอ ไม่งั้นบริการปลายทางค้างแล้วคำขอของเราค้างตาม
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(503, "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้");
}

// ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล
export async function resetPassword(token: string, password: string) {
  const now = new Date();
  const tokenHash = hashToken(token);
  // เข้ารหัสไว้ก่อนเข้า transaction เพราะ scrypt ตั้งใจให้ช้า ไม่ควรถือ transaction ค้างไว้ระหว่างนั้น
  const passwordHash = await hashPassword(password);
  return getDatabase().$transaction(async (database) => {
    const record = await database.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    // ตรวจสามอย่าง มีจริง ยังไม่เคยใช้ และยังไม่หมดอายุ ข้อความผิดพลาดเหมือนกันหมด ไม่บอกว่าติดข้อไหน
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new ApiError(400, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
    }
    await database.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // ปิดโทเคนที่ยังไม่ได้ใช้ทั้งหมดของคนนี้ ลิงก์ใช้ได้ครั้งเดียวจริง ๆ
    await database.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    // ตัด session ทุกเครื่องทิ้ง เผื่อรหัสเดิมหลุดไปแล้วมีคนอื่นเข้าอยู่
    await database.session.deleteMany({ where: { userId: record.userId } });
    return record.userId;
  });
}

// เปลี่ยนรหัสชั่วคราวเป็นรหัสของตัวเอง ทำตอนถูกบังคับให้เปลี่ยนหลังเข้าสู่ระบบครั้งแรก
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

// ผู้ดูแลระบบออกรหัสชั่วคราวให้เจ้าของหอที่เข้าระบบไม่ได้
export async function issueTemporaryPassword(userId: string) {
  // ส่วนหน้า "Df1-" ทำให้ผ่านเกณฑ์ที่ต้องมีพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลขแน่นอน
  // ที่เหลือสุ่ม 15 ไบต์ ยาวพอที่จะเดาไม่ได้
  const temporaryPassword = `Df1-${randomBytes(15).toString("base64url")}`;
  const passwordHash = await hashPassword(temporaryPassword);
  await getDatabase().$transaction(async (database) => {
    const updated = await database.user.updateMany({
      where: { id: userId, role: "PROPERTY_ADMIN", isActive: true },
      data: { passwordHash, mustChangePassword: true },
    });
    // ใส่เงื่อนไขบทบาทกับสถานะไว้ใน where เลย จะได้ออกรหัสให้บัญชีอื่นไม่ได้
    // นับจำนวนแถวที่แก้แทนการอ่านมาเช็คก่อน จึงไม่มีช่องว่างระหว่างอ่านกับเขียน
    if (updated.count !== 1) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    await database.session.deleteMany({ where: { userId } });
    await database.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
  return temporaryPassword;
}
