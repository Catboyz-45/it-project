import { describe, expect, it } from "vitest";
import { daysPastDue, describeInvoiceDue } from "@/lib/domain/invoice-due";

// วันนี้ตามปฏิทินเครื่อง ใช้ new Date(ปี, เดือน, วัน) จะได้ไม่ขึ้นกับเขตเวลาของเครื่องที่รันเทสต์
const today = new Date(2026, 10, 1, 9, 30);

describe("invoice due helpers", () => {
  it("counts whole calendar days past the due date", () => {
    expect(daysPastDue("2026-10-05T00:00:00.000Z", today)).toBe(27);
    expect(daysPastDue("2026-11-01T00:00:00.000Z", today)).toBe(0);
    expect(daysPastDue("2026-11-04T00:00:00.000Z", today)).toBe(-3);
  });

  it("describes late, due today, soon and later bills", () => {
    expect(describeInvoiceDue("2026-10-05T00:00:00.000Z", today)).toEqual({ isLate: true, text: "เลยกำหนด 27 วัน" });
    expect(describeInvoiceDue("2026-11-01T00:00:00.000Z", today)).toEqual({ isLate: false, text: "ครบกำหนดวันนี้" });
    expect(describeInvoiceDue("2026-11-03T00:00:00.000Z", today)).toEqual({ isLate: false, text: "อีก 2 วันครบกำหนด" });
    expect(describeInvoiceDue("2026-11-20T00:00:00.000Z", today).text).toMatch(/^ครบกำหนด 20 พ\.ย\. 2569$/);
  });
});
