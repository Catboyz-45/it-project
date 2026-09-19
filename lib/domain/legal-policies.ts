import { z } from "zod";

// ตัวตรวจข้อมูลของหน้ายอมรับข้อตกลง ใช้ทั้งฝั่งหน้าจอและฝั่งเซิร์ฟเวอร์
// literal(true) แปลว่าต้องส่งค่า true มาเท่านั้น ติ๊กไม่ครบจะไม่ผ่านตั้งแต่ตอนตรวจ
export const acceptRequiredPoliciesSchema = z.object({
  action: z.literal("accept-required"),
  termsAccepted: z.literal(true, { error: "กรุณายอมรับข้อกำหนดการใช้บริการ" }),
  privacyAcknowledged: z.literal(true, { error: "กรุณารับทราบประกาศความเป็นส่วนตัว" }),
  // ความยินยอมรับข่าวสารเป็นทางเลือก ค่าเริ่มต้นคือไม่ยินยอม ต้องติ๊กเองถึงจะเป็น true
  marketingConsent: z.boolean().default(false),
// strict() ปฏิเสธฟิลด์แปลกปลอม กันคนยัดฟิลด์เกินมาหวังให้ไปเขียนทับข้อมูลอื่น
}).strict();

// ฟอร์มเปลี่ยนความยินยอมรับข่าวสารในหน้าตั้งค่า แยกจากด่านยอมรับตอนแรก
export const updateMarketingPreferenceSchema = z.object({
  action: z.literal("set-marketing"),
  enabled: z.boolean(),
}).strict();

// รวมสอง schema เข้าด้วยกันโดยดูจากฟิลด์ action ว่าเป็นคำขอแบบไหน
// API เส้นเดียวจึงรับได้ทั้งสองงาน โดยแต่ละงานยังตรวจตามกติกาของตัวเอง
export const policyPreferenceSchema = z.discriminatedUnion("action", [
  acceptRequiredPoliciesSchema,
  updateMarketingPreferenceSchema,
]);

export type AcceptRequiredPoliciesInput = z.infer<typeof acceptRequiredPoliciesSchema>;
