import { describe, expect, it } from "vitest";
import { formatAuditAction, formatAuditResult, formatStatus, formatVehicleType, roomTypeLabel } from "@/lib/ui-labels";

describe("UI labels", () => {
  // ผู้ใช้ต้องไม่เห็นค่าดิบอย่าง PENDING_REVIEW และค่าที่ยังไม่ได้แปลก็ต้องมีคำสำรองรองรับ
  it("does not expose raw status enums", () => {
    expect(formatStatus("PENDING_REVIEW")).toBe("รอตรวจสอบ");
    expect(formatStatus("STATUS_NOT_YET_SUPPORTED")).toBe("สถานะอื่น");
  });

  it("translates audit actions and keeps unknown actions generic", () => {
    expect(formatAuditAction("AUTH_LOGIN")).toBe("เข้าสู่ระบบ");
    expect(formatAuditAction("STATUS_CHANGED")).toBe("เหตุการณ์ระบบ");
    expect(formatAuditAction("API_PATCH_FAILURE")).toBe("ดำเนินการกับข้อมูลไม่สำเร็จ");
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
});
