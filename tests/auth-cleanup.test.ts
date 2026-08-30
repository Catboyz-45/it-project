/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ auth-cleanup.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { authCleanupCutoffs } from "@/server/auth/cleanup";

describe("authentication retention cleanup", () => {
  it("calculates independent session, idle-session, and throttle cutoffs", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const result = authCleanupCutoffs({
      now,
      sessionRetentionDays: 30,
      throttleRetentionDays: 7,
      sessionIdleMinutes: 30,
    });

    expect(result.sessionCutoff.toISOString()).toBe("2026-07-14T12:00:00.000Z");
    expect(result.idleSessionCutoff.toISOString()).toBe("2026-07-14T11:30:00.000Z");
    expect(result.throttleCutoff.toISOString()).toBe("2026-08-06T12:00:00.000Z");
  });
});
