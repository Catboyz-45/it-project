/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “subscription access state.test” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

import { describe, expect, it } from "vitest";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState } from "@/lib/client/subscription-access-state";

describe("subscription UI access state", () => {
  it.each([
    ["FULL", "full"],
    ["GRACE", "grace"],
    ["READ_ONLY", "read-only"],
  ] as const)("maps %s API access to %s", (accessMode, expected) => {
    expect(resolveSubscriptionUiAccessState({ accessMode })).toBe(expected);
  });

  it("distinguishes loading and errors from confirmed read-only access", () => {
    expect(resolveSubscriptionUiAccessState({ isLoading: true })).toBe("loading");
    expect(resolveSubscriptionUiAccessState({ error: "network error" })).toBe("error");
    expect(resolveSubscriptionUiAccessState({})).toBe("error");
  });

  it("keeps confirmed access during a background refresh or refresh error", () => {
    expect(resolveSubscriptionUiAccessState({ accessMode: "FULL", isLoading: true })).toBe("full");
    expect(resolveSubscriptionUiAccessState({ accessMode: "GRACE", error: "refresh failed" })).toBe("grace");
  });

  it("does not restrict screens without an active property context", () => {
    expect(resolveSubscriptionUiAccessState({ enabled: false, isLoading: true })).toBe("full");
  });

  it.each([
    ["loading", true],
    ["error", true],
    ["full", false],
    ["grace", false],
    ["read-only", true],
  ] as const)("maps %s to mutation blocked=%s", (state, expected) => {
    expect(blocksSubscriptionMutations(state)).toBe(expected);
  });
});
