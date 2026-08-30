/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ client-flash ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export type FlashTone = "success" | "info" | "warning" | "error";

const FLASH_KEY = "yuyen-ui-flash";
export const FLASH_EVENT = "yuyen:flash";

/** ปรับปรุงสถานะผ่าน setFlashMessage; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export function setFlashMessage(message: string, tone: FlashTone = "success") {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, tone }));
  window.dispatchEvent(new Event(FLASH_EVENT));
}

/** อ่านและลบข้อความชั่วคราวในครั้งเดียว เพื่อไม่ให้ข้อความเดิมแสดงซ้ำ */
export function takeFlashMessage(): { message: string; tone: FlashTone } | null {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    const value = JSON.parse(raw) as { message?: unknown; tone?: unknown };
    if (typeof value.message !== "string") return null;
    const tone: FlashTone = value.tone === "error" || value.tone === "warning" || value.tone === "info" ? value.tone : "success";
    return { message: value.message, tone };
  } catch {
    return null;
  }
}
