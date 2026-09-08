/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “billing cancellation.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { cancelInvoiceSchema } from "@/lib/domain/billing";

describe("invoice cancellation validation", () => {
  it("requires a version and meaningful reason", () => {
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", version: 2, reason: "ออกบิลผิดห้อง" }).success).toBe(true);
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", version: 2, reason: "" }).success).toBe(false);
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", reason: "ออกบิลผิดห้อง" }).success).toBe(false);
  });
});
