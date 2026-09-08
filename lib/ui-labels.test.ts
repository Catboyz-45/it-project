/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “ui labels.test” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

import { describe, expect, it } from "vitest";
import { formatAuditAction, formatAuditResult, formatStatus } from "@/lib/ui-labels";

describe("UI labels", () => {
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
});
