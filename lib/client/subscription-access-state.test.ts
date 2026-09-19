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

  // ยังไม่รู้สิทธิ์ ต้องไม่ถูกตีความว่าอ่านอย่างเดียว เพราะเป็นคนละเรื่องกันตอนแสดงข้อความให้ผู้ใช้
  it("distinguishes loading and errors from confirmed read-only access", () => {
    expect(resolveSubscriptionUiAccessState({ isLoading: true })).toBe("loading");
    expect(resolveSubscriptionUiAccessState({ error: "network error" })).toBe("error");
    expect(resolveSubscriptionUiAccessState({})).toBe("error");
  });

  // รู้สิทธิ์แล้วต้องไม่ถอยกลับไปเป็นกำลังโหลด ไม่งั้นปุ่มจะกะพริบหายทุกครั้งที่โหลดข้อมูลใหม่
  it("keeps confirmed access during a background refresh or refresh error", () => {
    expect(resolveSubscriptionUiAccessState({ accessMode: "FULL", isLoading: true })).toBe("full");
    expect(resolveSubscriptionUiAccessState({ accessMode: "GRACE", error: "refresh failed" })).toBe("grace");
  });

  // หน้าที่ไม่ผูกกับหอใดหอหนึ่งไม่ต้องกันอะไร เช่นหน้าบัญชีของผู้ใช้เอง
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
