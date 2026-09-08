/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “dashboard read model” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { OwnerWorkspaceReadModel } from "@/types/dashboard";
import { getDatabase } from "@/lib/server/db";

// The dashboard is a workspace snapshot, not a history/export endpoint. Keep
// every collection in this projection bounded; complete datasets are available
// through their paginated resource APIs.
const DASHBOARD_ROOM_LIMIT = 1_200;
const DASHBOARD_OCCUPANCY_LIMIT = 2_400;
const DASHBOARD_INVOICE_LIMIT = 1_200;
const DASHBOARD_METER_READING_LIMIT = DASHBOARD_ROOM_LIMIT * 2;
const DASHBOARD_CONFIG_LIMIT = 200;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Dashboard Read Model” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<OwnerWorkspaceReadModel> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function getDashboardReadModel(propertyId: string): Promise<OwnerWorkspaceReadModel> {
  // This transitional workspace projection is intentionally bounded. Full
  // history belongs to the paginated resource APIs, not the dashboard payload.
  const now = new Date();
  const invoiceHistoryStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [property, rooms, occupancies, invoices, readings] = await Promise.all([
    getDatabase().property.findUnique({ where: { id: propertyId }, select: {
      name: true, settings: true,
      buildings: {
        where: { isActive: true },
        orderBy: { code: "asc" },
        take: DASHBOARD_CONFIG_LIMIT,
        include: { floors: { orderBy: { number: "asc" }, take: DASHBOARD_CONFIG_LIMIT } },
      },
      roomTypeConfigs: { orderBy: { name: "asc" }, take: DASHBOARD_CONFIG_LIMIT },
      serviceCharges: { orderBy: { name: "asc" }, take: DASHBOARD_CONFIG_LIMIT },
      furnitureOptions: { orderBy: { name: "asc" }, take: DASHBOARD_CONFIG_LIMIT },
    } }),
    getDatabase().room.findMany({ where: { propertyId, status: { not: "INACTIVE" } }, orderBy: [{ floor: { number: "asc" } }, { number: "asc" }], include: {
      floor: { select: { id: true, number: true } },
      building: { select: { id: true, name: true } },
      furnitureItems: {
        orderBy: { furnitureOption: { name: "asc" } },
        include: { furnitureOption: true },
      },
    }, take: DASHBOARD_ROOM_LIMIT }),
    getDatabase().roomOccupancy.findMany({
      where: { propertyId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      take: DASHBOARD_OCCUPANCY_LIMIT,
      include: {
        tenantProfile: { include: { user: true, vehicle: true } },
        room: true,
        leases: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            lease: {
              select: {
                leaseNumber: true, status: true, startDate: true, endDate: true,
                monthlyRent: true, depositAmount: true,
              },
            },
          },
        },
      },
    }),
    getDatabase().invoice.findMany({
      where: { propertyId, billingMonth: { gte: invoiceHistoryStart } },
      orderBy: { billingMonth: "asc" },
      take: DASHBOARD_INVOICE_LIMIT,
      include: { room: true, items: true },
    }),
    getDatabase().meterReading.findMany({
      where: { propertyId },
      orderBy: { billingMonth: "desc" },
      distinct: ["roomId", "type"],
      take: DASHBOARD_METER_READING_LIMIT,
    }),
  ]);
  if (!property) throw new Error("Property not found");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “latest Reading” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - roomId: รหัสภายในของห้องพัก
   * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const latestReading = (roomId: string, type: "WATER" | "ELECTRICITY") =>
    readings.find((item) => item.roomId === roomId && item.type === type);
  const primaryByRoom = new Map(occupancies.filter((item) => item.role === "PRIMARY").map((item) => [item.roomId, item]));
  const activeOccupantsByRoom = new Map<string, typeof occupancies>();
  for (const occupancy of occupancies) {
    const roomOccupants = activeOccupantsByRoom.get(occupancy.roomId) ?? [];
    roomOccupants.push(occupancy);
    activeOccupantsByRoom.set(occupancy.roomId, roomOccupants);
  }
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “ui Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const uiRooms = rooms.map((room) => ({
    id: room.number,
    databaseId: room.id,
    buildingId: room.building.id,
    buildingName: room.building.name,
    floorId: room.floor.id,
    floor: room.floor.number,
    rent: Number(room.monthlyRent),
    roomType: room.roomType,
    furniture: room.furnitureItems.map((item) => item.furnitureOption.name),
    status: room.status === "OCCUPIED" ? "occupied" as const : room.status === "MAINTENANCE" ? "maintenance" as const : "available" as const,
    tenantId: primaryByRoom.get(room.id)?.tenantProfileId,
    waterMeter: Number(latestReading(room.id, "WATER")?.currentReading ?? 0),
    electricMeter: Number(latestReading(room.id, "ELECTRICITY")?.currentReading ?? 0),
  }));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “ui Tenants” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const uiTenants = occupancies.map((item) => {
    const lease = item.leases[0]?.lease;
    const vehicle = item.tenantProfile.vehicle;
    const vehicleType = vehicle?.type === "MOTORCYCLE" ? "รถจักรยานยนต์"
      : vehicle?.type === "CAR" ? "รถยนต์"
        : vehicle?.type === "BICYCLE" ? "รถจักรยาน"
          : vehicle?.type === "OTHER" ? "อื่น ๆ"
            : "ไม่มีรถ";
    return {
      id: item.tenantProfileId,
      role: item.role,
      name: item.tenantProfile.user.displayName,
      phone: item.tenantProfile.phone,
      email: item.tenantProfile.user.email,
      roomId: item.room.number,
      address: item.tenantProfile.address ?? "",
      guardianName: item.tenantProfile.emergencyName ?? "",
      guardianPhone: item.tenantProfile.emergencyPhone ?? "",
      occupantCount: activeOccupantsByRoom.get(item.roomId)?.length ?? 1,
      coOccupants: (activeOccupantsByRoom.get(item.roomId) ?? [])
        .filter((occupancy) => occupancy.tenantProfileId !== item.tenantProfileId)
        .map((occupancy) => ({
          id: occupancy.tenantProfileId,
          name: occupancy.tenantProfile.user.displayName,
          role: occupancy.role,
        })),
      vehicleType,
      vehiclePlate: vehicle?.licensePlate ?? "",
      vehicleProvince: vehicle?.province ?? "",
      vehicleBrand: vehicle?.brandModel ?? "",
      vehicleColor: vehicle?.color ?? "",
      vehicleDetail: vehicle?.detail ?? "",
      startDate: (lease?.startDate ?? item.startedAt ?? item.createdAt).toISOString().slice(0, 10),
      contractEnd: lease?.endDate.toISOString().slice(0, 10),
      deposit: Number(lease?.depositAmount ?? item.room.depositAmount),
      monthlyRent: Number(lease?.monthlyRent ?? item.room.monthlyRent),
      leaseNumber: lease?.leaseNumber,
      leaseStatus: lease?.status,
    };
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “item Amount” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const itemAmount = (invoice: typeof invoices[number], type: string) =>
    Number(invoice.items.find((item) => item.type === type)?.amount ?? 0);
  return {
    rooms: uiRooms,
    tenants: uiTenants,
    invoices: invoices.map((invoice) => ({
      id: invoice.invoiceNumber,
      databaseId: invoice.id,
      version: invoice.version,
      roomId: invoice.room.number,
      tenantName: primaryByRoom.get(invoice.roomId)?.tenantProfile.user.displayName ?? "-",
      month: invoice.billingMonth.toISOString().slice(0, 7),
      rent: itemAmount(invoice, "RENT"),
      water: itemAmount(invoice, "WATER"),
      electricity: itemAmount(invoice, "ELECTRICITY"),
      service: invoice.items.filter((item) => !["RENT", "WATER", "ELECTRICITY"].includes(item.type)).reduce((sum, item) => sum + Number(item.amount), 0),
      status: invoice.status === "DRAFT" ? "draft" : invoice.status === "PAID" ? "paid" : invoice.status === "OVERDUE" ? "overdue" : invoice.status === "CANCELLED" ? "cancelled" : "pending",
    })),
    repairs: [],
    complaints: [],
    parcels: [],
    announcements: [],
    settings: property.settings ? {
      propertyName: property.name,
      legalName: property.settings.legalName ?? "",
      address: property.settings.address,
      contactPhone: property.settings.contactPhone,
      contactEmail: property.settings.contactEmail ?? "",
      promptPayId: property.settings.promptPayId ?? "",
      waterExtraRate: Number(property.settings.waterUnitRate),
      electricityUnitRate: Number(property.settings.electricityUnitRate),
      invoicePrefix: property.settings.invoicePrefix,
      meterReadDay: property.settings.billingDay,
      dueDay: property.settings.dueDay,
      lateFeePerDay: Number(property.settings.lateFeePerDay),
      lateFeeCap: property.settings.lateFeeCap === null ? null : Number(property.settings.lateFeeCap),
      invoiceFooter: property.settings.invoiceFooter ?? "",
      floorDirectory: property.buildings.flatMap((building) => building.floors.map((floor) => ({
        id: floor.id, number: floor.number, buildingId: building.id, buildingName: building.name,
      }))),
      roomTypes: property.roomTypeConfigs.map((item) => ({
        id: item.id, name: item.name, rent: Number(item.monthlyRent),
        deposit: Number(item.depositAmount), capacity: item.capacity,
      })),
      serviceCharges: property.serviceCharges.map((item) => ({
        id: item.id, name: item.name, amount: Number(item.amount),
        frequency: item.frequency.toLowerCase() as "monthly" | "once",
        calculation: item.calculation.toLowerCase() as "room" | "person",
      })),
      furnitureOptions: property.furnitureOptions.map((item) => item.name),
      defaultFurniture: property.furnitureOptions.filter((item) => item.isDefault).map((item) => item.name),
    } : {
      propertyName: property.name,
      floorDirectory: [],
      roomTypes: [],
      serviceCharges: [],
      furnitureOptions: [],
      defaultFurniture: [],
    },
  };
}
