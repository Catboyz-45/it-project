import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

// รวมคำสั่งฐานข้อมูลของผู้เช่าไว้ที่เดียว route ไม่ต้องเขียน query เอง
export const tenantRepository = {
async list(propertyId: string, pagination: PaginationInput, query?: string) {
    const normalizedQuery = query?.trim();
    const rows = await getDatabase().roomOccupancy.findMany({
      where: {
        propertyId,
        // รวมที่ยังรออนุมัติด้วย เพราะหน้าผู้เช่าต้องแสดงคำขอที่รอตรวจให้เจ้าของหอเห็น
        status: { in: ["PENDING", "ACTIVE"] },
        ...(normalizedQuery ? {
          OR: [
            { room: { number: { contains: normalizedQuery, mode: "insensitive" } } },
            // เบอร์โทรไม่ต้องใส่ insensitive เพราะเป็นตัวเลขล้วน
            { tenantProfile: { phone: { contains: normalizedQuery } } },
            { tenantProfile: { user: { displayName: { contains: normalizedQuery, mode: "insensitive" } } } },
            { tenantProfile: { user: { email: { contains: normalizedQuery, mode: "insensitive" } } } },
          ],
        } : {}),
      },
      // เรียงตามห้อง แล้วผู้เช่าหลักก่อนผู้พักร่วม และใช้ id เป็นตัวตัดสินสุดท้าย ลำดับจะได้คงที่ทุกหน้า
      orderBy: [{ room: { number: "asc" } }, { role: "asc" }, { id: "asc" }],
      ...paginationQuery(pagination),
      select: {
        id: true, role: true, status: true, startedAt: true, createdAt: true,
        room: {
          select: {
            id: true, number: true, monthlyRent: true, depositAmount: true,
            // ดึงคนอื่นที่อยู่ห้องเดียวกันมาด้วย เพื่อให้หน้าจอแสดงได้ว่าห้องนี้มีใครบ้าง
            occupancies: {
              where: { status: "ACTIVE" },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
              select: {
                id: true, role: true,
                tenantProfile: { select: { id: true, user: { select: { displayName: true } } } },
              },
            },
          },
        },
        tenantProfile: {
          select: {
            id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
            vehicle: true,
            user: { select: { id: true, displayName: true, email: true, isActive: true } },
          },
        },
        // เอาสัญญาล่าสุดฉบับเดียว ห้องหนึ่งมีสัญญาหลายฉบับสะสมได้จากการต่ออายุ
        leases: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            lease: {
              select: {
                leaseNumber: true, status: true, startDate: true, endDate: true,
                monthlyRent: true, depositAmount: true,
              },
            },
          },
        },
      },
    });
    return toPaginatedResult(rows, pagination);
  },
find(propertyId: string, tenantProfileId: string) {
    return getDatabase().tenantProfile.findFirst({
      where: { id: tenantProfileId, occupancies: { some: { propertyId } } },
      select: {
        id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
        vehicle: true,
        user: { select: { id: true, displayName: true, email: true, isActive: true } },
        occupancies: {
          where: { propertyId }, orderBy: { createdAt: "desc" },
          select: { id: true, role: true, status: true, startedAt: true, endedAt: true, room: { select: { id: true, number: true } } },
        },
      },
    });
  },
};
