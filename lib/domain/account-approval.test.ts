/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “account approval.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { reviewAccountApprovalSchema } from "@/lib/domain/account-approval";

describe("account approval validation", () => {
  it("accepts approval without a rejection reason", () => {
    expect(reviewAccountApprovalSchema.parse({ status: "APPROVED" })).toEqual({ status: "APPROVED" });
  });

  it("requires a reason when rejecting an account", () => {
    expect(() => reviewAccountApprovalSchema.parse({ status: "REJECTED" })).toThrow();
    expect(reviewAccountApprovalSchema.parse({
      status: "REJECTED",
      rejectionReason: "ข้อมูลผู้สมัครไม่ครบถ้วน",
    })).toMatchObject({ status: "REJECTED" });
  });

  it("rejects unknown fields and reasons attached to approval", () => {
    expect(() => reviewAccountApprovalSchema.parse({
      status: "APPROVED",
      rejectionReason: "not applicable",
    })).toThrow();
    expect(() => reviewAccountApprovalSchema.parse({ status: "APPROVED", isActive: true })).toThrow();
  });
});
