/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “navigation routes.test” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

import { describe, expect, it } from "vitest";
import {
  ownerPageFromSegments,
  ownerPagePath,
  tenantPagePath,
  tenantTabFromSegments,
} from "@/lib/navigation-routes";

describe("URL navigation routes", () => {
  it("maps owner pages to stable property-scoped URLs", () => {
    expect(ownerPagePath("property-1", "overview")).toBe("/admin/properties/property-1");
    expect(ownerPagePath("property-1", "settings")).toBe("/admin/properties/property-1/settings");
    expect(ownerPagePath("property-1", "waterMeter")).toBe("/admin/properties/property-1/meters/water");
    expect(ownerPageFromSegments(["tickets", "history"])).toBe("repairHistory");
    expect(ownerPageFromSegments(["unknown"])).toBeNull();
  });

  it("maps tenant tabs to stable URLs", () => {
    expect(tenantPagePath("home")).toBe("/tenant");
    expect(tenantPagePath("invoices")).toBe("/tenant/invoices");
    expect(tenantTabFromSegments(["lease"])).toBe("lease");
    expect(tenantTabFromSegments(["unknown"])).toBeNull();
  });
});
