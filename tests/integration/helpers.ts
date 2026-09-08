/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “helpers” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { currentPolicyVersions } from "@/lib/legal/policies";

const acceptedPolicies = {
  createMany: {
    data: [
      { policyType: "TERMS_OF_SERVICE" as const, action: "ACCEPTED" as const, documentVersion: currentPolicyVersions.terms, source: "REQUIRED_GATE" as const },
      { policyType: "PRIVACY_NOTICE" as const, action: "ACKNOWLEDGED" as const, documentVersion: currentPolicyVersions.privacy, source: "REQUIRED_GATE" as const },
    ],
  },
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Test Database” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function assertTestDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for integration tests");
  const url = new URL(value);
  if (!/test/i.test(url.pathname)) {
    throw new Error("Integration tests require a dedicated database whose name contains 'test'");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Integration Fixture” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createIntegrationFixture() {
  assertTestDatabase();
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await hashPassword("Integration-Password-123");
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “cleanup Integration Fixture” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function cleanupIntegrationFixture(input: {
  propertyIds: string[];
  userIds: string[];
}) {
  const propertyId = { in: input.propertyIds };
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
    await database.tenantProfile.deleteMany({ where: { userId: { in: input.userIds } } });
    await database.user.deleteMany({ where: { id: { in: input.userIds } } });
  });
}
