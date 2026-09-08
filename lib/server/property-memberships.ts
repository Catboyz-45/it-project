/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “property memberships” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { UpdatePropertyMembershipsInput } from "@/lib/domain/property-memberships";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Property Admin Memberships” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updatePropertyAdminMemberships(
  userId: string,
  input: UpdatePropertyMembershipsInput,
) {
  return getDatabase().$transaction(async (database) => {
    const account = await database.user.findFirst({
      where: { id: userId, role: "PROPERTY_ADMIN" },
      select: { id: true },
    });
    if (!account) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");

    const properties = await database.property.findMany({
      where: { id: { in: input.propertyIds } },
      select: { id: true },
    });
    if (properties.length !== input.propertyIds.length) {
      throw new ApiError(400, "มีหอพักที่ไม่พบ กรุณาโหลดรายการใหม่");
    }

    await database.propertyMembership.deleteMany({
      where: { userId: account.id, propertyId: { notIn: input.propertyIds } },
    });
    if (input.propertyIds.length) {
      await database.propertyMembership.createMany({
        data: input.propertyIds.map((propertyId) => ({ userId: account.id, propertyId })),
        skipDuplicates: true,
      });
    }

    await database.session.deleteMany({ where: { userId: account.id } });
    return database.user.findUniqueOrThrow({
      where: { id: account.id },
      select: {
        id: true,
        memberships: { select: { property: { select: { id: true, name: true } } } },
      },
    });
  }, { isolationLevel: "Serializable" });
}
