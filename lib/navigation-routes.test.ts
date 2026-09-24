import { describe, expect, it } from "vitest";
import {
  ownerPageFromSegments,
  ownerPagePath,
  roleHomePath,
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
    // ไม่มี segment เลยคือ /tenant เฉย ๆ ต้องเป็นหน้าแรก ไม่ใช่ null
    expect(tenantTabFromSegments(undefined)).toBe("home");
    expect(tenantTabFromSegments([])).toBe("home");
  });

  // ใช้ตอนเด้งผู้ใช้ที่เข้าผิดพื้นที่กลับบ้านตัวเอง บทบาทที่ไม่รู้จักต้องไม่หลุดไปฝั่งผู้ดูแลระบบ
  it("sends each role to its own home", () => {
    expect(roleHomePath("SUPER_ADMIN")).toBe("/super-admin");
    expect(roleHomePath("TENANT")).toBe("/tenant");
    expect(roleHomePath("ADMIN")).toBe("/admin");
    expect(roleHomePath("STAFF")).toBe("/admin");
  });
});
