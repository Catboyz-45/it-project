import type { SubscriptionAccessMode } from "@/lib/server/subscription-guard";

// สถานะที่หน้าจอใช้ตัดสินว่าจะโชว์ปุ่มหรือไม่ รวมสถานะที่ยังตอบไม่ได้เข้าไปด้วย
export type SubscriptionUiAccessState = "loading" | "error" | "full" | "grace" | "read-only";

// แปลงสถานะแพ็กเกจจากเซิร์ฟเวอร์เป็นสถานะที่หน้าจอใช้
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
  // ไม่ได้เปิดใช้การตรวจ เช่นยังไม่มีการเข้าพักที่ใช้งานอยู่ ก็ไม่ต้องไปกันอะไร
  if (!enabled) return "full";
  if (accessMode === "FULL") return "full";
  if (accessMode === "GRACE") return "grace";
  if (accessMode === "READ_ONLY") return "read-only";
  // ยังไม่รู้สถานะก็ตอบว่ากำลังโหลด และถ้าถามไม่สำเร็จก็ตอบว่า error
  if (isLoading) return "loading";
  if (error) return "error";
  // ตกมาถึงตรงนี้แปลว่าไม่มีข้อมูลและไม่มี error ด้วย ซึ่งไม่ควรเกิด จึงถือว่าผิดพลาดไว้ก่อน
  return "error";
}

// ปิดปุ่มไว้ก่อนเมื่อยังไม่รู้สิทธิ์ ดีกว่าปล่อยให้กดแล้วเซิร์ฟเวอร์ปฏิเสธทีหลัง
// การบังคับจริงอยู่ที่เซิร์ฟเวอร์ ตัวนี้แค่ทำให้หน้าจอไม่หลอกผู้ใช้
export function blocksSubscriptionMutations(state: SubscriptionUiAccessState) {
  return state === "loading" || state === "error" || state === "read-only";
}
