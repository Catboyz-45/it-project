import { describe, expect, it } from "vitest";
import {
  acceptTenantInvitationSchema,
  createInvitationSchema,
  reviewOccupancySchema,
  selectTenantOccupancySchema,
  tenantRegistrationSchema,
} from "@/lib/domain/tenant-onboarding";

describe("tenant onboarding validation", () => {
  // ค่าเริ่มต้นเป็นผู้พักร่วม ไม่ใช่ผู้เช่าหลัก เพราะสิทธิ์น้อยกว่า พลาดแล้วเสียหายน้อยกว่า
  it("limits invitation lifetime and defaults the occupant role", () => {
    const invitation = createInvitationSchema.parse({
      roomId: "cm12345678901234567890123",
    });
    expect(invitation.intendedRole).toBe("CO_OCCUPANT");
    expect(invitation.expiresInDays).toBe(7);
    expect(createInvitationSchema.safeParse({
      roomId: invitation.roomId,
      expiresInDays: 31,
    }).success).toBe(false);
  });

  it("validates accepting invitations and selecting an occupancy", () => {
    expect(acceptTenantInvitationSchema.safeParse({
      invitationCode: "a".repeat(32),
    }).success).toBe(true);
    expect(acceptTenantInvitationSchema.safeParse({ invitationCode: "short" }).success).toBe(false);
    expect(selectTenantOccupancySchema.safeParse({
      occupancyId: "cm000000000000000000001",
    }).success).toBe(true);
  });

  // รหัสที่มีแต่ตัวพิมพ์เล็กต้องไม่ผ่าน และช่องยอมรับข้อกำหนดส่ง false มาก็ไม่ผ่าน ไม่ใช่แค่ต้องส่งมา
  it("requires a strong tenant password", () => {
    const base = {
      invitationCode: "a".repeat(43),
      email: "tenant@example.com",
      displayName: "ผู้เช่าทดลอง",
      phone: "0812345678",
      termsAccepted: true as const,
      privacyAcknowledged: true as const,
      marketingConsent: false,
    };
    expect(tenantRegistrationSchema.safeParse({ ...base, password: "weakpassword" }).success).toBe(false);
    expect(tenantRegistrationSchema.safeParse({ ...base, password: "StrongPassword1" }).success).toBe(true);
    expect(tenantRegistrationSchema.safeParse({ ...base, password: "StrongPassword1", termsAccepted: false }).success).toBe(false);
  });

  // ตั้งกลับเป็นรออนุมัติไม่ได้ ผลการตรวจมีแค่ผ่านหรือไม่ผ่าน
  it("allows only approval or rejection during review", () => {
    expect(reviewOccupancySchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(reviewOccupancySchema.safeParse({ status: "PENDING" }).success).toBe(false);
  });
});
