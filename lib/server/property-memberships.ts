import type { UpdatePropertyMembershipsInput } from "@/lib/domain/property-memberships";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

// ตั้งสิทธิ์ว่าบัญชีนี้ดูแลหอไหนได้บ้าง ส่งมาเป็นรายการเต็ม ไม่ใช่เพิ่มทีละอัน
export async function updatePropertyAdminMemberships(
  userId: string,
  input: UpdatePropertyMembershipsInput,
) {
  // ทำใน transaction เพราะมีทั้งลบและเพิ่ม พลาดกลางทางแล้วสิทธิ์จะค้างครึ่ง ๆ กลาง ๆ
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
    // ตรวจว่าหอที่ส่งมามีอยู่จริงครบทุกอัน ไม่ครบแปลว่ารายการในหน้าจอเก่าไปแล้ว
    if (properties.length !== input.propertyIds.length) {
      throw new ApiError(400, "มีหอพักที่ไม่พบ กรุณาโหลดรายการใหม่");
    }

    // ลบสิทธิ์ที่ไม่อยู่ในรายการใหม่ แล้วค่อยเพิ่มที่ขาด ผลลัพธ์จะตรงกับรายการที่ส่งมาพอดี
    await database.propertyMembership.deleteMany({
      where: { userId: account.id, propertyId: { notIn: input.propertyIds } },
    });
    if (input.propertyIds.length) {
      await database.propertyMembership.createMany({
        data: input.propertyIds.map((propertyId) => ({ userId: account.id, propertyId })),
        // skipDuplicates เพราะสิทธิ์ที่มีอยู่แล้วไม่ได้ถูกลบไปในขั้นก่อนหน้า
        skipDuplicates: true,
      });
    }

    // ตัด session ทิ้งด้วย เพราะสิทธิ์ถูกอ่านตอนเข้าสู่ระบบ ไม่ตัดแล้วจะยังเข้าหอเดิมได้จนกว่า session จะหมดอายุ
    await database.session.deleteMany({ where: { userId: account.id } });
    return database.user.findUniqueOrThrow({
      where: { id: account.id },
      select: {
        id: true,
        memberships: { select: { property: { select: { id: true, name: true } } } },
      },
    });
  // Serializable เพราะเป็นเรื่องสิทธิ์ ยอมให้คำขอสองอันทำงานสลับกันจนผลเพี้ยนไม่ได้
  }, { isolationLevel: "Serializable" });
}
