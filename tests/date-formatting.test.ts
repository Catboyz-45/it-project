/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ date-formatting.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { formatThaiDate, toIsoDate, toValidDate } from "@/lib/date";

describe("date formatting", () => {
  it("accepts Date objects and serialized ISO dates from the Next.js cache", () => {
    const iso = "2026-08-01T00:00:00.000Z";
    expect(toIsoDate(new Date(iso))).toBe(iso);
    expect(toIsoDate(iso)).toBe(iso);
    expect(formatThaiDate(iso)).toBeTruthy();
  });

  it("fails safely for missing or malformed values", () => {
    expect(toValidDate("not-a-date")).toBeNull();
    expect(formatThaiDate("not-a-date")).toBeUndefined();
    expect(toIsoDate(null)).toBeUndefined();
  });
});
