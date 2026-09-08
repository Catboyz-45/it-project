/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “tenant invoice view.test” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

import { describe, expect, it } from "vitest";
import {
  TENANT_INVOICE_VIEW_STATUSES,
  TENANT_PARCEL_VIEW_STATUSES,
  TENANT_TICKET_VIEW_STATUSES,
} from "@/lib/tenant-record-view";

describe("tenant invoice views", () => {
  it("keeps actionable invoices separate from completed history", () => {
    expect(TENANT_INVOICE_VIEW_STATUSES.current).toEqual(["PENDING", "OVERDUE"]);
    expect(TENANT_INVOICE_VIEW_STATUSES.history).toEqual(["PAID", "CANCELLED"]);
  });

  it("does not expose invoice drafts to tenants", () => {
    const tenantVisibleStatuses = Object.values(TENANT_INVOICE_VIEW_STATUSES).flat();

    expect(tenantVisibleStatuses).not.toContain("DRAFT");
  });

  it("separates parcel and ticket histories from actionable records", () => {
    expect(TENANT_PARCEL_VIEW_STATUSES).toEqual({ current: ["WAITING"], history: ["RECEIVED"] });
    expect(TENANT_TICKET_VIEW_STATUSES).toEqual({
      current: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"],
      history: ["RESOLVED", "CANCELLED"],
    });
  });
});
