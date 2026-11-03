import { describe, expect, it } from "vitest";
import { meterDraftProblem } from "@/lib/domain/meter-draft";

describe("meterDraftProblem", () => {
  it("accepts a reading equal to or above the previous one", () => {
    expect(meterDraftProblem("22", "22")).toBeNull();
    expect(meterDraftProblem("22", "30")).toBeNull();
  });

  it("accepts a new room without a starting reading", () => {
    expect(meterDraftProblem("", "15")).toBeNull();
  });

  it("points at the latest field when only the starting reading was typed", () => {
    expect(meterDraftProblem("22", "")).toEqual({ field: "latest", message: "ยังไม่ได้กรอกเลขล่าสุด" });
    expect(meterDraftProblem("22", "  ")).toMatchObject({ field: "latest" });
  });

  it("explains a reading that goes backwards with both numbers", () => {
    expect(meterDraftProblem("22", "20")?.message).toContain("น้อยกว่าเลขครั้งก่อน");
    expect(meterDraftProblem("22", "20")?.message).toContain("22");
  });

  it("flags usage above the monthly ceiling", () => {
    expect(meterDraftProblem("0", "100001")?.message).toContain("เกิน");
  });

  it("rejects negative numbers in either field", () => {
    expect(meterDraftProblem("-1", "5")).toMatchObject({ field: "previous" });
    expect(meterDraftProblem("", "-5")).toMatchObject({ field: "latest" });
  });
});
