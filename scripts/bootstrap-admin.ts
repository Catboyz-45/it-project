/**
 * หน้าที่ของไฟล์นี้: คำสั่งดูแลระบบ bootstrap-admin; รันจากเครื่องหรือเซิร์ฟเวอร์ที่เชื่อถือได้ตามคู่มือใน docs
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

async function main() {
  const db = new PrismaClient();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || "เจ้าของบริษัท";
  if (!username || !/^[a-zA-Z0-9._-]{3,64}$/.test(username) || !password || password.length < 12) throw new Error("Set valid BOOTSTRAP_ADMIN_USERNAME and a temporary BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters");
  try {
    const existing = await db.admin.findUnique({ where: { usernameNormalized: username } });
    if (existing) console.log("Bootstrap admin already exists; no changes made.");
    else {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
      await db.admin.create({ data: { username, usernameNormalized: username, displayName, role: "SUPER_ADMIN", passwordHash, mustChangePassword: true } });
      console.log("Bootstrap Super Admin created. Password change and 2FA enrollment are required at first sign-in.");
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; });
