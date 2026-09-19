import { describe, expect, it } from "vitest";
import {
  createBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
} from "@/lib/domain/property-structure";

describe("property structure validation", () => {
  // ชั้นซ้ำต้องไม่ผ่าน เพราะเลขห้องในระบบอ้างอิงจากเลขชั้น ซ้ำแล้วจะแยกห้องไม่ออก
  it("rejects duplicate floors in a building request", () => {
    const result = createBuildingSchema.safeParse({
      name: "อาคาร A",
      code: "A",
      floors: [{ number: 1 }, { number: 1 }],
    });
    expect(result.success).toBe(false);
  });

  // ตัดช่องว่างรอบเลขห้อง แปลงราคาจากสตริงเป็นตัวเลข และเติมค่าเริ่มต้นให้ช่องที่ไม่ได้กรอก
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

  // ตั้งห้องเป็นมีผู้เช่าตรง ๆ ไม่ได้ ต้องผ่านขั้นตอนเพิ่มผู้เช่า ไม่งั้นห้องจะมีสถานะที่ไม่ตรงกับข้อมูลจริง
  it("prevents setting occupied status outside occupancy workflow", () => {
    expect(updateRoomSchema.safeParse({ status: "OCCUPIED" }).success).toBe(false);
    expect(updateRoomSchema.parse({ status: "MAINTENANCE" }).status).toBe("MAINTENANCE");
  });
});
