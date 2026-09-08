/** ตรวจข้อมูลจากหน้าข้อตกลงและหน้าตั้งค่า ก่อนส่งให้ชั้นฐานข้อมูล */
import { z } from "zod";

export const acceptRequiredPoliciesSchema = z.object({
  action: z.literal("accept-required"),
  termsAccepted: z.literal(true, { error: "กรุณายอมรับข้อกำหนดการใช้บริการ" }),
  privacyAcknowledged: z.literal(true, { error: "กรุณารับทราบประกาศความเป็นส่วนตัว" }),
  marketingConsent: z.boolean().default(false),
}).strict();

export const updateMarketingPreferenceSchema = z.object({
  action: z.literal("set-marketing"),
  enabled: z.boolean(),
}).strict();

export const policyPreferenceSchema = z.discriminatedUnion("action", [
  acceptRequiredPoliciesSchema,
  updateMarketingPreferenceSchema,
]);

export type AcceptRequiredPoliciesInput = z.infer<typeof acceptRequiredPoliciesSchema>;
