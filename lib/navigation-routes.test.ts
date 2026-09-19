import { describe, expect, it } from "vitest";
import {
  ownerPageFromSegments,
  ownerPagePath,
  tenantPagePath,
  tenantTabFromSegments,
} from "@/lib/navigation-routes";

// ทุกหน้ามี URL ของตัวเอง ตัวทดสอบนี้กันไม่ให้เส้นทางเปลี่ยนจนลิงก์ที่คนบันทึกไว้ใช้ไม่ได้
describe("URL navigation routes", () => {
  it("maps owner pages to stable property-scoped URLs", () => {
    expect(ownerPagePath("property-1", "overview")).toBe("/admin/properties/property-1");
    expect(ownerPagePath("property-1", "settings")).toBe("/admin/properties/property-1/settings");
    expect(ownerPagePath("property-1", "waterMeter")).toBe("/admin/properties/property-1/meters/water");
    expect(ownerPageFromSegments(["tickets", "history"])).toBe("repairHistory");
    // เส้นทางที่ไม่รู้จักต้องได้ null ไม่ใช่เดาเป็นหน้าใดหน้าหนึ่ง เพราะค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้
    expect(ownerPageFromSegments(["unknown"])).toBeNull();
  });

  it("maps tenant tabs to stable URLs", () => {
    expect(tenantPagePath("home")).toBe("/tenant");
    expect(tenantPagePath("invoices")).toBe("/tenant/invoices");
    expect(tenantTabFromSegments(["lease"])).toBe("lease");
    expect(tenantTabFromSegments(["unknown"])).toBeNull();
  });
});
