import { describe, expect, it } from "vitest";
import { currentThaiMonth, formatBankAccount, formatThaiDate, formatThaiDateTime, formatThaiMonth, formatThaiPhone, recentMonths, thaiMonthOptions } from "@/lib/thai-format";

describe("thai formatting", () => {
  it("groups bank account numbers the way passbooks print them", () => {
    expect(formatBankAccount("9876543210")).toBe("987-6-54321-0");
    expect(formatBankAccount("987-654-3210")).toBe("987-6-54321-0");
    expect(formatBankAccount("020012345678")).toBe("0200-1234-5678");
    expect(formatBankAccount("12345")).toBe("12345");
    expect(formatBankAccount(null)).toBe("");
  });

  it("groups mobile, Bangkok and provincial phone numbers", () => {
    expect(formatThaiPhone("0891234567")).toBe("089-123-4567");
    expect(formatThaiPhone("021234567")).toBe("02-123-4567");
    expect(formatThaiPhone("+66992844585")).toBe("099-284-4585");
    expect(formatThaiPhone("053123456")).toBe("053-123-456");
    expect(formatThaiPhone("+66 89 123 4567")).toBe("089-123-4567");
    expect(formatThaiPhone("+1 415 555 0100")).toBe("+1 415 555 0100");
  });

  it("writes Thai short dates, times without seconds and month names", () => {
    // ระบุเขตเวลาไทยในค่า ผลจะไม่ขึ้นกับเขตเวลาของเครื่องที่รันเทสต์
    const value = new Date("2026-07-04T06:46:40+07:00");
    expect(formatThaiDate(value)).toBe("4 ก.ค. 2569");
    expect(formatThaiDateTime(value)).toBe("4 ก.ค. 2569 · 06:46 น.");
    expect(formatThaiMonth("2026-11")).toBe("พฤศจิกายน 2569");
    expect(formatThaiDate("not a date")).toBe("-");
    // เที่ยงคืน UTC ของวันครบกำหนดยังเป็นวันเดียวกันในเวลาไทย
    expect(formatThaiDate("2026-10-05T00:00:00.000Z")).toBe("5 ต.ค. 2569");
  });

  it("uses the Thai calendar month and lists recent months", () => {
    // 1 พ.ย. 06:00 เวลาไทย ยังเป็น 31 ต.ค. ตามเวลา UTC แต่รอบบิลต้องเป็นพฤศจิกายนแล้ว
    expect(currentThaiMonth(new Date("2026-10-31T23:00:00.000Z"))).toBe("2026-11");
    expect(recentMonths("2026-02", 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(thaiMonthOptions("2026-11", 2, "2025-01").map((item) => item.label)).toEqual(["พฤศจิกายน 2569", "ตุลาคม 2569", "มกราคม 2568"]);
  });
});
