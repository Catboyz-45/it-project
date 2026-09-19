import { describe, expect, it } from "vitest";
import { canAccessTenantFinancialRecords, parseTenantRecordId } from "@/lib/server/tenant-auth";

// กฎว่าใครเห็นข้อมูลของใครได้ พลาดตรงนี้คือข้อมูลการเงินรั่วข้ามคน จึงต้องมีตัวทดสอบคุมไว้
describe("tenant record ownership policy", () => {
  it("allows financial records only for an active primary occupant", () => {
    expect(canAccessTenantFinancialRecords("PRIMARY", "ACTIVE")).toBe(true);
    expect(canAccessTenantFinancialRecords("PRIMARY", "PENDING")).toBe(false);
    // ผู้พักร่วมอยู่ห้องเดียวกันแต่ไม่ใช่คนเซ็นสัญญา จึงไม่ควรเห็นบิล
    expect(canAccessTenantFinancialRecords("CO_OCCUPANT", "ACTIVE")).toBe(false);
  });

  // id ที่มี ../ คือความพยายามไต่ออกนอกขอบเขต ต้องตอบว่าไม่พบ ไม่ใช่บอกว่ารูปแบบผิด
  it("returns not-found semantics for malformed record identifiers", () => {
    expect(() => parseTenantRecordId("../../../invoice")).toThrow("ไม่พบข้อมูล");
  });
});
