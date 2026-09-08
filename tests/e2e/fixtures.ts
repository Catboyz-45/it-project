/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “fixtures” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

export const e2e = {
  propertyId: "cm000000000000000000001",
  ownerId: "cm000000000000000000002",
  tenantUserId: "cm000000000000000000003",
  tenantProfileId: "cm000000000000000000004",
  pendingUserId: "cm000000000000000000005",
  pendingProfileId: "cm000000000000000000006",
  superAdminId: "cm000000000000000000023",
  activeRoomId: "cm000000000000000000007",
  pendingRoomId: "cm000000000000000000008",
  ownerEmail: "e2e-owner@example.test",
  tenantEmail: "e2e-tenant@example.test",
  superAdminEmail: "e2e-super-admin@example.test",
  password: "E2E-Password-Strong-123",
} as const;
