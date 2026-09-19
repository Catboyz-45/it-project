import { describe, expect, it } from "vitest";
import { cancelInvoiceSchema } from "@/lib/domain/billing";

// ยกเลิกบิลแล้วย้อนไม่ได้ จึงต้องแน่ใจว่าตัวตรวจไม่ยอมให้ยกเลิกแบบไม่มีเหตุผล
describe("invoice cancellation validation", () => {
  it("requires a version and meaningful reason", () => {
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", version: 2, reason: "ออกบิลผิดห้อง" }).success).toBe(true);
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", version: 2, reason: "" }).success).toBe(false);
    // ไม่ส่ง version มาก็ต้องไม่ผ่าน ไม่งั้นจะยกเลิกทับบิลที่คนอื่นเพิ่งแก้ไป
    expect(cancelInvoiceSchema.safeParse({ action: "cancel", reason: "ออกบิลผิดห้อง" }).success).toBe(false);
  });
});
