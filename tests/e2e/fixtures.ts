// รหัสและบัญชีของข้อมูลทดสอบ ตั้งเป็นค่าตายตัวไม่สุ่ม เทสต์จะได้อ้างถึงแถวเดิมได้ทุกครั้ง
// รูปแบบตรงกับ cuid ที่ Prisma ใช้ ฐานข้อมูลจึงรับได้เหมือนรหัสที่สร้างเอง
// ใช้โดเมน .test ซึ่งสงวนไว้ไม่มีอยู่จริง เผลอส่งอีเมลออกไปก็ไม่ถึงใคร
export const e2e = {
  propertyId: "cm000000000000000000001",
  // หอที่สองของเจ้าของหอคนเดียวกัน ไว้ทดสอบการสลับหอและขอบเขตข้อมูลที่ต้องไม่ปนกัน
  // ตั้งชื่อให้เรียงหลังหอแรกตามตัวอักษรไทย หน้า /admin จะได้ยังพาไปหอแรกเหมือนเดิม
  secondPropertyId: "cm000000000000000000024",
  ownerId: "cm000000000000000000002",
  tenantUserId: "cm000000000000000000003",
  tenantProfileId: "cm000000000000000000004",
  pendingUserId: "cm000000000000000000005",
  pendingProfileId: "cm000000000000000000006",
  superAdminId: "cm000000000000000000023",
  activeRoomId: "cm000000000000000000007",
  secondPropertyRoomId: "cm000000000000000000027",
  pendingRoomId: "cm000000000000000000008",
  ownerEmail: "e2e-owner@example.test",
  tenantEmail: "e2e-tenant@example.test",
  superAdminEmail: "e2e-super-admin@example.test",
  password: "E2E-Password-Strong-123",
} as const;
