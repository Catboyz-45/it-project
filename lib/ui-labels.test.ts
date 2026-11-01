import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatAuditAction, formatAuditResult, formatStatus, formatVehicleType, roomTypeLabel } from "@/lib/ui-labels";

describe("UI labels", () => {
  // ผู้ใช้ต้องไม่เห็นค่าดิบอย่าง PENDING_REVIEW และค่าที่ยังไม่ได้แปลก็ต้องมีคำสำรองรองรับ
  it("does not expose raw status enums", () => {
    expect(formatStatus("PENDING_REVIEW")).toBe("รอตรวจสอบ");
    expect(formatStatus("STATUS_NOT_YET_SUPPORTED")).toBe("สถานะอื่น");
  });

  // ช่องว่างในฐานข้อมูลต้องขึ้นเป็นขีด ไม่ใช่ช่องว่างเปล่าที่อ่านไม่ออกว่าคืออะไร
  it("shows a dash when there is no status at all", () => {
    expect(formatStatus("")).toBe("-");
    expect(formatStatus(null)).toBe("-");
    expect(formatStatus(undefined)).toBe("-");
  });

  it("translates audit actions and keeps unknown actions generic", () => {
    expect(formatAuditAction("AUTH_LOGIN")).toBe("เข้าสู่ระบบ");
    expect(formatAuditAction("STATUS_CHANGED")).toBe("เหตุการณ์ระบบ");
    expect(formatAuditAction("API_PATCH_FAILURE")).toBe("ดำเนินการกับข้อมูลไม่สำเร็จ");
    expect(formatAuditAction("API_POST_SUCCESS")).toBe("ดำเนินการกับข้อมูลสำเร็จ");
    // GET ไม่เข้ารูปแบบที่ระบบบันทึก จึงต้องตกไปที่คำกลาง ๆ ไม่ใช่โผล่เป็นรหัสดิบ
    expect(formatAuditAction("API_GET_SUCCESS")).toBe("เหตุการณ์ระบบ");
  });

  it("translates audit results", () => {
    expect(formatAuditResult("SUCCESS")).toBe("สำเร็จ");
    expect(formatAuditResult("FAILURE")).toBe("ไม่สำเร็จ");
  });

  // ผู้เช่าที่ไม่ได้แจ้งรถกับผู้เช่าที่แจ้งรหัสประเภทแปลก ๆ ต้องอ่านออกเหมือนกัน
  // ไม่ใช่ช่องว่างหรือรหัสดิบ เพราะคอลัมน์นี้ขึ้นในตารางผู้เช่าทุกแถว
  it("falls back to a readable label for missing or unknown vehicle types", () => {
    expect(formatVehicleType("CAR")).toBe("รถยนต์");
    expect(formatVehicleType("OTHER")).toBe("อื่น ๆ");
    expect(formatVehicleType(null)).toBe("ไม่มีรถ");
    expect(formatVehicleType(undefined)).toBe("ไม่มีรถ");
    expect(formatVehicleType("")).toBe("ไม่มีรถ");
    expect(formatVehicleType("HELICOPTER")).toBe("ไม่มีรถ");
  });

  // ประเภทห้องที่ยังไม่ได้แปลให้แสดงค่าเดิม ดีกว่าโชว์ว่างจนไม่รู้ว่าห้องแบบไหน
  it("keeps unknown room types visible instead of blanking them", () => {
    expect(roomTypeLabel("air")).toBe("ห้องแอร์");
    expect(roomTypeLabel("fan")).toBe("ห้องพัดลม");
    expect(roomTypeLabel("studio")).toBe("studio");
  });

  // ทุกเหตุการณ์ที่โค้ดบันทึกลง audit log ต้องมีคำแปล ไม่งั้นหน้าบันทึกการใช้งานจะขึ้นแค่ "เหตุการณ์ระบบ"
  // ไล่อ่าน action: "..." ที่มีขีดล่างจากโค้ดจริง คำเดี่ยวอย่าง ACCEPTED เป็นสถานะของอย่างอื่น ไม่ใช่เหตุการณ์
  // ไล่อ่านจากโค้ดจริง เพิ่มเหตุการณ์ใหม่แล้วลืมใส่คำแปล เทสต์นี้จะเตือน
  it("has a Thai label for every audit action the code records", () => {
    const root = path.resolve(__dirname, "..");
    const files = ["app", "lib"].flatMap((folder) => readdirSync(path.join(root, folder), { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
      .map((file) => path.join(root, folder, file)));
    const actions = new Set(files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/action: "([A-Z]+_[A-Z0-9_]+)"/g)].map((match) => match[1])));
    const unlabeled = [...actions].filter((action) => formatAuditAction(action) === "เหตุการณ์ระบบ");
    expect(unlabeled).toEqual([]);
  });
});
