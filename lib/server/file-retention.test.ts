/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “file retention.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import { retentionCutoff } from "@/lib/server/file-retention";

describe("file retention policy", () => {
  it("calculates UTC cutoffs without changing the supplied run time", () => {
    const runAt = new Date("2026-07-29T12:30:00.000Z");

    expect(retentionCutoff(runAt, 365).toISOString()).toBe("2025-07-29T12:30:00.000Z");
    expect(runAt.toISOString()).toBe("2026-07-29T12:30:00.000Z");
  });

  it("supports the seven-year document retention default", () => {
    expect(retentionCutoff(new Date("2026-07-29T00:00:00.000Z"), 2555).toISOString())
      .toBe("2019-07-31T00:00:00.000Z");
  });
});
