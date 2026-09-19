import { getDatabase } from "@/lib/server/db";

// รวมคำสั่งฐานข้อมูลของหอพักไว้ที่เดียว route ไม่ต้องเขียน query เอง
export const propertyRepository = {
// ดึงข้อมูลหอพร้อมจำนวนอาคาร ห้อง และการเข้าพัก ในคำสั่งเดียว
// ใช้ _count แทนการดึงแถวมานับเอง เพราะเร็วกว่าและไม่ต้องส่งข้อมูลที่ไม่ได้ใช้
findWorkspace(propertyId: string) {
    return getDatabase().property.findUnique({
      where: { id: propertyId },
      select: {
        id: true, name: true, shortName: true, isActive: true,
        settings: true, subscription: true,
        _count: { select: { buildings: true, rooms: true, occupancies: true } },
      },
    });
  },
// แก้ได้แค่ชื่อกับชื่อย่อ ระบุฟิลด์ไว้ชัด กันการแอบส่งฟิลด์อื่นมาแก้
updateIdentity(propertyId: string, data: { name?: string; shortName?: string }) {
    return getDatabase().property.update({
      where: { id: propertyId },
      data,
      select: { id: true, name: true, shortName: true, isActive: true },
    });
  },
// upsert เพราะหอที่เพิ่งสร้างยังไม่มีแถวการตั้งค่า
// ดึงชนิดมาจาก Prisma โดยตรง จะได้ไม่ต้องมาตามแก้เองทุกครั้งที่ schema เปลี่ยน
upsertSettings(propertyId: string, data: Parameters<ReturnType<typeof getDatabase>["propertySettings"]["upsert"]>[0]["create"]) {
    return getDatabase().propertySettings.upsert({
      where: { propertyId },
      create: data,
      update: data,
    });
  },
};
