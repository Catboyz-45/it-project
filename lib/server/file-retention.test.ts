import { describe, expect, it } from "vitest";
import { retentionCutoff } from "@/lib/server/file-retention";

describe("file retention policy", () => {
  it("calculates UTC cutoffs without changing the supplied run time", () => {
    const runAt = new Date("2026-07-29T12:30:00.000Z");

    expect(retentionCutoff(runAt, 365).toISOString()).toBe("2025-07-29T12:30:00.000Z");
    // ยืนยันว่าไม่ได้ไปแก้ค่าที่ส่งเข้ามา เพราะเมท็อดของ Date หลายตัวแก้ object เดิมโดยตรง
    expect(runAt.toISOString()).toBe("2026-07-29T12:30:00.000Z");
  });

  // เอกสารเก็บ 7 ปีตามที่กฎหมายกำหนด 2555 วันคือค่าที่ใช้จริงในระบบ
  it("supports the seven-year document retention default", () => {
    expect(retentionCutoff(new Date("2026-07-29T00:00:00.000Z"), 2555).toISOString())
      .toBe("2019-07-31T00:00:00.000Z");
  });
});
