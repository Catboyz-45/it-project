/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน admin-rules ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { AdminRole } from "@prisma/client";

type ProtectedAdmin = {
  role: AdminRole;
  isActive: boolean;
};

type AdminAccessUpdate = {
  role?: AdminRole;
  isActive?: boolean;
};

/** ฟังก์ชันสาธารณะ wouldRemoveLastActiveSuperAdmin เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function wouldRemoveLastActiveSuperAdmin(
  target: ProtectedAdmin,
  update: AdminAccessUpdate,
  activeSuperAdminCount: number,
) {
  const removesSuperAccess =
    target.role === "SUPER_ADMIN" &&
    target.isActive &&
    (update.role === "EDITOR" || update.isActive === false);

  return removesSuperAccess && activeSuperAdminCount <= 1;
}
