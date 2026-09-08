/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “subscription access state” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

import type { SubscriptionAccessMode } from "@/lib/server/subscription-guard";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Ui Access State” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionUiAccessState = "loading" | "error" | "full" | "grace" | "read-only";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “resolve Subscription Ui Access State” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - { accessMode, enabled = true, error = "", isLoading = false,: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนข้อมูลชนิด SubscriptionUiAccessState ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function resolveSubscriptionUiAccessState({
  accessMode,
  enabled = true,
  error = "",
  isLoading = false,
}: {
  accessMode?: SubscriptionAccessMode | null;
  enabled?: boolean;
  error?: string | null;
  isLoading?: boolean;
}): SubscriptionUiAccessState {
  if (!enabled) return "full";
  if (accessMode === "FULL") return "full";
  if (accessMode === "GRACE") return "grace";
  if (accessMode === "READ_ONLY") return "read-only";
  if (isLoading) return "loading";
  if (error) return "error";
  return "error";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “blocks Subscription Mutations” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - state: ค่า “state” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function blocksSubscriptionMutations(state: SubscriptionUiAccessState) {
  return state === "loading" || state === "error" || state === "read-only";
}
