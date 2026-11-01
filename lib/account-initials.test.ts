import { describe, expect, it } from "vitest";
import { accountInitials } from "@/lib/account-initials";

describe("account initials", () => {
  // สระหน้าอย่าง ใ เ แ ไม่ใช่ตัวแรกที่คนใช้จำชื่อ จึงข้ามไปเอาพยัญชนะ
  it("takes the first consonant of each of the first two Thai words", () => {
    expect(accountInitials("สมชาย ใจดี")).toBe("สจ");
    expect(accountInitials("  เอกชัย   ไพบูลย์ ศรีสุข ")).toBe("อพ");
  });

  it("keeps two characters for a single word so the circle is not one lonely letter", () => {
    expect(accountInitials("แอดมินใหญ่")).toBe("แอ");
    expect(accountInitials("nestly")).toBe("NE");
  });

  // ไม่ตัดกลางสระบนหรือวรรณยุกต์ ตัวอักษรที่มองเห็นต้องครบ
  it("never splits a consonant from its vowel or tone mark", () => {
    // "ปิ่นทอง" ตัวแรกที่มองเห็นคือ "ปิ่" (พยัญชนะ สระบน วรรณยุกต์) ตามด้วย "น"
    expect(accountInitials("ปิ่นทอง")).toBe("ปิ่น");
  });

  it("falls back to a question mark for an empty name", () => {
    expect(accountInitials("   ")).toBe("?");
  });
});
