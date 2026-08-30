/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน totp-replay ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import type { Prisma } from "@prisma/client";

/** Atomically claims a valid TOTP time-step so parallel sessions cannot reuse it. */
export async function claimTotpTimeStep(
  tx: Prisma.TransactionClient,
  adminId: string,
  timeStep: number,
): Promise<boolean> {
  const claimed = await tx.admin.updateMany({
    where: {
      id: adminId,
      OR: [
        { lastTotpTimeStep: null },
        { lastTotpTimeStep: { lt: timeStep } },
      ],
    },
    data: { lastTotpTimeStep: timeStep },
  });
  return claimed.count === 1;
}
