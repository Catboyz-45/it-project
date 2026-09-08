/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property structure.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import {
  createBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
} from "@/lib/domain/property-structure";

describe("property structure validation", () => {
  it("rejects duplicate floors in a building request", () => {
    const result = createBuildingSchema.safeParse({
      name: "อาคาร A",
      code: "A",
      floors: [{ number: 1 }, { number: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("normalizes room money and defaults", () => {
    const room = createRoomSchema.parse({
      buildingId: "cm12345678901234567890123",
      floorId: "cm12345678901234567890124",
      number: " A-101 ",
      roomType: "ห้องแอร์",
      monthlyRent: "3500",
    });
    expect(room).toMatchObject({
      number: "A-101",
      monthlyRent: 3500,
      depositAmount: 0,
      capacity: 1,
      furniture: [],
    });
  });

  it("prevents setting occupied status outside occupancy workflow", () => {
    expect(updateRoomSchema.safeParse({ status: "OCCUPIED" }).success).toBe(false);
    expect(updateRoomSchema.parse({ status: "MAINTENANCE" }).status).toBe("MAINTENANCE");
  });
});
