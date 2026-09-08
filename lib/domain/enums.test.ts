/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “enums.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import {
  invoiceStatusSchema,
  invoiceStatusTransitions,
  leaseStatusTransitions,
  roomStatusSchema,
  ticketStatusTransitions,
} from "@/lib/domain/enums";

describe("domain enums", () => {
  it("accepts only canonical enum values", () => {
    expect(roomStatusSchema.parse("AVAILABLE")).toBe("AVAILABLE");
    expect(invoiceStatusSchema.safeParse("paid").success).toBe(false);
  });

  it("does not permit reopening terminal states", () => {
    expect(invoiceStatusTransitions.PAID).toEqual([]);
    expect(invoiceStatusTransitions.CANCELLED).toEqual([]);
    expect(leaseStatusTransitions.EXPIRED).toEqual([]);
    expect(ticketStatusTransitions.RESOLVED).toEqual([]);
  });
});
