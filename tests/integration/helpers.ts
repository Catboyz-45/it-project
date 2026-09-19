import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { currentPolicyVersions } from "@/lib/legal/policies";

// บัญชีทดสอบต้องผ่านด่านยอมรับนโยบายมาแล้ว ไม่งั้นจะถูกเด้งไปหน้ายอมรับก่อนทำอย่างอื่น
const acceptedPolicies = {
  createMany: {
    data: [
      { policyType: "TERMS_OF_SERVICE" as const, action: "ACCEPTED" as const, documentVersion: currentPolicyVersions.terms, source: "REQUIRED_GATE" as const },
      { policyType: "PRIVACY_NOTICE" as const, action: "ACKNOWLEDGED" as const, documentVersion: currentPolicyVersions.privacy, source: "REQUIRED_GATE" as const },
    ],
  },
};

// ด่านกันพลาดที่สำคัญที่สุดในไฟล์นี้ ทุกฟังก์ชันที่ลบข้อมูลต้องผ่านตรงนี้ก่อน
// บังคับว่าชื่อฐานข้อมูลต้องมีคำว่า test เผลอชี้ไปฐานจริงจะหยุดทันที
export function assertTestDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for integration tests");
  const url = new URL(value);
  if (!/test/i.test(url.pathname)) {
    throw new Error("Integration tests require a dedicated database whose name contains 'test'");
  }
}

// สร้างชุดข้อมูลตั้งต้นให้เทสต์ หอหนึ่งหอพร้อมตึก ชั้น ห้อง และหออีกหอของคนอื่น
// มีหอที่สองไว้ทดสอบเรื่องสิทธิ์ ว่าเจ้าของหอหนึ่งเข้าถึงข้อมูลของอีกหอไม่ได้
export async function createIntegrationFixture() {
  assertTestDatabase();
  // เติมตัวอักษรสุ่มท้ายทุกชื่อ รันหลายไฟล์พร้อมกันจะได้ไม่ชนกันที่ช่องที่ห้ามซ้ำ
  const suffix = randomUUID().slice(0, 8);
  // แฮชครั้งเดียวแล้วใช้กับทุกบัญชี เพราะการแฮชรหัสผ่านตั้งใจให้ช้าเพื่อความปลอดภัย
  const passwordHash = await hashPassword("Integration-Password-123");
  // สร้างสามบัญชีพร้อมกัน ไม่มีอันไหนต้องรอผลของอีกอัน
  const [owner, otherOwner, superAdmin] = await Promise.all([
    getDatabase().user.create({
      data: { email: `owner-${suffix}@example.test`, passwordHash, displayName: "Owner", role: "PROPERTY_ADMIN", approvalStatus: "APPROVED", policyActions: acceptedPolicies },
    }),
    getDatabase().user.create({
      data: { email: `other-${suffix}@example.test`, passwordHash, displayName: "Other Owner", role: "PROPERTY_ADMIN", approvalStatus: "APPROVED", policyActions: acceptedPolicies },
    }),
    getDatabase().user.create({
      data: { email: `super-${suffix}@example.test`, passwordHash, displayName: "Super Admin", role: "SUPER_ADMIN", approvalStatus: "APPROVED", policyActions: acceptedPolicies },
    }),
  ]);
  const [property, otherProperty] = await Promise.all([
    getDatabase().property.create({
      data: {
        name: `Integration Property ${suffix}`, shortName: `IT-${suffix}`,
        memberships: { create: { userId: owner.id } },
        settings: {
          create: {
            address: "1 Integration Road", contactPhone: "0800000000", promptPayId: "0812345678",
            waterUnitRate: 18, electricityUnitRate: 7, billingDay: 1, dueDay: 5,
            lateFeePerDay: 20, lateFeeCap: 200, invoicePrefix: `IT${suffix}`.slice(0, 20),
          },
        },
      },
    }),
    getDatabase().property.create({
      data: {
        name: `Other Property ${suffix}`, shortName: `OTHER-${suffix}`,
        memberships: { create: { userId: otherOwner.id } },
      },
    }),
  ]);
  // ตึก ชั้น ห้อง ต้องสร้างตามลำดับ เพราะอันหลังต้องใช้รหัสของอันก่อนหน้า
  const building = await getDatabase().building.create({
    data: {
      propertyId: property.id, name: "Building A", code: `A-${suffix}`,
      floors: { create: { propertyId: property.id, number: 1, label: "Floor 1" } },
    },
    include: { floors: true },
  });
  const room = await getDatabase().room.create({
    data: {
      propertyId: property.id, buildingId: building.id, floorId: building.floors[0].id,
      number: `A-${suffix}`, roomType: "Standard", monthlyRent: 3500, depositAmount: 7000, capacity: 2,
    },
  });
  return { suffix, owner, otherOwner, superAdmin, property, otherProperty, building, floor: building.floors[0], room };
}

// ลบข้อมูลที่เทสต์สร้างทิ้งให้หมด ฐานทดสอบจะได้ไม่บวมและไม่มีของค้างไปกวนรอบหน้า
export async function cleanupIntegrationFixture(input: {
  propertyIds: string[];
  userIds: string[];
}) {
  const propertyId = { in: input.propertyIds };
  // ลบทั้งหมดใน transaction เดียว พลาดกลางทางจะย้อนคืนหมด ไม่เหลือข้อมูลลบไปครึ่งเดียว
  // ลำดับสำคัญมาก ต้องลบจากตารางลูกขึ้นไปหาตารางแม่ ไม่งั้นติด foreign key
  await getDatabase().$transaction(async (database) => {
    await database.paymentSubmission.deleteMany({ where: { propertyId } });
    await database.invoiceItem.deleteMany({ where: { invoice: { propertyId } } });
    await database.invoice.deleteMany({ where: { propertyId } });
    await database.meterReading.deleteMany({ where: { propertyId } });
    await database.leaseTenant.deleteMany({ where: { lease: { propertyId } } });
    await database.leaseVersion.deleteMany({ where: { lease: { propertyId } } });
    await database.lease.deleteMany({ where: { propertyId } });
    await database.ticketAttachment.deleteMany({ where: { ticket: { propertyId } } });
    await database.serviceTicket.deleteMany({ where: { propertyId } });
    await database.parcel.deleteMany({ where: { propertyId } });
    await database.announcementRoom.deleteMany({ where: { announcement: { propertyId } } });
    await database.announcement.deleteMany({ where: { propertyId } });
    await database.chatMessage.deleteMany({ where: { propertyId } });
    await database.chatConversation.deleteMany({ where: { propertyId } });
    await database.occupancyTransition.deleteMany({ where: { propertyId } });
    await database.roomOccupancy.deleteMany({ where: { propertyId } });
    await database.tenantInvitation.deleteMany({ where: { propertyId } });
    await database.room.deleteMany({ where: { propertyId } });
    await database.floor.deleteMany({ where: { propertyId } });
    await database.building.deleteMany({ where: { propertyId } });
    await database.propertySubscription.deleteMany({ where: { propertyId } });
    await database.propertySettings.deleteMany({ where: { propertyId } });
    await database.propertyMembership.deleteMany({ where: { propertyId } });
    await database.property.deleteMany({ where: { id: propertyId } });
    // ลบผู้ใช้เป็นอันสุดท้าย เพราะแทบทุกตารางอ้างถึงผู้ใช้
    await database.tenantProfile.deleteMany({ where: { userId: { in: input.userIds } } });
    await database.user.deleteMany({ where: { id: { in: input.userIds } } });
  });
}
